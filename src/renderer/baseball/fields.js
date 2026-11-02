/* Baseball → DataLinq. Turns the game state into rows of Field / Value / About so any
   Keyline object can link to it: row "Field=bat.last", column "Value". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./shared.js'));
  else root.BBFields = factory(root.BP);
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';
  const SOURCE_ID = 'baseball';
  const svg = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
  const yes = b => (b ? '1' : '');

  /* Runner diamond and outs dots as images, so a design can drop them in with one Image object. */
  function basesImg(b, on) {
    const sq = (x, y, lit) => `<rect x='${x}' y='${y}' width='34' height='34' rx='3' transform='rotate(45 ${x + 17} ${y + 17})' fill='${lit ? on : 'none'}' stroke='${lit ? on : '#ffffff'}' stroke-opacity='${lit ? 1 : 0.7}' stroke-width='4'/>`;
    return svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 120'>${sq(58, 10, b[1])}${sq(103, 54, b[0])}${sq(13, 54, b[2])}</svg>`);
  }
  function outsImg(n, on) {
    return svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 28'>${[0, 1, 2].map(i => `<circle cx='${14 + i * 34}' cy='14' r='10' fill='${i < n ? on : 'none'}' stroke='${i < n ? on : '#ffffff'}' stroke-opacity='${i < n ? 1 : 0.7}' stroke-width='3'/>`).join('')}</svg>`);
  }
  function runnersText(b) {
    const n = b.filter(Boolean).length;
    if (!n) return 'Bases empty';
    if (n === 3) return 'Bases loaded';
    const names = ['1st', '2nd', '3rd'].filter((_, i) => b[i]);
    return n === 1 ? 'Runner on ' + names[0] : 'Runners on ' + names.join(' & ');
  }
  const posOrdinal = i => S.ordinal(i + 1).toUpperCase();

  function build(st) {
    const out = [];
    const F = (k, v, about) => out.push([k, v == null ? '' : String(v), about || '']);
    const g = st.game, bk = S.battingKey(g), fk = S.fieldingKey(g);
    const accent = (st.meta && st.meta.accent) || '#f3b61f';
    const is = S.inningState(g);

    /* game */
    F('title', st.meta && st.meta.title, 'Game title');
    F('venue', st.meta && st.meta.venue, 'Venue');
    F('inning', g.inning, 'Inning number');
    F('half', g.half === 'top' ? 'TOP' : 'BOT', 'TOP or BOT');
    F('arrow', is.label ? '' : is.arrow, '▲ or ▼ (blank between halves)');
    F('inning.label', is.label || `${is.arrow} ${is.num}`, '▲ 7, MID 7, END 7, FINAL, F/10');
    F('inning.ordinal', S.ordinal(g.inning).toUpperCase(), '7TH');
    F('inning.status', is.label || `${g.half === 'top' ? 'TOP' : 'BOT'} ${S.ordinal(g.inning).toUpperCase()}`, 'TOP 7TH, MID 7, FINAL');
    F('balls', g.balls); F('strikes', g.strikes);
    F('count', `${g.balls}-${g.strikes}`, 'Balls-strikes, e.g. 2-1');
    F('outs', g.outs);
    F('outs.text', `${g.outs} OUT${g.outs === 1 ? '' : 'S'}`, '1 OUT, 2 OUTS');
    F('outs.img', outsImg(g.outs, accent), 'Image: three out lights');
    F('base1', yes(g.bases[0]), '1 when a runner is on first (use with "Show only when")');
    F('base2', yes(g.bases[1]), '1 when a runner is on second');
    F('base3', yes(g.bases[2]), '1 when a runner is on third');
    F('bases.img', basesImg(g.bases, accent), 'Image: runner diamond');
    F('runners', runnersText(g.bases), 'Runners on 1st & 3rd');
    F('live', yes(!g.final && !g.transition), '1 during play; blank between halves and after the final');
    F('break', yes(g.transition && !g.final), '1 between half-innings');
    F('final', yes(g.final), '1 when the game is final');
    F('lastPlay', g.lastPlay, 'Last play description');
    F('pitch.mph', g.pitchMph, 'Last pitch speed entered');
    F('pitch.type', (g.pitchType || '').toUpperCase(), 'Last pitch type entered');

    /* teams */
    const n = Math.max(9, S.lastInning(g));
    for (const k of ['away', 'home']) {
      const t = st.teams[k];
      F(k + '.name', t.name); F(k + '.city', t.city); F(k + '.full', [t.city, t.name].filter(Boolean).join(' '), 'City and name');
      F(k + '.abbr', t.abbr); F(k + '.record', t.record);
      F(k + '.color', t.color, 'Primary color (link a Quad to fill it)'); F(k + '.color2', t.color2, 'Secondary color');
      F(k + '.logo', t.logo, 'Logo image');
      F(k + '.runs', S.teamRuns(g, k), 'Runs'); F(k + '.hits', g.hits[k], 'Hits'); F(k + '.errors', g.errors[k], 'Errors');
      F(k + '.batting', yes(k === bk && !g.final && !g.transition), '1 while this team is batting');
      for (let i = 0; i < Math.max(n, 12); i++) F(`${k}.inn${i + 1}`, S.lineCell(g, k, i), i === 0 ? 'Linescore: runs in inning 1 (inn2, inn3…)' : '');
      const sp = S.playerById(t, t.pitcher), sps = sp && st.pit[sp.id];
      F(k + '.pitcher', sp ? S.fullName(sp) : '', 'Pitcher now'); F(k + '.pitcher.last', sp ? sp.last : '');
      F(k + '.pitcher.season', sp ? `${S.fmtNum(sp.w)}-${S.fmtNum(sp.l)}, ${S.fmtEra(sp.era)} ERA` : '', '10-6, 3.21 ERA');
      F(k + '.pitcher.pitches', sps ? sps.pitches : 0);
      t.lineup.forEach((slot, i) => {
        const p = S.playerById(t, slot.id) || {}, pre = `${k}.lu${i + 1}.`;
        F(pre + 'name', S.fullName(p), i === 0 ? 'Batting order spot 1 (lu1…lu9)' : '');
        F(pre + 'short', p.first ? p.first[0] + '. ' + p.last : p.last, 'D. CASTELLANO style');
        F(pre + 'last', p.last); F(pre + 'num', p.num); F(pre + 'pos', slot.pos); F(pre + 'bats', p.bats);
        F(pre + 'avg', S.fmtAvg(p.avg)); F(pre + 'hr', p.hr); F(pre + 'rbi', p.rbi);
        F(pre + 'stats', `${S.fmtAvg(p.avg)} · ${S.fmtNum(p.hr)} HR · ${S.fmtNum(p.rbi)} RBI`);
        F(pre + 'today', st.today[p.id] && st.today[p.id].pa ? S.todayLine(st.today[p.id]) : '');
      });
    }
    for (const [alias, k] of [['batting', bk], ['fielding', fk]]) {
      const t = st.teams[k];
      F(alias + '.abbr', t.abbr, `Team ${alias === 'batting' ? 'at bat' : 'in the field'}`); F(alias + '.name', t.name);
      F(alias + '.color', t.color); F(alias + '.color2', t.color2); F(alias + '.logo', t.logo);
    }

    /* batter */
    const b = S.currentBatter(st), bp = b.player || {};
    const bt = st.today[bp.id];
    F('bat.name', S.fullName(bp), 'Batter now'); F('bat.first', bp.first); F('bat.last', bp.last); F('bat.num', bp.num);
    F('bat.pos', b.slot ? b.slot.pos : ''); F('bat.bats', bp.bats); F('bat.order', b.slot ? posOrdinal(b.idx) : '', '3RD in the order');
    F('bat.tag', [b.slot && b.slot.pos, bp.bats && 'BATS ' + bp.bats, b.slot && posOrdinal(b.idx)].filter(Boolean).join(' · '), '1B · BATS L · 3RD');
    for (const f of ['hr', 'rbi', 'sb']) F('bat.' + f, bp[f]);
    for (const f of ['avg', 'obp', 'slg', 'ops']) F('bat.' + f, bp[f] ? S.fmtAvg(bp[f]) : '');
    F('bat.stats', bp.id ? `${S.fmtAvg(bp.avg)} AVG · ${S.fmtNum(bp.hr)} HR · ${S.fmtNum(bp.rbi)} RBI` : '');
    F('bat.today', bp.id ? S.todayLine(bt) : '', '2-for-3, HR, 2 RBI');
    F('bat.photo', bp.photo, 'Headshot (photo column in the roster)');
    F('bat.abbr', b.team.abbr); F('bat.team', b.team.name); F('bat.color', b.team.color); F('bat.color2', b.team.color2); F('bat.logo', b.team.logo);

    const d = S.dueUp(st, bk, 2)[1];
    const dp = d && d.player || {};
    F('deck.name', S.fullName(dp), 'On deck'); F('deck.last', dp.last); F('deck.num', dp.num); F('deck.pos', d ? d.slot.pos : ''); F('deck.avg', dp.avg ? S.fmtAvg(dp.avg) : '');

    /* pitcher */
    const pi = S.currentPitcher(st), pp = pi.player || {}, ps = st.pit[pp.id];
    F('pit.name', S.fullName(pp), 'Pitcher now'); F('pit.first', pp.first); F('pit.last', pp.last); F('pit.num', pp.num);
    F('pit.throws', pp.id ? (pp.throws === 'L' ? 'LHP' : 'RHP') : '', 'RHP or LHP');
    for (const f of ['w', 'l', 'so', 'sv', 'ip']) F('pit.' + f, pp[f]);
    F('pit.tag', pp.id ? `${pp.throws === 'L' ? 'LHP' : 'RHP'} · ${ps ? ps.pitches : 0} PITCHES` : '', 'RHP · 87 PITCHES');
    F('pit.wl', pp.id ? `${S.fmtNum(pp.w)}-${S.fmtNum(pp.l)}` : '', 'Season W-L');
    F('pit.era', pp.id ? S.fmtEra(pp.era) : ''); F('pit.whip', pp.whip ? S.fmtEra(pp.whip) : '');
    F('pit.season', pp.id ? `${S.fmtNum(pp.w)}-${S.fmtNum(pp.l)} · ${S.fmtEra(pp.era)} ERA · ${S.fmtNum(pp.so)} K` : '');
    F('pit.pitches', ps ? ps.pitches : 0, 'Pitches today'); F('pit.strikes', ps ? ps.strikes : 0); F('pit.balls', ps ? ps.balls : 0);
    F('pit.pc', `P: ${ps ? ps.pitches : 0}`, 'P: 87');
    F('pit.today', pp.id ? S.pitchLine(ps) : '', '6.0 IP, 4 H, 1 R, 2 BB, 7 K');
    F('pit.today.ip', S.ipStr(ps ? ps.outs : 0)); F('pit.today.k', ps ? ps.so : 0); F('pit.today.h', ps ? ps.h : 0); F('pit.today.r', ps ? ps.r : 0); F('pit.today.bb', ps ? ps.bb : 0);
    F('pit.photo', pp.photo);
    F('pit.abbr', pi.team.abbr); F('pit.team', pi.team.name); F('pit.color', pi.team.color); F('pit.color2', pi.team.color2); F('pit.logo', pi.team.logo);

    /* due up: during a break, the team about to bat; otherwise the team batting next half */
    const dk = S.dueUpKey(g), dt = st.teams[dk];
    F('due.team', dt.name, 'Team due up next'); F('due.abbr', dt.abbr); F('due.color', dt.color); F('due.color2', dt.color2); F('due.logo', dt.logo);
    S.dueUp(st, dk, 3).forEach((x, i) => {
      const p = x.player || {}, pre = `due${i + 1}.`, td = st.today[p.id];
      F(pre + 'name', S.fullName(p), i === 0 ? 'First of three due up (due1, due2, due3)' : ''); F(pre + 'last', p.last); F(pre + 'num', p.num);
      F(pre + 'pos', x.slot.pos); F(pre + 'order', posOrdinal(x.idx) + ' · ' + x.slot.pos, '1ST · CF');
      F(pre + 'line', td && td.pa ? S.todayLine(td) : `${S.fmtAvg(p.avg)} AVG · ${S.fmtNum(p.hr)} HR`, "Today's line, or season stats before the first at-bat");
    });
    return out;
  }

  function rows(st) { return [['Field', 'Value', 'About'], ...build(st)]; }
  const link = field => ({ src: SOURCE_ID, row: 'Field=' + field, col: 'Value' });
  const fieldOf = l => { const m = l && l.src === SOURCE_ID && String(l.row || '').match(/^Field\s*=\s*(.+)$/i); return m ? m[1].trim() : ''; };

  return { SOURCE_ID, build, rows, link, fieldOf, basesImg, outsImg };
});
