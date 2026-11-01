/* DataLinq: live CSV / Google Sheets sources bound to template fields. */
(function () {
  'use strict';

  /* RFC 4180 CSV (also handles TSV when the first line has tabs and no commas). */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const sep = first.includes('\t') && !first.includes(',') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }

  /* Accepts a normal Google Sheets link, a "Publish to web" link, or any CSV URL. */
  function sheetToCsvUrl(url, sheetName) {
    url = String(url || '').trim();
    const pub = url.match(/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
    if (pub) {
      if (/output=csv/.test(url)) return url;
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
      return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? '&gid=' + gid : ''}`;
    }
    const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
    if (!m) return url;
    if (sheetName) return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? '&gid=' + gid : ''}`;
  }

  function colLetter(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  /* Column reference: header name (case-insensitive), spreadsheet letter (A, B, AA) or 1-based number. */
  function colIndex(ref, header) {
    ref = String(ref ?? '').trim();
    if (!ref) return -1;
    if (header) { const i = header.findIndex(h => String(h).trim().toLowerCase() === ref.toLowerCase()); if (i >= 0) return i; }
    if (/^\d+$/.test(ref)) return +ref - 1;
    if (/^[A-Za-z]{1,3}$/.test(ref)) { let n = 0; for (const c of ref.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; }
    return -1;
  }

  /* Row reference: 1-based data row number, or "Column=Value" to find the row by a key (e.g. "Jersey=21"). */
  function lookup(src, rows, link) {
    if (!src || !rows) return { ok: false, error: 'No data yet' };
    const header = src.header !== false ? rows[0] || [] : null;
    const body = header ? rows.slice(1) : rows;
    const r = String(link.row ?? '1').trim();
    if (r === '*') { // whole column, one value per line (tickers, lists)
      const ci = colIndex(link.col, header);
      if (ci < 0) return { ok: false, error: `No column "${link.col}"` };
      return { ok: true, value: body.map(rw => String(rw[ci] ?? '').trim()).filter(Boolean).join('\n') };
    }
    let row;
    const m = r.match(/^(.+?)\s*=\s*(.*)$/);
    if (m) {
      const ci = colIndex(m[1], header);
      if (ci < 0) return { ok: false, error: `No column "${m[1]}"` };
      const want = m[2].trim().toLowerCase();
      row = body.find(rw => String(rw[ci] ?? '').trim().toLowerCase() === want);
      if (!row) return { ok: false, error: `No row where ${m[1]} = ${m[2]}` };
    } else {
      const n = parseInt(r, 10) || 1;
      row = body[n - 1];
      if (!row) return { ok: false, error: `Row ${n} does not exist (${body.length} data rows)` };
    }
    const ci = colIndex(link.col, header);
    if (ci < 0) return { ok: false, error: `No column "${link.col}"` };
    return { ok: true, value: String(row[ci] ?? '') };
  }

  /* JSON feeds: a dot path (e.g. data.players or games[0].teams) to an array of objects, an array of arrays, or one object. */
  function parseJSON(text, pathStr) {
    let v = JSON.parse(text);
    for (const seg of String(pathStr || '').split('.').map(x => x.trim()).filter(Boolean)) {
      const m = seg.match(/^([^\[]*)((?:\[\d+\])*)$/);
      if (m && m[1]) v = v == null ? v : v[m[1]];
      if (m && m[2]) for (const ix of m[2].match(/\d+/g)) v = v == null ? v : v[+ix];
      if (v === undefined) throw new Error(`Nothing at "${seg}" in the JSON path`);
    }
    const flat = (o, pre = '', out = {}) => { for (const [k, x] of Object.entries(o || {})) { if (x && typeof x === 'object' && !Array.isArray(x) && pre.split('.').length < 3) flat(x, pre + k + '.', out); else out[pre + k] = Array.isArray(x) ? x.join(', ') : x; } return out; };
    if (Array.isArray(v)) {
      if (v.every(Array.isArray)) return v.map(r => r.map(c => c == null ? '' : String(c)));
      const objs = v.map(x => x && typeof x === 'object' ? flat(x) : { value: x });
      const keys = [...new Set(objs.flatMap(Object.keys))];
      return [keys, ...objs.map(o => keys.map(k => o[k] == null ? '' : String(o[k])))];
    }
    if (v && typeof v === 'object') { const o = flat(v); return [Object.keys(o), Object.values(o).map(x => x == null ? '' : String(x))]; }
    return [['value'], [String(v)]];
  }

  /* Minimal .xlsx reader (values only): shared strings, inline strings, numbers, booleans, cached formula results. */
  async function parseXLSX(data, sheetName) {
    if (!window.JSZip) throw new Error('Excel support did not load');
    const zip = await JSZip.loadAsync(data);
    const read = async p => { const f = zip.file(p.replace(/^\//, '')); return f ? f.async('string') : null; };
    const xml = s => new DOMParser().parseFromString(s, 'application/xml');
    const wbText = await read('xl/workbook.xml');
    if (!wbText) throw new Error('This is not an .xlsx workbook');
    const wb = xml(wbText), rels = xml(await read('xl/_rels/workbook.xml.rels') || '<r/>');
    const sheets = [...wb.getElementsByTagName('sheet')].map(x => ({ name: x.getAttribute('name'), rid: x.getAttribute('r:id') || [...x.attributes].find(a => a.localName === 'id' && a.prefix)?.value }));
    const sh = sheetName ? sheets.find(x => x.name.toLowerCase() === String(sheetName).toLowerCase()) : sheets[0];
    if (!sh) throw new Error(`No sheet "${sheetName}". Sheets: ${sheets.map(x => x.name).join(', ')}`);
    const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === sh.rid);
    let target = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const sstText = await read('xl/sharedStrings.xml');
    const sst = sstText ? [...xml(sstText).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    const doc = xml(await read(target));
    const rows = [];
    const colOf = ref => { let n = 0; for (const c of ref.replace(/\d+$/, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
    for (const row of doc.getElementsByTagName('row')) {
      const ri = (+row.getAttribute('r') || rows.length + 1) - 1;
      const out = rows[ri] = rows[ri] || [];
      let ci = 0;
      for (const c of row.getElementsByTagName('c')) {
        const ref = c.getAttribute('r'); if (ref) ci = colOf(ref);
        const t = c.getAttribute('t'), vEl = c.getElementsByTagName('v')[0];
        let val = '';
        if (t === 's') val = sst[+(vEl && vEl.textContent)] ?? '';
        else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (t === 'b') val = vEl && vEl.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (vEl && vEl.textContent !== '') val = t === 'str' || t === 'e' ? vEl.textContent : String(parseFloat(Number(vEl.textContent).toPrecision(12))); // a formula Excel never calculated stays blank, not 0
        out[ci++] = val;
      }
    }
    const width = Math.max(0, ...rows.filter(Boolean).map(r => r.length));
    const res = [];
    for (let i = 0; i < rows.length; i++) { const r = rows[i] || []; res.push(Array.from({ length: width }, (_, j) => r[j] ?? '')); }
    while (res.length && res[res.length - 1].every(x => x === '')) res.pop();
    return res;
  }

  /* Field formatting from data: case, decimals, thousands separators, prefix/suffix, fallback for empty cells. */
  function format(value, f) {
    let v = String(value ?? '');
    if (!f) return v;
    if (v.trim() === '' && f.fallback) return f.fallback;
    const n = Number(v.replace(/,/g, ''));
    if (v.trim() !== '' && isFinite(n) && (f.decimals !== '' && f.decimals != null || f.thousands)) {
      const d = f.decimals === '' || f.decimals == null ? undefined : +f.decimals;
      v = n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d ?? 6, useGrouping: !!f.thousands });
    }
    if (f.case === 'upper') v = v.toUpperCase();
    else if (f.case === 'lower') v = v.toLowerCase();
    else if (f.case === 'title') v = v.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    return (f.prefix || '') + v + (f.suffix || '');
  }
  /* Conditional colour: { op: '>', value: '99', color: '#ffd400' } — numeric when both sides are numbers. */
  function ruleColor(value, rule) {
    if (!rule || !rule.op || rule.color == null || rule.color === '') return null;
    const a = String(value ?? '').trim(), b = String(rule.value ?? '').trim();
    const na = Number(a.replace(/,/g, '')), nb = Number(b);
    const num = a !== '' && b !== '' && isFinite(na) && isFinite(nb);
    const L = num ? na : a.toLowerCase(), R = num ? nb : b.toLowerCase();
    const hit = { '>': L > R, '>=': L >= R, '<': L < R, '<=': L <= R, '=': L === R, '!=': L !== R, contains: String(a).toLowerCase().includes(String(b).toLowerCase()), empty: a === '' }[rule.op];
    return hit ? rule.color : null;
  }

  window.DataLinq = { parseCSV, parseJSON, parseXLSX, sheetToCsvUrl, colIndex, colLetter, lookup, format, ruleColor };
})();
