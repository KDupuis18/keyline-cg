/* Keyline baseball scoring engine. The whole game is one plain JSON object
   (project.baseball) so it saves with the project and undo can snapshot it.
   Graphics are ordinary Keyline scenes linked to the live Baseball data source. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./shared.js'));
  else root.BBEngine = factory(root.BP);
})(typeof self !== 'undefined' ? self : this, function (S) {
'use strict';

/* ---------- sample teams (fictional) ---------- */
function hitter([num, first, last, pos, bats, avg, hr, rbi, ops, obp, slg, sb]) {
  return { id: S.uid(), num, first, last, pos, bats, throws: 'R', avg, hr, rbi, ops, obp, slg, sb };
}
function pitcher([num, first, last, throws, w, l, era, ip, so, whip, sv]) {
  return { id: S.uid(), num, first, last, pos: 'P', bats: throws, throws, w, l, era, ip, so, whip, sv };
}
function sampleTeams() {
  const away = {
    name: 'Gulls', city: 'Harbor City', abbr: 'HCG', color: '#0e3b6e', color2: '#f3b61f', logo: '', record: '52-38',
    roster: [
      ['2', 'Marcus', 'Delgado', 'SS', 'R', '.291', '14', '58', '.812', '.355', '.457', '19'],
      ['17', 'Tyler', 'Brennan', 'CF', 'L', '.268', '9', '41', '.764', '.341', '.423', '27'],
      ['24', 'Andre', 'Whitfield', '1B', 'L', '.302', '27', '88', '.941', '.389', '.552', '2'],
      ['31', 'Kenji', 'Morales', 'DH', 'R', '.277', '22', '74', '.868', '.350', '.518', '4'],
      ['8', 'Dominic', 'Reyes', '3B', 'R', '.259', '18', '66', '.790', '.322', '.468', '6'],
      ['44', 'Caleb', 'Strand', 'RF', 'L', '.249', '12', '47', '.731', '.318', '.413', '9'],
      ['5', 'Luis', 'Arceneaux', '2B', 'S', '.281', '6', '39', '.742', '.337', '.405', '14'],
      ['12', 'Sam', 'Okafor', 'C', 'R', '.236', '10', '35', '.688', '.301', '.387', '0'],
      ['3', 'Jordan', 'Pike', 'LF', 'L', '.263', '7', '30', '.717', '.329', '.388', '11'],
      ['19', 'Ray', 'Tolliver', 'UT', 'R', '.244', '3', '15', '.655', '.298', '.357', '3']
    ].map(hitter).concat([
      ['41', 'Nate', 'Corrigan', 'R', '11', '5', '3.08', '128.2', '141', '1.11', '0'],
      ['55', 'Eli', 'Vance', 'L', '8', '7', '3.94', '112.0', '98', '1.27', '0'],
      ['38', 'Hector', 'Ruiz', 'R', '4', '2', '2.71', '46.1', '52', '1.04', '3'],
      ['47', 'Owen', 'Blake', 'R', '2', '3', '3.40', '42.1', '49', '1.15', '24']
    ].map(pitcher))
  };
  const home = {
    name: 'Foxes', city: 'Ridgeview', abbr: 'RDG', color: '#b8461b', color2: '#1d1d1d', logo: '', record: '48-42',
    roster: [
      ['1', 'Danny', 'Castellano', 'CF', 'L', '.284', '8', '37', '.771', '.352', '.419', '31'],
      ['22', 'Wes', 'Harrington', '2B', 'R', '.273', '11', '49', '.758', '.330', '.428', '8'],
      ['35', 'Big Mike', 'Oduya', '1B', 'R', '.288', '31', '95', '.962', '.371', '.591', '1'],
      ['9', 'Trent', 'Lindqvist', 'LF', 'L', '.270', '20', '71', '.842', '.344', '.498', '5'],
      ['27', 'Mateo', 'Sandoval', '3B', 'R', '.262', '16', '60', '.781', '.326', '.455', '3'],
      ['14', 'Grady', 'Fontaine', 'DH', 'L', '.251', '19', '58', '.795', '.330', '.465', '0'],
      ['6', 'Isaiah', 'Brooks', 'RF', 'S', '.247', '9', '36', '.709', '.312', '.397', '12'],
      ['18', 'Colt', 'Mabry', 'C', 'R', '.229', '13', '40', '.701', '.296', '.405', '1'],
      ['11', 'Felix', 'Ota', 'SS', 'R', '.255', '4', '28', '.668', '.309', '.359', '16'],
      ['30', 'Jace', 'Whitlow', 'OF', 'R', '.233', '2', '11', '.612', '.286', '.326', '7']
    ].map(hitter).concat([
      ['50', 'Rafael', 'Quintero', 'L', '10', '6', '3.21', '131.1', '150', '1.09', '0'],
      ['33', 'Brady', 'Kessler', 'R', '7', '8', '4.12', '109.1', '91', '1.31', '0'],
      ['58', 'Toby', 'Mendez', 'L', '3', '1', '2.95', '39.2', '44', '1.18', '2'],
      ['62', 'Jonah', 'Pratt', 'R', '1', '4', '2.48', '40.0', '55', '0.98', '27']
    ].map(pitcher))
  };
  for (const t of [away, home]) {
    t.lineup = t.roster.slice(0, 9).map(p => ({ id: p.id, pos: p.pos }));
    t.pitcher = t.roster.find(p => p.pos === 'P').id;
    t.up = 0;
  }
  return { away, home };
}

function freshGame() {
  return {
    inning: 1, half: 'top', balls: 0, strikes: 0, outs: 0, bases: [false, false, false],
    runs: { away: [0], home: [0] }, hits: { away: 0, home: 0 }, errors: { away: 0, home: 0 },
    final: false, transition: false, lastPlay: '', pa: 0, pitchMph: '', pitchType: ''
  };
}
function freshAuto() {
  return { batterTake: '', batterSecs: 7, pitchTake: '', pitchSecs: 6 };
}
function newState() {
  return {
    v: 1,
    meta: { title: 'Gulls at Foxes', venue: 'Ridgeview Park', accent: '#f3b61f' },
    teams: sampleTeams(), game: freshGame(), today: {}, pit: {}, auto: freshAuto()
  };
}

/* ---------- per-game stat lines ---------- */
const bat = (st, id) => st.today[id] || (st.today[id] = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sf: 0, log: [] });
const pit = (st, id) => st.pit[id] || (st.pit[id] = { pitches: 0, strikes: 0, balls: 0, bf: 0, outs: 0, h: 0, r: 0, bb: 0, so: 0, hr: 0 });
const NOBODY = '_none';

/* ---------- base running ---------- */
/* Every runner moves n bases; the batter ends on base `to` (1-3, 4 = scores, 0 = out). Returns runs. */
function advance(g, n, to) {
  let runs = 0; const nb = [false, false, false];
  for (let i = 2; i >= 0; i--) if (g.bases[i]) { if (i + n >= 3) runs++; else nb[i + n] = true; }
  if (to === 4) runs++; else if (to > 0) nb[to - 1] = true;
  g.bases = nb; return runs;
}
/* Walk / HBP: the batter takes first and only forced runners move. */
function force(g) {
  const b = g.bases; let runs = 0;
  if (b[0]) { if (b[1]) { if (b[2]) runs = 1; b[2] = true; } b[1] = true; }
  b[0] = true; return runs;
}

function ensureInning(g) {
  for (const k of ['away', 'home']) while (g.runs[k].length < g.inning) g.runs[k].push(0);
}
function addRuns(st, k, n) {
  if (!n) return;
  const g = st.game; ensureInning(g);
  g.runs[k][g.inning - 1] = Math.max(0, (g.runs[k][g.inning - 1] || 0) + n);
}
function resetCount(g) { g.balls = 0; g.strikes = 0; }
function endHalf(st) {
  const g = st.game;
  g.outs = 0; g.bases = [false, false, false]; resetCount(g);
  if (g.half === 'top') g.half = 'bottom'; else { g.half = 'top'; g.inning++; }
  ensureInning(g);
  g.transition = true;
}

const LABEL = {
  '1b': 'SINGLE', '2b': 'DOUBLE', '3b': 'TRIPLE', hr: 'HOME RUN', bb: 'WALK', ibb: 'INTENTIONAL WALK', hbp: 'HIT BY PITCH',
  k: 'STRIKEOUT', out: 'OUT', dp: 'DOUBLE PLAY', sac: 'SACRIFICE', e: 'REACHED ON ERROR', fc: "FIELDER'S CHOICE"
};
const IN_PLAY = new Set(['1b', '2b', '3b', 'hr', 'out', 'dp', 'sac', 'e', 'fc']);

/* A plate appearance ends with this result. Runner moves are the usual defaults;
   the operator fixes anything unusual with the base / run buttons afterwards. */
function plateResult(st, kind, opts = {}) {
  const g = st.game;
  if (!LABEL[kind]) throw new Error('Unknown result: ' + kind);
  const bk = S.battingKey(g), fk = S.other(bk), team = st.teams[bk];
  const slot = team.lineup[team.up];
  const b = bat(st, slot ? slot.id : NOBODY);
  const p = pit(st, st.teams[fk].pitcher || NOBODY);
  if (IN_PLAY.has(kind) && opts.pitch !== false) { p.pitches++; p.strikes++; }
  g.transition = false;

  let runs = 0, outs = 0, hit = false, ab = true, rbi = true;
  switch (kind) {
    case '1b': runs = advance(g, 1, 1); hit = true; break;
    case '2b': runs = advance(g, 2, 2); hit = true; b.d++; break;
    case '3b': runs = advance(g, 3, 3); hit = true; b.t++; break;
    case 'hr': runs = advance(g, 4, 4); hit = true; b.hr++; b.r++; p.hr++; break;
    case 'bb': case 'ibb': runs = force(g); ab = false; b.bb++; p.bb++; break;
    case 'hbp': runs = force(g); ab = false; b.hbp++; break;
    case 'k': outs = 1; b.so++; p.so++; break;
    case 'out': outs = 1; break;
    case 'sac':
      outs = 1; ab = false; b.sf++;
      if (g.bases[2] && g.outs < 2) { g.bases[2] = false; runs = 1; }
      break;
    case 'dp': {
      outs = Math.min(2, 3 - g.outs); rbi = false;
      // the runner on first (or the lead runner) is erased along with the batter
      const i = g.bases[0] ? 0 : g.bases.lastIndexOf(true);
      if (i >= 0) g.bases[i] = false;
      break;
    }
    case 'fc': {
      outs = 1; rbi = false;
      const i = g.bases[0] ? 0 : g.bases.lastIndexOf(true);
      if (i >= 0) g.bases[i] = false;
      if (g.outs + 1 < 3) force(g);
      break;
    }
    case 'e': runs = advance(g, 1, 1); rbi = false; g.errors[fk]++; break;
  }
  if (g.outs + outs >= 3) runs = 0; // nobody scores on the third out
  b.pa++; if (ab) b.ab++;
  if (hit) { b.h++; g.hits[bk]++; p.h++; }
  if (rbi) b.rbi += runs;
  b.log.push(kind.toUpperCase());
  p.bf++; p.outs += outs; p.r += runs;
  addRuns(st, bk, runs);
  g.outs += outs;
  g.lastPlay = (slot ? S.fullName(S.playerById(team, slot.id)) + ': ' : '') + LABEL[kind] + (runs ? ' — ' + runs + (runs > 1 ? ' runs score' : ' run scores') : '');
  resetCount(g);
  if (team.lineup.length) team.up = (team.up + 1) % team.lineup.length;
  g.pa = (g.pa || 0) + 1; // the console watches this to fire the auto batter graphic
  g.pitchMph = ''; g.pitchType = '';
  if (g.outs >= 3) endHalf(st);
  return { runs, outs };
}

function pitch(st, kind) {
  const g = st.game;
  const p = pit(st, st.teams[S.fieldingKey(g)].pitcher || NOBODY);
  g.transition = false;
  switch (kind) {
    case 'ball':
      p.pitches++; p.balls++; g.balls++;
      if (g.balls >= 4) return plateResult(st, 'bb', { pitch: false });
      break;
    case 'called': case 'swinging': case 'strike':
      p.pitches++; p.strikes++; g.strikes++;
      if (g.strikes >= 3) return plateResult(st, 'k', { pitch: false });
      break;
    case 'foul':
      p.pitches++; p.strikes++; if (g.strikes < 2) g.strikes++;
      break;
    default: throw new Error('Unknown pitch: ' + kind);
  }
}

/* ---------- actions ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const GAME_ACTIONS = new Set(['pitch', 'result', 'count', 'outs', 'base', 'runs', 'hits', 'errors', 'runnerOut', 'batter', 'endHalf', 'inning', 'final', 'pitcher', 'lineup', 'team', 'player', 'addPlayer', 'removePlayer', 'roster', 'resetGame', 'meta', 'pitchInfo']);

/* Mutates st. Returns true when the action changed game data (so the console keeps an undo snapshot). */
function apply(st, a) {
  const g = st.game, side = k => { if (k !== 'away' && k !== 'home') throw new Error('team must be "away" or "home"'); return k; };
  switch (a.type) {
    case 'pitch': pitch(st, a.kind); break;
    case 'result': plateResult(st, a.kind, a); break;
    case 'count':
      if (a.balls != null) g.balls = clamp(+a.balls, 0, 3);
      if (a.strikes != null) g.strikes = clamp(+a.strikes, 0, 2);
      break;
    case 'outs':
      g.outs = clamp(a.delta != null ? g.outs + +a.delta : +a.value, 0, 3);
      if (g.outs >= 3) endHalf(st);
      break;
    case 'runnerOut': // caught stealing, pickoff…: an out that does not end the at-bat
      if (a.base != null) g.bases[clamp(+a.base, 0, 2)] = false;
      pit(st, st.teams[S.fieldingKey(g)].pitcher || NOBODY).outs++;
      g.outs++; if (g.outs >= 3) endHalf(st);
      break;
    case 'base': {
      const i = clamp(+a.base, 0, 2);
      g.bases[i] = a.value != null ? !!a.value : !g.bases[i];
      break;
    }
    case 'runs': {
      const k = side(a.team || S.battingKey(g)), d = +a.delta || 0;
      addRuns(st, k, d);
      if (k === S.battingKey(g) && d) {
        const p = pit(st, st.teams[S.other(k)].pitcher || NOBODY); p.r = Math.max(0, p.r + d);
      }
      break;
    }
    case 'hits': { const k = side(a.team); g.hits[k] = Math.max(0, g.hits[k] + (+a.delta || 0)); break; }
    case 'errors': { const k = side(a.team); g.errors[k] = Math.max(0, g.errors[k] + (+a.delta || 0)); break; }
    case 'batter': {
      const k = side(a.team || S.battingKey(g)), t = st.teams[k], n = t.lineup.length || 1;
      t.up = a.index != null ? clamp(+a.index, 0, n - 1) : ((t.up + (+a.delta || 1)) % n + n) % n;
      if (k === S.battingKey(g)) resetCount(g);
      break;
    }
    case 'endHalf': endHalf(st); break;
    case 'inning':
      g.inning = clamp(+a.inning || 1, 1, 30);
      if (a.half) g.half = a.half === 'bottom' ? 'bottom' : 'top';
      g.transition = false; ensureInning(g);
      break;
    case 'final': g.final = a.value != null ? !!a.value : !g.final; break;
    case 'pitcher': { const t = st.teams[side(a.team)]; if (!S.playerById(t, a.id)) throw new Error('No such player'); t.pitcher = a.id; break; }
    case 'lineup': {
      const t = st.teams[side(a.team)];
      if (a.lineup) t.lineup = a.lineup.filter(s => S.playerById(t, s.id)).map(s => ({ id: s.id, pos: String(s.pos || '') }));
      else if (a.index != null) {
        const i = +a.index;
        if (a.id === '' || a.id == null) { t.lineup.splice(i, 1); }
        else {
          if (!S.playerById(t, a.id)) throw new Error('No such player');
          const pos = a.pos != null ? String(a.pos) : (t.lineup[i] ? t.lineup[i].pos : S.playerById(t, a.id).pos);
          t.lineup[i] = { id: a.id, pos };
        }
      }
      if (t.up >= t.lineup.length) t.up = 0;
      break;
    }
    case 'team': {
      const t = st.teams[side(a.team)];
      for (const f of ['name', 'city', 'abbr', 'color', 'color2', 'logo', 'record']) if (a.fields && a.fields[f] != null) t[f] = String(a.fields[f]);
      break;
    }
    case 'player': {
      const t = st.teams[side(a.team)], p = S.playerById(t, a.id);
      if (!p) throw new Error('No such player');
      for (const [f, v] of Object.entries(a.fields || {})) if (f !== 'id') p[f] = String(v);
      break;
    }
    case 'addPlayer': {
      const t = st.teams[side(a.team)];
      t.roster.push(Object.assign({ num: '', first: '', last: 'New Player', pos: '' }, a.fields || {}, { id: S.uid() }));
      break;
    }
    case 'removePlayer': {
      const t = st.teams[side(a.team)];
      t.roster = t.roster.filter(p => p.id !== a.id);
      t.lineup = t.lineup.filter(s => s.id !== a.id);
      if (t.pitcher === a.id) t.pitcher = (t.roster.find(S.isPitcher) || {}).id || '';
      if (t.up >= t.lineup.length) t.up = 0;
      break;
    }
    case 'roster': { // CSV import; replaces the roster and builds a default lineup
      const t = st.teams[side(a.team)];
      const players = S.rosterFromCSV(a.csv);
      t.roster = players;
      const hitters = players.filter(p => !S.isPitcher(p));
      t.lineup = hitters.slice(0, 9).map(p => ({ id: p.id, pos: p.pos }));
      t.pitcher = (players.find(S.isPitcher) || {}).id || '';
      t.up = 0;
      break;
    }
    case 'meta': Object.assign(st.meta, a.fields || {}); break;
    case 'resetGame':
      st.game = freshGame(); st.today = {}; st.pit = {};
      st.teams.away.up = 0; st.teams.home.up = 0;
      break;

    case 'pitchInfo': // speed / type of the last pitch, for a pitch-speed graphic
      if (a.mph != null) g.pitchMph = String(a.mph);
      if (a.pitch != null) g.pitchType = String(a.pitch);
      break;
    case 'auto':
      if (a.batterTake != null) st.auto.batterTake = String(a.batterTake);
      if (a.batterSecs != null) st.auto.batterSecs = clamp(+a.batterSecs || 0, 0, 120);
      if (a.pitchTake != null) st.auto.pitchTake = String(a.pitchTake);
      if (a.pitchSecs != null) st.auto.pitchSecs = clamp(+a.pitchSecs || 0, 0, 120);
      break;
    default: throw new Error('Unknown action: ' + a.type);
  }
  return GAME_ACTIONS.has(a.type);
}

/* Fill in anything missing from an older or hand-edited save file. */
function normalize(st) {
  const d = newState();
  st = Object.assign({}, d, st);
  st.meta = Object.assign({}, d.meta, st.meta);
  st.game = Object.assign(freshGame(), st.game);
  st.auto = Object.assign(freshAuto(), st.auto);
  delete st.gfx; delete st.theme;
  for (const k of ['away', 'home']) {
    const t = st.teams[k] = Object.assign({ name: k, city: '', abbr: k.slice(0, 3).toUpperCase(), color: '#333333', color2: '#ffffff', logo: '', record: '', roster: [], lineup: [], pitcher: '', up: 0 }, st.teams[k]);
    if (t.up >= t.lineup.length) t.up = 0;
  }
  ensureInning(st.game);
  st.today = st.today || {}; st.pit = st.pit || {};
  return st;
}

return { newState, normalize, apply, sampleTeams, advance, force, LABEL, GAME_ACTIONS };
});
