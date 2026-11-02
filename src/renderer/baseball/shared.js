/* Bullpen CG: helpers shared by the server, the operator console and the output pages. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const uid = () => Math.random().toString(36).slice(2, 10);
  const other = k => (k === 'away' ? 'home' : 'away');
  const battingKey = g => (g.half === 'top' ? 'away' : 'home');
  const fieldingKey = g => other(battingKey(g));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* .287 style; values >= 1 (OPS 1.024) keep the leading digit */
  function fmtAvg(v) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    const s = n.toFixed(3);
    return n < 1 ? s.replace(/^0/, '') : s;
  }
  const fmtEra = v => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(2));
  const fmtNum = v => (v == null || v === '' ? '—' : String(v));
  const ipStr = outs => Math.floor(outs / 3) + '.' + (outs % 3);
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

  const fullName = p => (p ? [p.first, p.last].filter(Boolean).join(' ') : '');
  const playerById = (team, id) => (team && team.roster.find(p => p.id === id)) || null;
  const teamRuns = (g, k) => g.runs[k].reduce((a, b) => a + (Number(b) || 0), 0);

  function currentBatter(st) {
    const k = battingKey(st.game), t = st.teams[k];
    const slot = t.lineup[t.up] || null;
    return { key: k, team: t, slot, idx: t.up, player: slot ? playerById(t, slot.id) : null };
  }
  function currentPitcher(st, key) {
    const k = key || fieldingKey(st.game), t = st.teams[k];
    return { key: k, team: t, player: playerById(t, t.pitcher) };
  }
  /* The next n hitters for a team, starting at its current spot in the order. */
  function dueUp(st, key, n = 3) {
    const t = st.teams[key], out = [];
    if (!t.lineup.length) return out;
    for (let i = 0; i < n; i++) {
      const idx = (t.up + i) % t.lineup.length, slot = t.lineup[idx];
      out.push({ idx, slot, player: playerById(t, slot.id) });
    }
    return out;
  }
  /* Which team is due up next: during a break it is the team about to bat. */
  const dueUpKey = g => (g.transition ? battingKey(g) : fieldingKey(g));

  /* "MID 3", "END 3", "▲ 7", "FINAL", "F/10" */
  function inningState(g) {
    if (g.final) { const n = lastInning(g); return { label: n > 9 ? 'F/' + n : 'FINAL', arrow: '', num: '' }; }
    if (g.transition) {
      if (g.half === 'bottom') return { label: 'MID ' + g.inning, arrow: '', num: '' };
      return { label: 'END ' + (g.inning - 1), arrow: '', num: '' };
    }
    return { label: '', arrow: g.half === 'top' ? '▲' : '▼', num: String(g.inning) };
  }
  function lastInning(g) { return Math.max(g.runs.away.length, g.runs.home.length); }

  /* Runs in a linescore cell; blank for halves not yet played. */
  function lineCell(g, k, i) {
    const inn = i + 1;
    if (inn > g.inning) return '';
    if (k === 'home' && inn === g.inning && g.half === 'top' && !g.final) return '';
    if (k === 'home' && inn === g.inning && g.half === 'bottom' && g.transition) return '';
    if (k === 'away' && inn === g.inning && g.transition && g.half === 'top') return '';
    const v = g.runs[k][i];
    return v == null ? '' : String(v);
  }

  /* "2-for-3, HR, 2 RBI, BB" */
  function todayLine(t) {
    if (!t || !t.pa) return 'First plate appearance';
    const parts = [t.h + '-for-' + t.ab];
    const add = (n, one, many) => { if (n) parts.push(n > 1 ? n + ' ' + (many || one) : one); };
    add(t.hr, 'HR'); add(t.t, '3B'); add(t.d, '2B');
    add(t.rbi, 'RBI'); add(t.bb, 'BB'); add(t.so, 'K'); add(t.hbp, 'HBP'); add(t.sf, 'SAC');
    return parts.join(', ');
  }
  function pitchLine(p) {
    if (!p || (!p.bf && !p.pitches)) return 'Has not faced a batter';
    return ipStr(p.outs) + ' IP, ' + p.h + ' H, ' + p.r + ' R, ' + p.bb + ' BB, ' + p.so + ' K';
  }

  /* Small RFC-4180 CSV parser: quotes, escaped quotes, CRLF. */
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = [];
      } else f += c;
    }
    row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  }

  /* Roster CSV with a header row. Recognised columns (any order, any case):
     num/#/no, first, last, name (split into first/last), pos, bats, throws,
     avg, hr, rbi, obp, slg, ops, sb, w, l, era, ip, so/k, bb, whip, sv, photo/headshot */
  const ALIAS = { '#': 'num', no: 'num', number: 'num', jersey: 'num', position: 'pos', k: 'so', firstname: 'first', lastname: 'last', 'first name': 'first', 'last name': 'last', player: 'name', headshot: 'photo', image: 'photo' };
  const FIELDS = ['num', 'first', 'last', 'name', 'pos', 'bats', 'throws', 'avg', 'hr', 'rbi', 'obp', 'slg', 'ops', 'sb', 'w', 'l', 'era', 'ip', 'so', 'bb', 'whip', 'sv', 'photo'];
  function rosterFromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('The CSV needs a header row and at least one player.');
    const head = rows[0].map(h => { const k = h.trim().toLowerCase(); return ALIAS[k] || k; });
    if (!head.includes('last') && !head.includes('name')) throw new Error('The CSV needs a "name" or "last" column.');
    return rows.slice(1).map(r => {
      const p = { id: uid() };
      head.forEach((h, i) => { if (FIELDS.includes(h) && r[i] != null && r[i].trim() !== '') p[h] = r[i].trim(); });
      if (p.name && !p.last) {
        if (p.name.includes(',')) { // "Delgado, Marcus"
          const [last, first] = p.name.split(',');
          p.last = last.trim(); p.first = (first || '').trim();
        } else {
          const bits = p.name.split(/\s+/);
          p.last = bits.pop(); p.first = bits.join(' ');
        }
      }
      delete p.name;
      p.first = p.first || ''; p.last = p.last || ''; p.num = p.num || ''; p.pos = (p.pos || '').toUpperCase();
      return p;
    }).filter(p => p.last || p.first);
  }
  const isPitcher = p => /^(P|SP|RP|LHP|RHP|CL)$/i.test(p.pos || '');

  return {
    uid, other, battingKey, fieldingKey, esc, fmtAvg, fmtEra, fmtNum, ipStr, ordinal,
    fullName, playerById, teamRuns, currentBatter, currentPitcher, dueUp, dueUpKey,
    inningState, lastInning, lineCell, todayLine, pitchLine, parseCSV, rosterFromCSV, isPitcher
  };
});
