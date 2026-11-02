/* Bullpen CG operator console. All changes go to the server as actions; the
   server pushes the new state back over SSE and every page re-renders. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const e = BP.esc;
  let st = null;

  /* ---------- server ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }
  async function send(a) {
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      if (!r.ok) toast((await r.json()).error || 'Request failed');
    } catch { toast('Cannot reach the Bullpen server'); }
  }
  function connect() {
    const es = new EventSource('/events');
    es.onopen = () => $('#conn').classList.add('ok');
    es.onerror = () => $('#conn').classList.remove('ok');
    es.onmessage = m => { st = JSON.parse(m.data); render(); };
  }

  /* ---------- tabs ---------- */
  let tab = 'game';
  function setTab(t) {
    tab = t;
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $$('.tab').forEach(m => m.classList.toggle('on', m.id === 'tab-' + t));
    render();
  }
  $$('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

  /* ---------- helpers ---------- */
  const tv = t => `--c1:${e(t.color)};--c2:${e(t.color2)}`;
  const focusedIn = el => el && el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  const setVal = (el, v) => { if (el && document.activeElement !== el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v; } };
  const lowerSecs = () => Number($('#autoSecs').value) || 0;

  function preview(gfx) { send({ type: 'preview', gfx }); }
  function takeNow(gfx) { send({ type: 'take', gfx }); }
  function withSecs(gfx) {
    const slot = { lineup: 'full', scoreboard: 'full', flash: 'flash', pitchspeed: 'flash' }[gfx.type] || 'lower';
    if (slot === 'lower' && lowerSecs() && gfx.secs == null) gfx.secs = lowerSecs();
    return gfx;
  }

  /* ---------- graphics library ---------- */
  function libItems() {
    const b = BP.currentBatter(st), p = BP.currentPitcher(st), duk = BP.dueUpKey(st.game);
    return [
      ['Lower thirds'],
      ['Batter', { type: 'batter', player: b.player && b.player.id }, 'Q', b.player ? b.player.last : ''],
      ['Pitcher', { type: 'pitcher', player: p.player && p.player.id }, 'P', p.player ? p.player.last : ''],
      ['Matchup', { type: 'matchup' }, 'M'],
      ['Pitch count', { type: 'pitchcount', player: p.player && p.player.id }],
      ['Due up', { type: 'dueup', team: duk }, '', st.teams[duk].abbr],
      ['Linescore', { type: 'linescore' }, 'L'],
      ['Full screen'],
      ['Lineup', { type: 'lineup', team: 'away' }, '', st.teams.away.abbr],
      ['Lineup', { type: 'lineup', team: 'home' }, '', st.teams.home.abbr],
      ['Scoreboard', { type: 'scoreboard' }]
    ];
  }
  const sameGfx = (a, b) => a && b && a.type === b.type && (a.team || '') === (b.team || '') && (a.player || '') === (b.player || '');
  function renderLib() {
    const lib = $('#lib');
    lib.innerHTML = '';
    for (const [label, gfx, key, extra] of libItems()) {
      if (!gfx) { lib.insertAdjacentHTML('beforeend', `<div class="grp">${e(label)}</div>`); continue; }
      const btn = document.createElement('button');
      const slot = gfx.type === 'lineup' || gfx.type === 'scoreboard' ? 'full' : 'lower';
      if (sameGfx(st.gfx.preview, gfx)) btn.classList.add('pv');
      if (sameGfx(st.gfx[slot], gfx)) btn.classList.add('air');
      btn.innerHTML = `${e(label)}${extra ? ` <span class="dim">${e(extra)}</span>` : ''}${key ? `<kbd class="k">${key}</kbd>` : ''}`;
      let clickT;
      btn.onclick = () => { clearTimeout(clickT); clickT = setTimeout(() => preview(withSecs({ ...gfx })), 180); };
      btn.ondblclick = () => { clearTimeout(clickT); takeNow(withSecs({ ...gfx })); };
      lib.appendChild(btn);
    }
  }

  /* ---------- game tab ---------- */
  function renderScore() {
    const g = st.game, bk = BP.battingKey(g);
    const row = k => {
      const t = st.teams[k];
      return `<tr style="${tv(t)}">
        <td><div class="tm"><i></i>${e(t.abbr)} ${k === bk && !g.final ? '<span class="bat">●</span>' : ''}</div></td>
        <td class="big">${BP.teamRuns(g, k)}</td>
        <td><button data-act='{"type":"runs","team":"${k}","delta":1}'>+1</button> <button data-act='{"type":"runs","team":"${k}","delta":-1}'>−1</button></td>
        <td class="num">${g.hits[k]}</td><td><button data-act='{"type":"hits","team":"${k}","delta":1}'>+</button><button data-act='{"type":"hits","team":"${k}","delta":-1}'>−</button></td>
        <td class="num">${g.errors[k]}</td><td><button data-act='{"type":"errors","team":"${k}","delta":1}'>+</button><button data-act='{"type":"errors","team":"${k}","delta":-1}'>−</button></td>
      </tr>`;
    };
    const n = Math.max(9, BP.lastInning(g));
    const cols = Array.from({ length: n }, (_, i) => `<div><div class="h">${i + 1}</div><div>${BP.lineCell(g, 'away', i) || '·'}</div><div>${BP.lineCell(g, 'home', i) || '·'}</div></div>`).join('');
    $('#scoreTable').innerHTML = `<table class="st"><tr><th></th><th>R</th><th>runs</th><th>H</th><th></th><th>E</th><th></th></tr>${row('away')}${row('home')}</table>
      <div class="mini-ls"><div><div class="h">&nbsp;</div><div>${e(st.teams.away.abbr)}</div><div>${e(st.teams.home.abbr)}</div></div>${cols}</div>`;
  }

  function renderSitu() {
    const g = st.game, is = BP.inningState(g);
    $('#inningLabel').textContent = is.label || `${is.arrow} ${BP.ordinal(g.inning)}`;
    $('#diamond').innerHTML = `<div class="b b2 ${g.bases[1] ? 'on' : ''}" data-base="1" title="Second"></div>
      <div class="b b1 ${g.bases[0] ? 'on' : ''}" data-base="0" title="First"></div>
      <div class="b b3 ${g.bases[2] ? 'on' : ''}" data-base="2" title="Third"></div><div class="home"></div>`;
    const dots = (n, max, cls, act) => Array.from({ length: max }, (_, i) => `<i class="${cls} ${i < n ? 'on' : ''}" data-set='${act(i < n ? i : i + 1)}'></i>`).join('');
    $('#counts').innerHTML = `
      <div class="cnt"><label>Balls</label>${dots(g.balls, 3, 'b', v => JSON.stringify({ type: 'count', balls: v }))}</div>
      <div class="cnt"><label>Strikes</label>${dots(g.strikes, 2, 's', v => JSON.stringify({ type: 'count', strikes: v }))}</div>
      <div class="cnt"><label>Outs</label>${dots(g.outs, 2, 'o', v => JSON.stringify({ type: 'outs', value: v }))}</div>`;
    $('#finalBtn').classList.toggle('on', g.final);
    $('#finalBtn').textContent = g.final ? 'Final ✓' : 'Final';
    $('#lastPlay').textContent = g.lastPlay || 'No plays yet.';
  }
  $('#diamond').addEventListener('click', ev => { const b = ev.target.closest('[data-base]'); if (b) send({ type: 'base', base: +b.dataset.base }); });
  $('#counts').addEventListener('click', ev => { const d = ev.target.closest('[data-set]'); if (d) send(JSON.parse(d.dataset.set)); });
  $('#innUp').onclick = () => { const g = st.game; send(g.half === 'top' ? { type: 'inning', inning: g.inning, half: 'bottom' } : { type: 'inning', inning: g.inning + 1, half: 'top' }); };
  $('#innDown').onclick = () => { const g = st.game; send(g.half === 'bottom' ? { type: 'inning', inning: g.inning, half: 'top' } : { type: 'inning', inning: Math.max(1, g.inning - 1), half: 'bottom' }); };

  function renderPeople() {
    const b = BP.currentBatter(st), p = BP.currentPitcher(st);
    const bp = b.player, pp = p.player;
    const pit = pp && st.pit[pp.id];
    $('#atBat').innerHTML = `<h3>At bat <span class="dim">${e(b.team.abbr)} · ${BP.ordinal(b.idx + 1)}</span></h3>` + (bp ? `
      <div class="who" style="${tv(b.team)}"><div class="n">${e(bp.num)}</div><div><div class="nm">${e(BP.fullName(bp))}</div>
        <div class="sub">${e(b.slot.pos)} · ${e(BP.fmtAvg(bp.avg))} · ${e(BP.fmtNum(bp.hr))} HR · ${e(BP.fmtNum(bp.rbi))} RBI</div>
        <div class="sub">Today: ${e(BP.todayLine(st.today[bp.id]))}</div></div></div>
      <div class="inl"><button data-act='{"type":"batter","delta":-1}'>◀ Prev</button><button data-act='{"type":"batter","delta":1}'>Next ▶</button>
        <span class="grow"></span><button class="go" data-take='${e(JSON.stringify({ type: 'batter', player: bp.id }))}'>Take batter</button></div>` : '<p class="hint">No lineup for this team. Set one on the Teams tab.</p>');
    const others = st.teams[p.key].roster.filter(x => x.id !== (pp && pp.id)).sort((x, y) => (BP.isPitcher(y) - BP.isPitcher(x)));
    $('#onMound').innerHTML = `<h3>Pitching <span class="dim">${e(p.team.abbr)}</span></h3>` + (pp ? `
      <div class="who" style="${tv(p.team)}"><div class="n">${e(pp.num)}</div><div><div class="nm">${e(BP.fullName(pp))}</div>
        <div class="sub">${e(BP.pitchLine(pit))}</div><div class="sub">${e(BP.fmtEra(pp.era))} ERA · ${pit ? pit.strikes : 0} strikes</div></div>
        <div class="big-pc">${pit ? pit.pitches : 0}<small>PITCHES</small></div></div>` : '<p class="hint">No pitcher set.</p>') + `
      <div class="inl"><select id="pitcherSel"><option value="">Pitching change…</option>${others.map(x => `<option value="${e(x.id)}">${e(x.num)} ${e(BP.fullName(x))}${BP.isPitcher(x) ? '' : ' (' + e(x.pos) + ')'}</option>`).join('')}</select>
        ${pp ? `<button class="go" data-take='${e(JSON.stringify({ type: 'pitcher', player: pp.id }))}'>Take pitcher</button>` : ''}</div>`;
    $('#pitcherSel').onchange = ev => { if (ev.target.value) send({ type: 'pitcher', team: p.key, id: ev.target.value }); };

    const t = b.team;
    $('#orderTeam').textContent = t.city + ' ' + t.name;
    $('#order').innerHTML = t.lineup.map((s, i) => {
      const pl = BP.playerById(t, s.id) || {};
      const td = st.today[s.id];
      return `<button class="${i === t.up ? 'cur' : ''}" data-act='{"type":"batter","index":${i}}'><span class="o">${i + 1}</span>${e(pl.last || '?')}<span class="t">${td && td.pa ? td.h + '-' + td.ab : e(s.pos)}</span></button>`;
    }).join('');
  }

  const GFX_NAME = { batter: 'Batter', pitcher: 'Pitcher', matchup: 'Matchup', dueup: 'Due up', linescore: 'Linescore', lt: 'Lower third', pitchcount: 'Pitch count', lineup: 'Lineup', scoreboard: 'Scoreboard', flash: 'Flash', pitchspeed: 'Pitch speed' };
  function gname(g) {
    if (!g) return '';
    let n = GFX_NAME[g.type] || g.type;
    if (g.player) for (const k of ['away', 'home']) { const p = BP.playerById(st.teams[k], g.player); if (p) n += ' · ' + p.last; }
    else if (g.team) n += ' · ' + st.teams[g.team].abbr;
    if (g.type === 'lt') n += ' · ' + (g.line1 || '');
    if (g.type === 'flash') n += ' · ' + (g.text || '');
    if (g.type === 'pitchspeed') n += ' · ' + g.mph;
    return n;
  }
  function renderAir() {
    const gx = st.gfx;
    $('#pvName').textContent = gx.preview ? '— ' + gname(gx.preview) : '— empty';
    $('#take').disabled = !gx.preview;
    const chips = [];
    if (gx.bug) chips.push('BUG');
    for (const s of ['lower', 'full', 'flash']) if (gx[s]) chips.push(s.toUpperCase() + ': ' + gname(gx[s]) + (gx[s].secs ? ` (${gx[s].secs}s)` : ''));
    if (gx.ticker.on) chips.push('TICKER');
    $('#onair').innerHTML = chips.map(c => `<b>${e(c)}</b>`).join('');
    setVal($('#bugOn'), gx.bug);
    setVal($('#tickerOn'), gx.ticker.on);
    setVal($('#autoBatter'), gx.auto.batter);
    setVal($('#autoSecs'), gx.auto.secs);
    setVal($('#tickLabel'), gx.ticker.label);
    setVal($('#tickItems'), gx.ticker.items);
  }

  $('#take').onclick = () => send({ type: 'take' });
  $('#bugOn').onchange = ev => send({ type: 'bug', value: ev.target.checked });
  $('#tickerOn').onchange = ev => send({ type: 'ticker', on: ev.target.checked });
  $('#autoBatter').onchange = ev => send({ type: 'auto', batter: ev.target.checked });
  $('#autoSecs').onchange = ev => send({ type: 'auto', secs: ev.target.value });
  $('#tickSave').onclick = () => send({ type: 'ticker', label: $('#tickLabel').value, items: $('#tickItems').value });
  const mphTake = () => { const v = $('#mph').value; if (!v) return toast('Type the speed first'); takeNow({ type: 'pitchspeed', mph: v, pitch: $('#pitchType').value, secs: 6 }); $('#mph').select(); };
  $('#mphTake').onclick = mphTake;
  $('#mph').addEventListener('keydown', ev => { if (ev.key === 'Enter') mphTake(); });
  $('#flashTake').onclick = () => { const v = $('#flashText').value.trim(); if (v) takeNow({ type: 'flash', text: v, secs: 8 }); };
  $('#flashText').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#flashTake').click(); });
  $('#flashQuick').innerHTML = ['Pitching change', 'Mound visit', 'Replay review', 'Call stands', 'Call overturned', 'Rain delay', 'Pitch clock violation', 'Stolen base'].map(t => `<button>${t}</button>`).join('');
  $('#flashQuick').onclick = ev => { const b = ev.target.closest('button'); if (b) takeNow({ type: 'flash', text: b.textContent, secs: 8 }); };
  const ltGfx = () => withSecs({ type: 'lt', line1: $('#lt1').value, line2: $('#lt2').value });
  $('#ltPrev').onclick = () => preview(ltGfx());
  $('#ltTake').onclick = () => takeNow(ltGfx());

  /* ---------- buttons with data-act / data-res / data-take anywhere ---------- */
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-act]');
    if (a) return send(JSON.parse(a.dataset.act));
    const r = ev.target.closest('[data-res]');
    if (r) return send({ type: 'result', kind: r.dataset.res });
    const t = ev.target.closest('[data-take]');
    if (t) return takeNow(withSecs(JSON.parse(t.dataset.take)));
    const pv = ev.target.closest('[data-pv]');
    if (pv) { preview(withSecs(JSON.parse(pv.dataset.pv))); setTab('game'); }
  });
  $('#undo').onclick = () => send({ type: 'undo' });
  $('#redo').onclick = () => send({ type: 'redo' });

  /* ---------- teams tab ---------- */
  const RCOLS = [['num', '#', 44], ['first', 'First', 90], ['last', 'Last', 110], ['pos', 'Pos', 46], ['bats', 'B', 34], ['throws', 'T', 34], ['avg', 'AVG', 54], ['hr', 'HR', 40], ['rbi', 'RBI', 44], ['ops', 'OPS', 54], ['w', 'W', 36], ['l', 'L', 36], ['era', 'ERA', 50], ['so', 'K', 44], ['whip', 'WHIP', 50]];
  const TEMPLATE = 'num,first,last,pos,bats,throws,avg,hr,rbi,ops,w,l,era,so,whip\n2,Marcus,Delgado,SS,R,R,.291,14,58,.812,,,,,\n41,Nate,Corrigan,P,R,R,,,,,11,5,3.08,141,1.11\n';
  let teamsDirty = true;
  function renderTeams() {
    const box = $('#teams');
    if (focusedIn(box)) { teamsDirty = true; return; }
    teamsDirty = false;
    box.innerHTML = ['away', 'home'].map(k => {
      const t = st.teams[k];
      const opts = sel => t.roster.map(p => `<option value="${e(p.id)}" ${p.id === sel ? 'selected' : ''}>${e(p.num)} ${e(BP.fullName(p))}</option>`).join('');
      const lineup = t.lineup.map((s, i) => `<div class="o">${i + 1}</div>
        <select data-lu="${i}" data-team="${k}">${opts(s.id)}<option value="">— remove —</option></select>
        <input data-lupos="${i}" data-team="${k}" value="${e(s.pos)}" placeholder="Pos">
        <div><button data-move="${i}" data-dir="-1" data-team="${k}" title="Move up">↑</button><button data-move="${i}" data-dir="1" data-team="${k}" title="Move down">↓</button></div>`).join('');
      const add = t.lineup.length < 9 ? `<div></div><select data-lu="${t.lineup.length}" data-team="${k}"><option value="">+ add to lineup…</option>${opts('')}</select><div></div><div></div>` : '';
      const rows = t.roster.map(p => `<tr>${RCOLS.map(([f, , w]) => `<td><input style="width:${w}px" data-pf="${f}" data-pid="${e(p.id)}" data-team="${k}" value="${e(p[f] || '')}"></td>`).join('')}
        <td><button class="x" title="Preview lower third" data-pv='${e(JSON.stringify({ type: BP.isPitcher(p) ? 'pitcher' : 'batter', player: p.id }))}'>L3</button></td>
        <td><button class="x" title="Remove player" data-act='${e(JSON.stringify({ type: 'removePlayer', team: k, id: p.id }))}'>✕</button></td></tr>`).join('');
      return `<div class="panel" style="${tv(t)}">
        <h3>${k === 'away' ? 'Away' : 'Home'} team</h3>
        <div class="tform">
          <label class="fld"><span>City</span><input data-tf="city" data-team="${k}" value="${e(t.city)}"></label>
          <label class="fld"><span>Name</span><input data-tf="name" data-team="${k}" value="${e(t.name)}"></label>
          <label class="fld"><span>Abbreviation</span><input data-tf="abbr" data-team="${k}" value="${e(t.abbr)}" maxlength="4"></label>
          <label class="fld"><span>Record</span><input data-tf="record" data-team="${k}" value="${e(t.record)}" placeholder="52-38"></label>
          <label class="fld"><span>Primary color</span><input type="color" data-tf="color" data-team="${k}" value="${e(t.color)}"></label>
          <label class="fld"><span>Secondary color</span><input type="color" data-tf="color2" data-team="${k}" value="${e(t.color2)}"></label>
          <label class="fld span2"><span>Logo (PNG/SVG with transparency)</span>
            <span class="inl" style="margin:0"><span class="logo-prev" style="background-image:${t.logo ? `url('${e(t.logo)}')` : 'none'}"></span>
            <label class="btn">Choose…<input type="file" accept="image/*" data-logo="${k}" hidden></label>
            ${t.logo ? `<button data-act='${e(JSON.stringify({ type: 'team', team: k, fields: { logo: '' } }))}'>Remove</button>` : ''}</span></label>
        </div>
        <h3 class="sub-h">Pitching now</h3>
        <select data-pitcher="${k}">${opts(t.pitcher)}</select>
        <h3 class="sub-h">Batting order</h3>
        <div class="lu-ed">${lineup}${add}</div>
        <h3 class="sub-h">Roster <span class="dim">${t.roster.length} players · edits save as you go</span></h3>
        <div class="inl" style="margin-top:0">
          <button data-act='${e(JSON.stringify({ type: 'addPlayer', team: k }))}'>+ Add player</button>
          <label class="btn">Import CSV…<input type="file" accept=".csv,text/csv" data-csv="${k}" hidden></label>
          <a class="btn" download="roster-template.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}">CSV template</a>
        </div>
        <div class="roster-wrap"><table class="roster"><tr>${RCOLS.map(([, h]) => `<th>${h}</th>`).join('')}<th></th><th></th></tr>${rows}</table></div>
      </div>`;
    }).join('');
  }
  const teamsBox = $('#teams');
  teamsBox.addEventListener('change', async ev => {
    const el = ev.target, k = el.dataset.team;
    if (el.dataset.tf) return send({ type: 'team', team: k, fields: { [el.dataset.tf]: el.value } });
    if (el.dataset.pf) return send({ type: 'player', team: k, id: el.dataset.pid, fields: { [el.dataset.pf]: el.value } });
    if (el.dataset.pitcher) return send({ type: 'pitcher', team: el.dataset.pitcher, id: el.value });
    if (el.dataset.lu != null) return send({ type: 'lineup', team: k, index: +el.dataset.lu, id: el.value, pos: el.value ? undefined : null });
    if (el.dataset.lupos != null) {
      const t = st.teams[k], s = t.lineup[+el.dataset.lupos];
      return send({ type: 'lineup', team: k, index: +el.dataset.lupos, id: s.id, pos: el.value.toUpperCase() });
    }
    if (el.dataset.logo) {
      const f = el.files[0]; if (!f) return;
      if (f.size > 1.5e6) return toast('Logo is over 1.5 MB. Use a smaller PNG or SVG.');
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      return send({ type: 'team', team: el.dataset.logo, fields: { logo: url } });
    }
    if (el.dataset.csv) {
      const f = el.files[0]; if (!f) return;
      if (!confirm(`Replace the ${st.teams[el.dataset.csv].name} roster and lineup with ${f.name}?`)) return;
      return send({ type: 'roster', team: el.dataset.csv, csv: await f.text() });
    }
  });
  teamsBox.addEventListener('click', ev => {
    const m = ev.target.closest('[data-move]');
    if (!m) return;
    const k = m.dataset.team, i = +m.dataset.move, j = i + +m.dataset.dir;
    const lu = st.teams[k].lineup.slice();
    if (j < 0 || j >= lu.length) return;
    [lu[i], lu[j]] = [lu[j], lu[i]];
    send({ type: 'lineup', team: k, lineup: lu });
  });
  teamsBox.addEventListener('focusout', () => setTimeout(() => { if (teamsDirty && tab === 'teams') renderTeams(); }, 0));

  /* ---------- settings tab ---------- */
  function renderSettings() {
    $$('[data-meta]').forEach(el => setVal(el, st.meta[el.dataset.meta]));
    $$('[data-theme]').forEach(el => setVal(el, st.theme[el.dataset.theme]));
    const base = location.origin;
    const outs = [['Program fill', '/output'], ['Program key', '/output?key=1'], ['Program on green', '/output?bg=00ff00'], ['Scorebug only (fill)', '/output?only=bug'], ['Everything but the bug', '/output?only=lower,full,flash,ticker'], ['Preview', '/output?preview=1']];
    $('#outputs').innerHTML = outs.map(([n, u]) => `<div class="outrow"><b>${n}</b><code>${e(base + u)}</code><button data-copy="${e(base + u)}">Copy</button><a class="btn" target="_blank" href="${e(u)}">Open</a></div>`).join('');
    const api = [['/api/do/pitch?kind=ball', 'Ball'], ['/api/do/pitch?kind=called', 'Called strike'], ['/api/do/pitch?kind=swinging', 'Swinging strike'], ['/api/do/pitch?kind=foul', 'Foul'],
      ['/api/do/result?kind=1b', 'Single (2b, 3b, hr, bb, ibb, hbp, k, out, dp, sac, e, fc)'], ['/api/do/runs?team=home&delta=1', 'Run for home'], ['/api/do/outs?delta=1', 'Add an out'], ['/api/do/base?base=0', 'Toggle first base (0-2)'],
      ['/api/do/batter?delta=1', 'Next batter'], ['/api/do/endHalf', 'End half-inning'], ['/api/do/take?gfx=batter', 'Take current batter'], ['/api/do/take?gfx=pitcher', 'Take current pitcher'],
      ['/api/do/take?gfx=matchup', 'Take matchup'], ['/api/do/take?gfx=dueup', 'Take due up'], ['/api/do/take?gfx=linescore&secs=10', 'Take linescore for 10 s'], ['/api/do/take?gfx=pitchspeed&mph=97&pitch=Slider&secs=6', 'Pitch speed'],
      ['/api/do/take', 'Take whatever is in preview'], ['/api/do/clear?slot=lower', 'Clear lower (full, flash, all)'], ['/api/do/bug', 'Scorebug on/off'], ['/api/do/ticker?toggle=true', 'Ticker on/off'], ['/api/do/undo', 'Undo'], ['/api/state', 'Full state as JSON']];
    $('#api').innerHTML = api.map(([u, d]) => `<div><code>${e(u)}</code><span>${e(d)}</span></div>`).join('');
  }
  $$('[data-meta]').forEach(el => el.onchange = () => send({ type: 'meta', fields: { [el.dataset.meta]: el.value } }));
  $$('[data-theme]').forEach(el => el.onchange = () => send({ type: 'theme', fields: { [el.dataset.theme]: el.value } }));
  $('#outputs').addEventListener('click', ev => { const b = ev.target.closest('[data-copy]'); if (b) navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied'; }, () => toast('Copy failed: select the address and copy it')); });
  $('#resetGame').onclick = () => { if (confirm('Start a new game? Score, count and today\'s stats reset. Teams, rosters and lineups stay. You can undo this.')) send({ type: 'resetGame' }); };
  $('#loadFile').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { send({ type: 'load', state: JSON.parse(await f.text()) }); } catch { toast('That file is not a Bullpen game file'); }
    ev.target.value = '';
  };

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', ev => {
    if (ev.key === 'F1' || ev.key === 'F2' || ev.key === 'F3') { ev.preventDefault(); return setTab(['game', 'teams', 'settings'][+ev.key[1] - 1]); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; ev.preventDefault(); return send({ type: ev.shiftKey ? 'redo' : 'undo' }); }
    if (ev.ctrlKey || ev.metaKey || ev.altKey || tab !== 'game' || !st) return;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = ev.key.toLowerCase();
    const map = {
      b: { type: 'pitch', kind: 'ball' }, s: { type: 'pitch', kind: 'called' }, w: { type: 'pitch', kind: 'swinging' }, f: { type: 'pitch', kind: 'foul' },
      1: { type: 'result', kind: '1b' }, 2: { type: 'result', kind: '2b' }, 3: { type: 'result', kind: '3b' }, h: { type: 'result', kind: 'hr' },
      o: { type: 'result', kind: 'out' }, k: { type: 'result', kind: 'k' }, d: { type: 'result', kind: 'dp' }, g: { type: 'bug' }
    };
    if (map[k]) { ev.preventDefault(); return send(map[k]); }
    if (k === ' ') { ev.preventDefault(); if (st.gfx.preview) send({ type: 'take' }); return; }
    if (k === 'escape') return send({ type: 'clear', slot: 'lower' });
    const pv = { q: 1, p: 2, m: 3, l: 6 }[k];
    if (pv) { const item = libItems()[pv]; preview(withSecs({ ...item[1] })); }
  });

  /* ---------- render ---------- */
  function render() {
    if (!st) return;
    $('#title').textContent = st.meta.title;
    document.title = 'Bullpen CG · ' + st.meta.title;
    $('#undo').disabled = !st.canUndo;
    $('#redo').disabled = !st.canRedo;
    if (tab === 'game') { renderScore(); renderSitu(); renderPeople(); renderAir(); renderLib(); }
    if (tab === 'teams') renderTeams();
    if (tab === 'settings') renderSettings();
  }
  connect();
})();
