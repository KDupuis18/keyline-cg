/* Baseball mode (F5): the scoring console. It talks to the editor only through `ctx`:
   ctx.get()            current game state (project.baseball)
   ctx.dispatch(action) apply a scoring action (undoable)
   ctx.takes()          rundown takes: [{ t, scene, linked, onAir }]
   ctx.take(t) / ctx.out(t)
   ctx.toast(msg), ctx.addStarter(), ctx.openLayout(sceneId), ctx.pgmSlot (element for the program monitor) */
(function (root) {
  'use strict';
  const S = root.BP, e = S.esc;
  let ctx = null, view = 'game', mounted = null, teamsDirty = false;

  const tv = t => `--c1:${e(t.color)};--c2:${e(t.color2)}`;
  const focusedIn = el => el && el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  const act = a => ctx.dispatch(a);

  function shell(root) {
    root.innerHTML = `
      <div class="tabs bb-tabs">
        <button class="tab on" data-view="game">Game</button><button class="tab" data-view="teams">Teams &amp; rosters</button><button class="tab" data-view="setup">Graphics setup &amp; fields</button>
        <span class="bb-sp"></span><span class="bb-undo"><button class="mini" data-bb="undo" title="Undo the last scoring action (Ctrl/Cmd+Z in this mode)">↶ Undo play</button><button class="mini" data-bb="redo">↷ Redo</button></span>
      </div>
      <div class="bb-view" id="bbGame">
        <div class="col">
          <section class="panel" style="flex:none"><div class="ph">Score</div><div class="pb pad" id="bbScore"></div></section>
          <section class="panel" style="flex:none"><div class="ph">Situation <span class="bb-inn" id="bbInn"></span></div><div class="pb pad">
            <div class="bb-situ"><div class="bb-dia" id="bbDia"></div><div class="bb-counts" id="bbCounts"></div></div>
            <div class="bb-row"><button class="tbtn" data-act='{"type":"endHalf"}'>End half-inning</button><button class="tbtn" id="bbFinal" data-act='{"type":"final"}'>Final</button>
              <button class="tbtn" data-bb="innDown" title="Back a half-inning">◀ Half</button><button class="tbtn" data-bb="innUp" title="Forward a half-inning">Half ▶</button></div>
          </div></section>
          <section class="panel" style="flex:1"><div class="ph">Pitch &amp; result</div><div class="pb pad">
            <div class="bb-pitch">
              <button class="bb-b ball" data-act='{"type":"pitch","kind":"ball"}'>BALL<kbd>B</kbd></button>
              <button class="bb-b strike" data-act='{"type":"pitch","kind":"called"}'>CALLED STRIKE<kbd>S</kbd></button>
              <button class="bb-b strike" data-act='{"type":"pitch","kind":"swinging"}'>SWINGING<kbd>W</kbd></button>
              <button class="bb-b foul" data-act='{"type":"pitch","kind":"foul"}'>FOUL<kbd>F</kbd></button>
            </div>
            <div class="bb-res">
              ${[['1b', '1B', 'hit', '1'], ['2b', '2B', 'hit', '2'], ['3b', '3B', 'hit', '3'], ['hr', 'HR', 'hr', 'H'], ['out', 'OUT', 'out', 'O'], ['k', 'K', 'out', 'K'], ['dp', 'DP', 'out', 'D'], ['sac', 'SAC', 'out'], ['bb', 'BB', 'on'], ['ibb', 'IBB', 'on'], ['hbp', 'HBP', 'on'], ['e', 'E', 'on'], ['fc', 'FC', 'on']]
                .map(([k, l, c, key]) => `<button class="bb-b ${c}" data-res="${k}">${l}${key ? `<kbd>${key}</kbd>` : ''}</button>`).join('')}
              <button class="bb-b out wide" data-act='{"type":"runnerOut"}' title="Caught stealing, pickoff… (the at-bat continues)">RUNNER OUT</button>
            </div>
            <p class="bb-note">Runners move by the usual defaults. Click a base or use the run buttons for anything unusual.</p>
            <div class="bb-last" id="bbLast"></div>
          </div></section>
        </div>
        <div class="col">
          <section class="panel bb-pgm"><div class="ph"><span class="tally r" id="bbTally"></span>Program<span class="sp"></span><span class="hint">Same output as Sequence mode</span></div><div class="bb-pgmslot" id="bbPgmSlot"></div></section>
          <div class="bb-two"><section class="panel" id="bbAtBat"></section><section class="panel" id="bbMound"></section></div>
          <section class="panel" style="flex:none"><div class="ph">Batting order <span class="hint" id="bbOrderTeam"></span></div><div class="pb pad bb-order" id="bbOrder"></div></section>
        </div>
        <div class="col">
          <section class="panel" style="flex:1"><div class="ph">Graphics<span class="sp"></span><span class="hint">Takes from the rundown</span></div><div class="pb" id="bbTakes"></div></section>
          <section class="panel" style="flex:none"><div class="ph">Pitch speed</div><div class="pb pad">
            <div class="bb-row" style="margin:0"><input class="in" id="bbMph" type="number" min="40" max="110" placeholder="MPH" style="width:70px">
              <select class="in" id="bbPitchType"><option value="">(type)</option>${['4-Seam', '2-Seam', 'Sinker', 'Cutter', 'Slider', 'Sweeper', 'Curveball', 'Changeup', 'Splitter', 'Knuckleball'].map(x => `<option>${x}</option>`).join('')}</select>
              <button class="tbtn take" id="bbMphGo" title="Sets pitch.mph / pitch.type and takes the pitch speed graphic">SHOW</button></div>
            <p class="bb-note" id="bbMphNote"></p>
          </div></section>
        </div>
      </div>
      <div class="bb-view" id="bbTeams" hidden></div>
      <div class="bb-view" id="bbSetup" hidden></div>`;

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.querySelector('#bbTeams').addEventListener('focusout', () => setTimeout(() => { if (teamsDirty && view === 'teams') renderTeams(); }, 0));
    const go = () => {
      const st = ctx.get(), v = root.querySelector('#bbMph').value;
      if (!v) return ctx.toast('Type the pitch speed first');
      act({ type: 'pitchInfo', mph: v, pitch: root.querySelector('#bbPitchType').value });
      const t = ctx.findTake(st.auto.pitchTake);
      if (t) ctx.take(t, st.auto.pitchSecs); else ctx.toast('Pitch speed set. Choose a pitch speed graphic in Graphics setup to show it automatically.');
      root.querySelector('#bbMph').select();
    };
    root.querySelector('#bbMphGo').onclick = go;
    root.querySelector('#bbMph').addEventListener('keydown', ev => { if (ev.key === 'Enter') go(); });
  }

  function onClick(ev) {
    const st = ctx.get(), g = st.game;
    const tab = ev.target.closest('[data-view]');
    if (tab) { view = tab.dataset.view; render(); return; }
    const a = ev.target.closest('[data-act]');
    if (a) return act(JSON.parse(a.dataset.act));
    const r = ev.target.closest('[data-res]');
    if (r) return act({ type: 'result', kind: r.dataset.res });
    const base = ev.target.closest('[data-base]');
    if (base) return act({ type: 'base', base: +base.dataset.base });
    const set = ev.target.closest('[data-set]');
    if (set) return act(JSON.parse(set.dataset.set));
    const tk = ev.target.closest('[data-take]');
    if (tk) { const t = ctx.findTake(tk.dataset.take); if (t) (tk.dataset.on ? ctx.out(t) : ctx.take(t)); return; }
    const ed = ev.target.closest('[data-edit]');
    if (ed) return ctx.openLayout(ed.dataset.edit);
    const mv = ev.target.closest('[data-move]');
    if (mv) {
      const k = mv.dataset.team, i = +mv.dataset.move, j = i + +mv.dataset.dir, lu = st.teams[k].lineup.slice();
      if (j < 0 || j >= lu.length) return;
      [lu[i], lu[j]] = [lu[j], lu[i]];
      return act({ type: 'lineup', team: k, lineup: lu });
    }
    const cp = ev.target.closest('[data-copy]');
    if (cp) { navigator.clipboard.writeText(cp.dataset.copy).then(() => ctx.toast('Copied ' + cp.dataset.copy), () => {}); return; }
    const b = ev.target.closest('[data-bb]');
    if (!b) return;
    switch (b.dataset.bb) {
      case 'undo': return ctx.undo();
      case 'redo': return ctx.redo();
      case 'innUp': return act(g.half === 'top' ? { type: 'inning', inning: g.inning, half: 'bottom' } : { type: 'inning', inning: g.inning + 1, half: 'top' });
      case 'innDown': return act(g.half === 'bottom' ? { type: 'inning', inning: g.inning, half: 'top' } : { type: 'inning', inning: Math.max(1, g.inning - 1), half: 'bottom' });
      case 'starter': return ctx.addStarter();
      case 'reset': if (confirm("Start a new game? The score, count and today's stats reset. Teams, rosters and lineups stay. Undo play brings it back.")) act({ type: 'resetGame' }); return;
    }
  }

  async function onChange(ev) {
    const el = ev.target, k = el.dataset.team;
    if (el.id === 'bbPitcherSel') { if (el.value) act({ type: 'pitcher', team: el.dataset.team, id: el.value }); return; }
    if (el.dataset.tf) return act({ type: 'team', team: k, fields: { [el.dataset.tf]: el.value } });
    if (el.dataset.pf) return act({ type: 'player', team: k, id: el.dataset.pid, fields: { [el.dataset.pf]: el.value } });
    if (el.dataset.pitcher) return act({ type: 'pitcher', team: el.dataset.pitcher, id: el.value });
    if (el.dataset.lu != null) return act({ type: 'lineup', team: k, index: +el.dataset.lu, id: el.value });
    if (el.dataset.lupos != null) { const s = ctx.get().teams[k].lineup[+el.dataset.lupos]; return act({ type: 'lineup', team: k, index: +el.dataset.lupos, id: s.id, pos: el.value.toUpperCase() }); }
    if (el.dataset.meta) return act({ type: 'meta', fields: { [el.dataset.meta]: el.value } });
    if (el.dataset.auto) return act({ type: 'auto', [el.dataset.auto]: el.value });
    if (el.dataset.logo) {
      const f = el.files[0]; if (!f) return;
      if (f.size > 1.5e6) return ctx.toast('That logo is over 1.5 MB. Use a smaller PNG or SVG.');
      const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
      return act({ type: 'team', team: el.dataset.logo, fields: { logo: url } });
    }
    if (el.dataset.csv) {
      const f = el.files[0]; if (!f) return;
      const t = ctx.get().teams[el.dataset.csv];
      if (!confirm(`Replace the ${t.name} roster and batting order with ${f.name}?`)) { el.value = ''; return; }
      act({ type: 'roster', team: el.dataset.csv, csv: await f.text() });
      el.value = '';
    }
  }

  /* ---------- game view ---------- */
  function renderScore(st) {
    const g = st.game, bk = S.battingKey(g);
    const row = k => {
      const t = st.teams[k];
      const pm = (type, d, l) => `<button class="mini" data-act='{"type":"${type}","team":"${k}","delta":${d}}'>${l}</button>`;
      return `<tr style="${tv(t)}"><td class="bb-tm"><i></i>${e(t.abbr)}${k === bk && !g.final ? ' <span class="bb-up">●</span>' : ''}</td>
        <td class="bb-big">${S.teamRuns(g, k)}</td><td>${pm('runs', 1, '+1')}${pm('runs', -1, '−1')}</td>
        <td class="bb-n">${g.hits[k]}</td><td>${pm('hits', 1, '+')}${pm('hits', -1, '−')}</td>
        <td class="bb-n">${g.errors[k]}</td><td>${pm('errors', 1, '+')}${pm('errors', -1, '−')}</td></tr>`;
    };
    const n = Math.max(9, S.lastInning(g));
    const ls = `<table class="bb-ls"><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}</tr>${['away', 'home'].map(k => `<tr><td>${e(st.teams[k].abbr)}</td>${Array.from({ length: n }, (_, i) => `<td>${S.lineCell(g, k, i)}</td>`).join('')}</tr>`).join('')}</table>`;
    mounted.querySelector('#bbScore').innerHTML = `<table class="bb-st"><tr><th></th><th>R</th><th></th><th>H</th><th></th><th>E</th><th></th></tr>${row('away')}${row('home')}</table>${ls}`;
  }
  function renderSitu(st) {
    const g = st.game, is = S.inningState(g);
    mounted.querySelector('#bbInn').textContent = is.label || `${is.arrow} ${S.ordinal(g.inning)}`;
    mounted.querySelector('#bbDia').innerHTML = [[1, 'b2', 'Second'], [0, 'b1', 'First'], [2, 'b3', 'Third']].map(([i, c, n]) => `<div class="bb-base ${c}${g.bases[i] ? ' on' : ''}" data-base="${i}" title="${n} base"></div>`).join('') + '<div class="bb-home"></div>';
    const dots = (v, max, cls, mk) => Array.from({ length: max }, (_, i) => `<i class="${cls}${i < v ? ' on' : ''}" data-set='${JSON.stringify(mk(i < v ? i : i + 1))}'></i>`).join('');
    mounted.querySelector('#bbCounts').innerHTML = `
      <div><label>Balls</label>${dots(g.balls, 3, 'b', v => ({ type: 'count', balls: v }))}</div>
      <div><label>Strikes</label>${dots(g.strikes, 2, 's', v => ({ type: 'count', strikes: v }))}</div>
      <div><label>Outs</label>${dots(g.outs, 2, 'o', v => ({ type: 'outs', value: v }))}</div>`;
    const fb = mounted.querySelector('#bbFinal');
    fb.classList.toggle('on', g.final); fb.textContent = g.final ? 'Final ✓' : 'Final';
    mounted.querySelector('#bbLast').textContent = g.lastPlay || 'No plays yet.';
  }
  function renderPeople(st) {
    const b = S.currentBatter(st), p = S.currentPitcher(st), bp = b.player, pp = p.player, ps = pp && st.pit[pp.id];
    mounted.querySelector('#bbAtBat').innerHTML = `<div class="ph">At bat <span class="hint">${e(b.team.abbr)} · ${S.ordinal(b.idx + 1)}</span><span class="sp"></span>
        <button class="mini" data-act='{"type":"batter","delta":-1}'>◀ Prev</button><button class="mini" data-act='{"type":"batter","delta":1}'>Next ▶</button></div>
      <div class="pb pad">${bp ? `<div class="bb-who" style="${tv(b.team)}"><div class="n">${e(bp.num)}</div><div><b>${e(S.fullName(bp))}</b>
        <small>${e(b.slot.pos)} · ${e(S.fmtAvg(bp.avg))} · ${e(S.fmtNum(bp.hr))} HR · ${e(S.fmtNum(bp.rbi))} RBI</small><small>Today: ${e(S.todayLine(st.today[bp.id]))}</small></div></div>` : '<p class="bb-note">No batting order for this team. Set one in Teams &amp; rosters.</p>'}</div>`;
    const others = st.teams[p.key].roster.filter(x => !pp || x.id !== pp.id).sort((x, y) => S.isPitcher(y) - S.isPitcher(x));
    mounted.querySelector('#bbMound').innerHTML = `<div class="ph">Pitching <span class="hint">${e(p.team.abbr)}</span><span class="sp"></span>
        <select class="in" id="bbPitcherSel" data-team="${p.key}" style="height:20px;max-width:150px"><option value="">Pitching change…</option>${others.map(x => `<option value="${e(x.id)}">${e(x.num)} ${e(S.fullName(x))}${S.isPitcher(x) ? '' : ' (' + e(x.pos) + ')'}</option>`).join('')}</select></div>
      <div class="pb pad">${pp ? `<div class="bb-who" style="${tv(p.team)}"><div class="n">${e(pp.num)}</div><div><b>${e(S.fullName(pp))}</b>
        <small>${e(S.pitchLine(ps))}</small><small>${e(S.fmtEra(pp.era))} ERA · ${ps ? ps.strikes : 0} strikes</small></div>
        <div class="bb-pc">${ps ? ps.pitches : 0}<small>PITCHES</small></div></div>` : '<p class="bb-note">No pitcher set.</p>'}</div>`;
    const t = b.team;
    mounted.querySelector('#bbOrderTeam').textContent = `${t.city} ${t.name} · click to set who's up`;
    mounted.querySelector('#bbOrder').innerHTML = t.lineup.map((s, i) => {
      const pl = S.playerById(t, s.id) || {}, td = st.today[s.id];
      return `<button class="mini${i === t.up ? ' on' : ''}" data-act='{"type":"batter","index":${i}}'><b>${i + 1}</b> ${e(pl.last || '?')}<span>${td && td.pa ? td.h + '-' + td.ab : e(s.pos)}</span></button>`;
    }).join('');
  }
  function renderTakes(st) {
    const list = ctx.takes();
    const live = list.filter(x => x.linked), rest = list.filter(x => !x.linked);
    const row = x => `<tr class="${x.onAir ? 'air' : ''}"><td class="num">${String(x.t.num).padStart(4, '0')}</td><td title="${e(x.scene)}">${e(x.t.name)}${st.auto.batterTake === x.t.id ? ' <span class="pill pvw" title="Taken automatically for each new batter">AUTO</span>' : ''}</td>
      <td class="bb-tk">${x.onAir ? `<button class="mini on" data-take="${e(x.t.id)}" data-on="1">OUT</button>` : `<button class="mini bb-go" data-take="${e(x.t.id)}">TAKE</button>`}</td></tr>`;
    mounted.querySelector('#bbTakes').innerHTML = (live.length ? `<table class="grid"><colgroup><col style="width:46px"><col><col style="width:62px"></colgroup><tbody>${live.map(row).join('')}</tbody></table>`
      : `<div class="pb pad"><p class="bb-note">No takes are linked to the game yet.</p><button class="tbtn on" data-bb="starter">Add starter baseball graphics</button><p class="bb-note">Adds a scorebug, batter and pitcher lower thirds, due up, linescore, pitch speed and both lineups. They're ordinary scenes you can redesign in Layout mode.</p></div>`)
      + (rest.length ? `<div class="ph sub">Other takes</div><table class="grid"><colgroup><col style="width:46px"><col><col style="width:62px"></colgroup><tbody>${rest.map(row).join('')}</tbody></table>` : '');
    const pt = ctx.findTake(st.auto.pitchTake);
    mounted.querySelector('#bbMphNote').textContent = pt ? `Shows ${pt.name}${st.auto.pitchSecs ? ` for ${st.auto.pitchSecs} s` : ''}.` : 'No pitch speed graphic chosen (Graphics setup).';
  }

  /* ---------- teams ---------- */
  const RCOLS = [['num', '#', 36], ['first', 'First', 80], ['last', 'Last', 96], ['pos', 'Pos', 38], ['bats', 'B', 26], ['throws', 'T', 26], ['avg', 'AVG', 46], ['hr', 'HR', 34], ['rbi', 'RBI', 36], ['ops', 'OPS', 46], ['w', 'W', 28], ['l', 'L', 28], ['era', 'ERA', 42], ['so', 'K', 34], ['whip', 'WHIP', 42], ['photo', 'Photo URL', 110]];
  const TEMPLATE = 'num,first,last,pos,bats,throws,avg,hr,rbi,ops,w,l,era,so,whip,photo\n2,Marcus,Delgado,SS,R,R,.291,14,58,.812,,,,,,\n41,Nate,Corrigan,P,R,R,,,,,11,5,3.08,141,1.11,\n';
  function renderTeams() {
    const box = mounted.querySelector('#bbTeams');
    if (focusedIn(box)) { teamsDirty = true; return; }
    teamsDirty = false;
    const st = ctx.get();
    box.innerHTML = ['away', 'home'].map(k => {
      const t = st.teams[k];
      const opts = sel => t.roster.map(p => `<option value="${e(p.id)}"${p.id === sel ? ' selected' : ''}>${e(p.num)} ${e(S.fullName(p))}</option>`).join('');
      const lu = t.lineup.map((s, i) => `<b>${i + 1}</b><select class="in" data-lu="${i}" data-team="${k}">${opts(s.id)}<option value="">(remove)</option></select>
        <input class="in" data-lupos="${i}" data-team="${k}" value="${e(s.pos)}" placeholder="Pos"><span><button class="mini" data-move="${i}" data-dir="-1" data-team="${k}">↑</button><button class="mini" data-move="${i}" data-dir="1" data-team="${k}">↓</button></span>`).join('')
        + (t.lineup.length < 9 ? `<b></b><select class="in" data-lu="${t.lineup.length}" data-team="${k}"><option value="">+ add to the order…</option>${opts('')}</select><span></span><span></span>` : '');
      const rows = t.roster.map(p => `<tr>${RCOLS.map(([f, , w]) => `<td><input class="in" style="width:${w}px" data-pf="${f}" data-pid="${e(p.id)}" data-team="${k}" value="${e(p[f] || '')}"></td>`).join('')}
        <td><button class="mini danger" title="Remove player" data-act='${e(JSON.stringify({ type: 'removePlayer', team: k, id: p.id }))}'>✕</button></td></tr>`).join('');
      return `<section class="panel" style="${tv(t)}"><div class="ph"><i class="bb-chip"></i>${k === 'away' ? 'Away' : 'Home'} team</div><div class="pb pad">
        <div class="fgrid bb-tform">
          <span class="fl">City</span><input class="in" data-tf="city" data-team="${k}" value="${e(t.city)}">
          <span class="fl">Name</span><input class="in" data-tf="name" data-team="${k}" value="${e(t.name)}">
          <span class="fl">Abbreviation</span><input class="in" data-tf="abbr" data-team="${k}" value="${e(t.abbr)}" maxlength="4">
          <span class="fl">Record</span><input class="in" data-tf="record" data-team="${k}" value="${e(t.record)}" placeholder="52-38">
          <span class="fl">Colors</span><span class="krow"><input type="color" data-tf="color" data-team="${k}" value="${e(t.color)}"><input type="color" data-tf="color2" data-team="${k}" value="${e(t.color2)}"></span>
          <span class="fl">Logo</span><span class="krow"><span class="bb-logo" style="background-image:${t.logo ? `url('${e(t.logo)}')` : 'none'}"></span>
            <label class="tbtn bb-file">Choose…<input type="file" accept="image/*" data-logo="${k}" hidden></label>
            ${t.logo ? `<button class="mini" data-act='${e(JSON.stringify({ type: 'team', team: k, fields: { logo: '' } }))}'>Remove</button>` : ''}</span>
          <span class="fl">Pitching now</span><select class="in" data-pitcher="${k}">${opts(t.pitcher)}</select>
        </div>
        <h4>Batting order</h4><div class="bb-lu">${lu}</div>
        <h4>Roster <span class="bb-note">${t.roster.length} players · changes save as you type</span></h4>
        <div class="bb-row" style="margin:0 0 4px">
          <button class="mini" data-act='${e(JSON.stringify({ type: 'addPlayer', team: k }))}'>+ Add player</button>
          <label class="mini bb-file">Import CSV…<input type="file" accept=".csv,text/csv" data-csv="${k}" hidden></label>
          <a class="mini bb-file" download="roster-template.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}">CSV template</a>
        </div>
        <div class="bb-roster"><table class="grid"><thead><tr>${RCOLS.map(([, l, w]) => `<th style="width:${w + 10}px">${l}</th>`).join('')}<th style="width:30px"></th></tr></thead><tbody>${rows}</tbody></table></div>
      </div></section>`;
    }).join('');
  }

  /* ---------- graphics setup & field reference ---------- */
  function renderSetup() {
    const box = mounted.querySelector('#bbSetup');
    if (focusedIn(box)) return;
    const st = ctx.get(), takes = ctx.takes();
    const sel = (key, cur) => `<select class="in" data-auto="${key}"><option value="">(none)</option>${takes.map(x => `<option value="${e(x.t.id)}"${x.t.id === cur ? ' selected' : ''}>${String(x.t.num).padStart(4, '0')} ${e(x.t.name)}</option>`).join('')}</select>`;
    const fields = ctx.fields();
    box.innerHTML = `<div class="col">
      <section class="panel" style="flex:none"><div class="ph">Game</div><div class="pb pad"><div class="fgrid" style="grid-template-columns:150px minmax(0,1fr)">
        <span class="fl">Title</span><input class="in" data-meta="title" value="${e(st.meta.title)}">
        <span class="fl">Venue</span><input class="in" data-meta="venue" value="${e(st.meta.venue)}">
        <span class="fl">Runner / out lights</span><span class="krow"><input type="color" data-meta="accent" value="${e(st.meta.accent || '#f3b61f')}"><span class="bb-note">Color of lit bases and outs in bases.img and outs.img</span></span>
        <span class="fl">New game</span><span><button class="tbtn" data-bb="reset">New game (keep rosters)</button></span>
      </div></div></section>
      <section class="panel" style="flex:none"><div class="ph">Automatic graphics</div><div class="pb pad"><div class="fgrid" style="grid-template-columns:150px minmax(0,1fr) 70px 20px">
        <span class="fl">New batter</span>${sel('batterTake', st.auto.batterTake)}<input class="in" type="number" min="0" max="120" data-auto="batterSecs" value="${e(st.auto.batterSecs)}"><span>s</span>
        <span class="fl">Pitch speed</span>${sel('pitchTake', st.auto.pitchTake)}<input class="in" type="number" min="0" max="120" data-auto="pitchSecs" value="${e(st.auto.pitchSecs)}"><span>s</span>
      </div><p class="bb-note">New batter: taken each time a plate appearance ends and someone new comes up. Pitch speed: taken when you press SHOW. Seconds = how long it stays on (0 = until cleared).</p>
      <div class="bb-row"><button class="tbtn" data-bb="starter">Add starter baseball graphics</button>${ctx.starterScenes().map(s => `<button class="mini" data-edit="${e(s.id)}" title="Open in Layout mode">Edit ${e(s.name)}</button>`).join('')}</div></div></section>
      <section class="panel" style="flex:1"><div class="ph">Live fields<span class="sp"></span><span class="hint">Link any text, image or quad: Sequence › Template Data › DL › source "Baseball (live game)"</span></div>
        <div class="pb"><table class="grid bb-fields"><colgroup><col style="width:170px"><col style="width:40%"><col></colgroup><thead><tr><th>Field</th><th>Value now</th><th>About</th></tr></thead><tbody>
        ${fields.map(([f, v, a]) => `<tr><td><button class="mini" data-copy="${e(f)}" title="Copy field name">${e(f)}</button></td><td>${/^data:image/.test(v) ? `<img src="${e(v)}" alt="" style="height:18px;background:#1b2430;vertical-align:middle">` : e(v.length > 60 ? v.slice(0, 60) + '…' : v)}</td><td class="bb-about">${e(a)}</td></tr>`).join('')}
        </tbody></table></div></section></div>`;
  }

  function render() {
    if (!mounted || !ctx || mounted.hidden) return; // only while Baseball mode is showing

    const st = ctx.get();
    mounted.querySelectorAll('.bb-tabs [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    mounted.querySelector('#bbGame').hidden = view !== 'game';
    mounted.querySelector('#bbTeams').hidden = view !== 'teams';
    mounted.querySelector('#bbSetup').hidden = view !== 'setup';
    const u = ctx.canUndo();
    mounted.querySelector('[data-bb="undo"]').disabled = !u.undo;
    mounted.querySelector('[data-bb="redo"]').disabled = !u.redo;
    if (view === 'game') { renderScore(st); renderSitu(st); renderPeople(st); renderTakes(st); }
    if (view === 'teams') renderTeams();
    if (view === 'setup') renderSetup();
  }

  /* keyboard: returns true when handled */
  const KEYS = {
    b: { type: 'pitch', kind: 'ball' }, s: { type: 'pitch', kind: 'called' }, w: { type: 'pitch', kind: 'swinging' }, f: { type: 'pitch', kind: 'foul' },
    1: { type: 'result', kind: '1b' }, 2: { type: 'result', kind: '2b' }, 3: { type: 'result', kind: '3b' }, h: { type: 'result', kind: 'hr' },
    o: { type: 'result', kind: 'out' }, k: { type: 'result', kind: 'k' }, d: { type: 'result', kind: 'dp' }
  };
  function key(ev) {
    if (view !== 'game' || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
    const a = KEYS[ev.key.toLowerCase()];
    if (!a) return false;
    ev.preventDefault(); act(a); return true;
  }

  function mount(rootEl, context) { ctx = context; mounted = rootEl; shell(rootEl); }
  const pgmSlot = () => mounted && mounted.querySelector('#bbPgmSlot');
  root.BBConsole = { mount, render, key, pgmSlot, setView: v => { view = v; render(); } };
})(typeof self !== 'undefined' ? self : this);
