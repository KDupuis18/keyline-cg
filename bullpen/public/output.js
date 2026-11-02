/* Bullpen CG output renderer.
   /output              program fill (transparent background)
   /output?key=1        key signal (white graphics on black)
   /output?bg=00ff00    solid background (chroma key)
   /output?preview=1    what is loaded in preview (operator console uses this)
   /output?only=bug     just one layer: bug, lower, full, flash, ticker (comma list)
*/
(function () {
  'use strict';
  const P = new URLSearchParams(location.search);
  const PREVIEW = P.has('preview');
  const ONLY = P.get('only') ? P.get('only').split(',') : null;
  const stage = document.getElementById('stage');
  const e = BP.esc;

  if (P.has('key')) document.body.classList.add('key');
  else if (P.get('bg')) { document.body.classList.add('chroma'); document.body.style.setProperty('--chroma', '#' + P.get('bg').replace(/^#/, '')); }
  if (P.has('checker')) document.body.classList.add('checker');

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  const tv = t => `--c1:${e(t.color)};--c2:${e(t.color2)}`;
  const logo = (t, cls = '') => (t.logo ? `<img class="${cls}" src="${e(t.logo)}" alt="">` : '');

  /* ---------- graphics ---------- */
  function bug(st) {
    const g = st.game, bk = BP.battingKey(g);
    const row = k => {
      const t = st.teams[k];
      return `<div class="row${k === bk && !g.final && !g.transition ? ' batting' : ''}" style="${tv(t)}">
        <div class="logo">${t.logo ? logo(t) : '<b></b>'}</div>
        <div class="abbr">${e(t.abbr)}</div><div class="bat"></div>
        <div class="score tn" data-k="score-${k}">${BP.teamRuns(g, k)}</div></div>`;
    };
    const is = BP.inningState(g);
    const teams = `<div class="bug-teams">${row('away')}${row('home')}</div>`;
    if (g.final) return `<div class="bug">${teams}<div class="bug-final">${e(is.label)}</div></div>`;
    const inn = is.label ? `<div class="inn word">${e(is.label)}</div>` : `<div class="inn"><span class="ar">${is.arrow}</span>${is.num}</div>`;
    const outs = g.transition ? '' : `<div class="outs">${[0, 1, 2].map(i => `<i class="${i < g.outs ? 'on' : ''}"></i>`).join('')}</div>`;
    const b = g.bases, sq = (x, y, on) => `<rect x="${x}" y="${y}" width="17" height="17" transform="rotate(45 ${x + 8.5} ${y + 8.5})" class="${on ? 'on' : ''}"/>`;
    const bases = `<svg viewBox="0 0 74 60">${sq(28.5, 6, b[1])}${sq(51, 28, b[0])}${sq(6, 28, b[2])}</svg>`;
    const p = st.pit[st.teams[BP.fieldingKey(g)].pitcher];
    const count = g.transition ? '' : `<div class="bug-count"><div class="ct tn">${g.balls}-${g.strikes}</div><div class="pc tn">P: ${p ? p.pitches : 0}</div></div>`;
    return `<div class="bug">${teams}<div class="bug-inn">${inn}${outs}</div>${g.transition ? '' : `<div class="bug-bases">${bases}</div>`}${count}</div>`;
  }

  function resolvePlayer(st, spec, role) {
    if (spec.player) {
      for (const k of ['away', 'home']) {
        const p = BP.playerById(st.teams[k], spec.player);
        if (p) return { key: k, team: st.teams[k], player: p };
      }
    }
    return role === 'batter' ? BP.currentBatter(st) : BP.currentPitcher(st, spec.team);
  }

  function batterL3(st, spec) {
    const r = resolvePlayer(st, spec, 'batter'), p = r.player, t = r.team;
    if (!p) return '';
    const slot = t.lineup.find(s => s.id === p.id);
    const pos = (slot && slot.pos) || p.pos;
    const order = slot ? BP.ordinal(t.lineup.indexOf(slot) + 1) : '';
    return `<div class="l3" style="${tv(t)}">
      <div class="l3-badge"><div class="num"><small>#</small>${e(p.num)}</div><div class="abbr">${e(t.abbr)}</div></div>
      <div class="l3-body">
        <div class="l3-head"><div class="l3-name"><span class="first">${e(p.first)}</span><span class="last">${e(p.last)}</span></div>
          <div class="l3-tag">${e(pos)}${p.bats ? ' · Bats ' + e(p.bats) : ''}${order ? ' · ' + order : ''}</div></div>
        <div class="l3-stats">
          <div class="today"><label>TODAY</label><span>${e(BP.todayLine(st.today[p.id]))}</span></div>
          <div><label>AVG</label><span class="tn">${e(BP.fmtAvg(p.avg))}</span></div>
          <div><label>HR</label><span class="tn">${e(BP.fmtNum(p.hr))}</span></div>
          <div><label>RBI</label><span class="tn">${e(BP.fmtNum(p.rbi))}</span></div>
          ${p.ops ? `<div><label>OPS</label><span class="tn">${e(BP.fmtAvg(p.ops))}</span></div>` : ''}
        </div></div></div>`;
  }

  function pitcherL3(st, spec) {
    const r = resolvePlayer(st, spec, 'pitcher'), p = r.player, t = r.team;
    if (!p) return '';
    const g = st.pit[p.id];
    return `<div class="l3" style="${tv(t)}">
      <div class="l3-badge"><div class="num"><small>#</small>${e(p.num)}</div><div class="abbr">${e(t.abbr)}</div></div>
      <div class="l3-body">
        <div class="l3-head"><div class="l3-name"><span class="first">${e(p.first)}</span><span class="last">${e(p.last)}</span></div>
          <div class="l3-tag">${p.throws === 'L' ? 'LHP' : 'RHP'}${g ? ' · ' + g.pitches + ' pitches' : ''}</div></div>
        <div class="l3-stats">
          <div class="today"><label>TODAY</label><span>${e(BP.pitchLine(g))}</span></div>
          <div><label>W-L</label><span class="tn">${e(BP.fmtNum(p.w))}-${e(BP.fmtNum(p.l))}</span></div>
          <div><label>ERA</label><span class="tn">${e(BP.fmtEra(p.era))}</span></div>
          <div><label>K</label><span class="tn">${e(BP.fmtNum(p.so))}</span></div>
          ${p.whip ? `<div><label>WHIP</label><span class="tn">${e(BP.fmtEra(p.whip))}</span></div>` : ''}
        </div></div></div>`;
  }

  function matchup(st) {
    const b = BP.currentBatter(st), pi = BP.currentPitcher(st);
    if (!b.player || !pi.player) return '';
    const bp = b.player, pp = pi.player, pg = st.pit[pp.id];
    return `<div class="mu">
      <div class="mu-side" style="${tv(b.team)}"><div class="stripe"></div><div class="mu-in">
        <div class="mu-role">AT BAT · ${e(b.team.abbr)}</div><div class="mu-name">${e(bp.last)}</div>
        <div class="mu-line tn">${e(BP.fmtAvg(bp.avg))} AVG · ${e(BP.fmtNum(bp.hr))} HR · ${e(BP.todayLine(st.today[bp.id]))}</div></div></div>
      <div class="mu-vs">VS</div>
      <div class="mu-side right" style="${tv(pi.team)}"><div class="stripe"></div><div class="mu-in">
        <div class="mu-role">PITCHING · ${e(pi.team.abbr)}</div><div class="mu-name">${e(pp.last)}</div>
        <div class="mu-line tn">${e(BP.fmtEra(pp.era))} ERA · ${pg ? pg.pitches : 0} pitches today</div></div></div>
    </div>`;
  }

  function dueup(st, spec) {
    const k = spec.team || BP.dueUpKey(st.game), t = st.teams[k];
    const list = BP.dueUp(st, k, 3);
    if (!list.length) return '';
    return `<div class="du" style="${tv(t)}">
      <div class="du-head"><small>DUE UP</small><b>${e(t.name)}</b></div>
      <div class="du-list">${list.map(d => `<div class="du-item">
        <div class="o">${BP.ordinal(d.idx + 1)} · ${e(d.slot.pos)}</div>
        <div class="n">${e(d.player ? d.player.last : '')}</div>
        <div class="t">${e(d.player ? (st.today[d.player.id] && st.today[d.player.id].pa ? BP.todayLine(st.today[d.player.id]) : BP.fmtAvg(d.player.avg) + ' AVG · ' + BP.fmtNum(d.player.hr) + ' HR') : '')}</div>
      </div>`).join('')}</div></div>`;
  }

  function lineTable(st, cls) {
    const g = st.game, n = Math.max(9, BP.lastInning(g));
    const head = `<tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}<th class="tot">R</th><th class="tot">H</th><th class="tot">E</th></tr>`;
    const row = k => {
      const t = st.teams[k];
      return `<tr style="${tv(t)}"><td class="team"><span></span>${e(cls === 'ls' ? t.name.toUpperCase() : t.abbr)}</td>${Array.from({ length: n }, (_, i) => {
        const now = !g.final && !g.transition && i + 1 === g.inning && k === BP.battingKey(g);
        return `<td class="${now ? 'now' : ''}">${BP.lineCell(g, k, i)}</td>`;
      }).join('')}<td class="tot r">${BP.teamRuns(g, k)}</td><td class="tot">${g.hits[k]}</td><td class="tot">${g.errors[k]}</td></tr>`;
    };
    return `<table>${head}${row('away')}${row('home')}</table>`;
  }
  const linescore = st => `<div class="ls">${lineTable(st, 'ls')}</div>`;

  function lt(st, spec) {
    return `<div class="lt"><div class="bar"></div><div class="box"><div class="l1">${e(spec.line1 || '')}</div>${spec.line2 ? `<div class="l2">${e(spec.line2)}</div>` : ''}</div></div>`;
  }

  function pitchcount(st, spec) {
    const r = resolvePlayer(st, spec, 'pitcher'), p = r.player;
    if (!p) return '';
    const g = st.pit[p.id] || { pitches: 0, strikes: 0, balls: 0, bf: 0, outs: 0, so: 0 };
    return `<div class="pcbox" style="${tv(r.team)}"><div class="who"><small>PITCH COUNT</small><b>${e(p.last)}</b></div>
      <div class="cells"><div><label>PITCHES</label><span class="tn">${g.pitches}</span></div>
      <div><label>STRIKES</label><span class="tn">${g.strikes}</span></div><div><label>BALLS</label><span class="tn">${g.balls}</span></div>
      <div><label>IP</label><span class="tn">${BP.ipStr(g.outs)}</span></div><div><label>K</label><span class="tn">${g.so}</span></div></div></div>`;
  }

  function lineup(st, spec) {
    const k = spec.team === 'home' ? 'home' : 'away', t = st.teams[k];
    const sp = BP.playerById(t, t.pitcher);
    return `<div class="card" style="${tv(t)}">
      <div class="card-head">${logo(t)}<div class="t"><small>STARTING LINEUP</small><b>${e(t.city)} ${e(t.name)}</b></div><div class="rec">${e(t.record)}</div></div>
      ${t.lineup.map((s, i) => {
        const p = BP.playerById(t, s.id) || {};
        return `<div class="lu-row"><div class="o">${i + 1}</div><div class="n">${e(p.first ? p.first[0] + '. ' : '')}${e(p.last)}<small>${e(p.bats || '')}</small></div><div class="p">${e(s.pos)}</div><div class="s tn">${e(BP.fmtAvg(p.avg))} · ${e(BP.fmtNum(p.hr))} HR · ${e(BP.fmtNum(p.rbi))} RBI</div></div>`;
      }).join('')}
      ${sp ? `<div class="lu-foot"><label>SP</label><b>${e(BP.fullName(sp))}</b><span class="dim tn">${e(BP.fmtNum(sp.w))}-${e(BP.fmtNum(sp.l))}, ${e(BP.fmtEra(sp.era))} ERA</span></div>` : ''}
    </div>`;
  }

  function scoreboard(st) {
    const g = st.game, is = BP.inningState(g);
    const status = is.label || `${g.half === 'top' ? 'TOP' : 'BOT'} ${BP.ordinal(g.inning).toUpperCase()}`;
    const side = k => {
      const t = st.teams[k];
      return `<div class="sb-team ${k}" style="${tv(t)}">${logo(t)}<div class="nm"><small>${e(t.city)}</small><b>${e(t.name)}</b></div><div class="sc tn">${BP.teamRuns(g, k)}</div></div>`;
    };
    return `<div class="card sb" style="--c1:${e(st.teams.away.color)}">
      <div class="sb-top">${side('away')}<div class="sb-mid"><div class="st">${e(status)}</div><div class="ve">${e(st.meta.venue || '')}</div></div>${side('home')}</div>
      <div class="sb-ls">${lineTable(st, 'sb')}</div></div>`;
  }

  function flash(st, spec) {
    if (spec.type === 'pitchspeed') {
      return `<div class="flash"><div class="tag">PITCH</div><div class="msg"><b class="tn">${e(spec.mph || '')}</b>MPH${spec.pitch ? `<small>${e(spec.pitch).toUpperCase()}</small>` : ''}</div></div>`;
    }
    return `<div class="flash"><div class="msg">${e(spec.text || '').toUpperCase()}</div></div>`;
  }

  const BUILD = { batter: batterL3, pitcher: pitcherL3, matchup, dueup, linescore, lt, pitchcount, lineup, scoreboard, flash, pitchspeed: flash };
  const build = (st, spec) => (spec && BUILD[spec.type] ? BUILD[spec.type](st, spec) : '');

  function ticker(st) {
    const items = st.gfx.ticker.items.split('\n').map(s => s.trim()).filter(Boolean);
    if (!items.length) return '';
    const run = items.map(i => `<span>${e(i)}</span>`).join('<i></i>') + '<i></i>';
    return `<div class="ticker"><div class="lab">${e(st.gfx.ticker.label)}</div><div class="win"><div class="track">${run}${run}</div></div></div>`;
  }

  /* ---------- layer manager ---------- */
  const layers = {};
  function show(name, key, html) {
    if (ONLY && !ONLY.includes(name)) { key = null; html = ''; }
    let L = layers[name];
    if (!html) key = null;
    if (L && L.key === key) {
      if (key && L.html !== html) { L.el.innerHTML = html; L.html = html; }
      return L;
    }
    if (L) {
      const old = L.el; old.classList.add('out');
      setTimeout(() => old.remove(), 450);
      delete layers[name];
    }
    if (!key) return null;
    const el = document.createElement('div');
    el.className = 'slot slot-' + name;
    el.innerHTML = html;
    stage.appendChild(el);
    return (layers[name] = { key, el, html });
  }

  /* scores that changed since the last render flash in the accent color */
  let lastScores = null;
  function popScores(st) {
    const now = { away: BP.teamRuns(st.game, 'away'), home: BP.teamRuns(st.game, 'home') };
    if (lastScores && layers.bug) for (const k of ['away', 'home']) {
      if (now[k] !== lastScores[k]) {
        const el = layers.bug.el.querySelector(`[data-k="score-${k}"]`);
        if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      }
    }
    lastScores = now;
  }

  /* ticker crawl runs on rAF so its speed is constant whatever the text length */
  let tx = 0, lastT = 0, tickHalf = 0;
  function crawl(t) {
    const L = layers.ticker;
    if (L) {
      const track = L.el.querySelector('.track');
      if (track) {
        if (!tickHalf) { tickHalf = track.scrollWidth / 2; tx = L.el.querySelector('.win').clientWidth; }
        tx -= Math.min(64, t - lastT) * 0.14;
        if (tx < -tickHalf) tx += tickHalf;
        track.style.transform = `translateX(${tx}px)`;
      }
    }
    lastT = t;
    requestAnimationFrame(crawl);
  }
  requestAnimationFrame(crawl);

  function render(st) {
    stage.style.setProperty('--accent', st.theme.accent);
    stage.style.setProperty('--panel', st.theme.panel);
    stage.className = 'pos-' + (st.theme.bugPos || 'tl');
    const gx = st.gfx;
    show('bug', gx.bug ? 'bug' : null, gx.bug ? bug(st) : '');
    if (PREVIEW) {
      const pv = gx.preview;
      for (const s of ['lower', 'full', 'flash']) show(s, pv && pv.slot === s ? pv.id : null, pv && pv.slot === s ? build(st, pv) : '');
      show('ticker', null, '');
    } else {
      for (const s of ['lower', 'full', 'flash']) show(s, gx[s] ? gx[s].id : null, build(st, gx[s]));
      const tk = gx.ticker.on ? ticker(st) : '';
      const before = layers.ticker && layers.ticker.html;
      show('ticker', gx.ticker.on ? 'ticker' : null, tk);
      if (!layers.ticker || layers.ticker.html !== before) tickHalf = 0;
    }
    stage.classList.toggle('has-ticker', !PREVIEW && gx.ticker.on && !(ONLY && !ONLY.includes('ticker')));
    popScores(st);
  }

  function connect() {
    const es = new EventSource('/events');
    es.onmessage = m => { try { render(JSON.parse(m.data)); } catch (err) { console.error(err); } };
  }
  document.fonts.load('700 40px "Barlow Condensed"').finally(connect);
})();
