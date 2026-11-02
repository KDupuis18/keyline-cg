/* Unit tests for the Bullpen game engine: node test/engine.test.js */
'use strict';
const assert = require('assert');
const E = require('../lib/engine');
const S = require('../public/shared.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (err) { fail++; console.log('  FAIL ' + name + '\n       ' + err.message); }
}
const fresh = () => E.newState();
const run = (st, ...acts) => { for (const a of acts) E.apply(st, typeof a === 'string' ? (a.length <= 3 ? { type: 'result', kind: a } : { type: 'pitch', kind: a }) : a); return st; };
const awayPitcher = st => st.pit[st.teams.away.pitcher];
const homePitcher = st => st.pit[st.teams.home.pitcher];

console.log('count');
test('four balls is a walk, batter to first, next batter up', () => {
  const st = run(fresh(), 'ball', 'ball', 'ball', 'ball');
  assert.deepStrictEqual(st.game.bases, [true, false, false]);
  assert.strictEqual(st.game.balls, 0);
  assert.strictEqual(st.teams.away.up, 1);
  assert.strictEqual(homePitcher(st).pitches, 4);
  assert.strictEqual(homePitcher(st).bb, 1);
  assert.strictEqual(st.today[st.teams.away.lineup[0].id].bb, 1);
});
test('three strikes is a strikeout; fouls with two strikes do not add a strike', () => {
  const st = run(fresh(), 'called', 'foul', 'foul', 'foul');
  assert.strictEqual(st.game.strikes, 2);
  run(st, 'swinging');
  assert.strictEqual(st.game.outs, 1);
  assert.strictEqual(st.game.strikes, 0);
  assert.strictEqual(homePitcher(st).pitches, 5);
  assert.strictEqual(homePitcher(st).so, 1);
  assert.strictEqual(homePitcher(st).outs, 1);
});

console.log('base running');
test('walk with bases loaded forces in a run', () => {
  const st = fresh(); st.game.bases = [true, true, true];
  run(st, 'bb');
  assert.deepStrictEqual(st.game.bases, [true, true, true]);
  assert.strictEqual(S.teamRuns(st.game, 'away'), 1);
  assert.strictEqual(st.today[st.teams.away.lineup[0].id].rbi, 1);
});
test('walk with runner on second only does not move him', () => {
  const st = fresh(); st.game.bases = [false, true, false];
  run(st, 'bb');
  assert.deepStrictEqual(st.game.bases, [true, true, false]);
});
test('double clears second and third, batter on second', () => {
  const st = fresh(); st.game.bases = [true, true, true];
  run(st, '2b');
  assert.deepStrictEqual(st.game.bases, [false, true, true]);
  assert.strictEqual(S.teamRuns(st.game, 'away'), 2);
  assert.strictEqual(st.game.hits.away, 1);
});
test('grand slam scores four', () => {
  const st = fresh(); st.game.bases = [true, true, true];
  run(st, 'hr');
  assert.deepStrictEqual(st.game.bases, [false, false, false]);
  assert.strictEqual(S.teamRuns(st.game, 'away'), 4);
  const b = st.today[st.teams.away.lineup[0].id];
  assert.strictEqual(b.rbi, 4); assert.strictEqual(b.hr, 1); assert.strictEqual(b.r, 1);
  assert.strictEqual(homePitcher(st).r, 4);
});
test('sac fly scores the runner from third with fewer than two outs', () => {
  const st = fresh(); st.game.bases = [false, false, true];
  run(st, 'sac');
  assert.strictEqual(S.teamRuns(st.game, 'away'), 1);
  assert.strictEqual(st.game.outs, 1);
  const b = st.today[st.teams.away.lineup[0].id];
  assert.strictEqual(b.ab, 0); assert.strictEqual(b.rbi, 1);
});
test('nobody scores on the third out', () => {
  const st = fresh(); st.game.outs = 2; st.game.bases = [false, false, true];
  run(st, 'sac');
  assert.strictEqual(S.teamRuns(st.game, 'away'), 0);
});
test('double play erases the runner on first', () => {
  const st = fresh(); st.game.bases = [true, false, true];
  run(st, 'dp');
  assert.strictEqual(st.game.outs, 2);
  assert.deepStrictEqual(st.game.bases, [false, false, true]);
});
test("fielder's choice: batter on first, lead forced runner out", () => {
  const st = fresh(); st.game.bases = [true, false, false];
  run(st, 'fc');
  assert.strictEqual(st.game.outs, 1);
  assert.deepStrictEqual(st.game.bases, [true, false, false]);
});
test('error: no hit, error charged to the fielding team', () => {
  const st = run(fresh(), 'e');
  assert.strictEqual(st.game.hits.away, 0);
  assert.strictEqual(st.game.errors.home, 1);
  assert.deepStrictEqual(st.game.bases, [true, false, false]);
});

console.log('innings');
test('three outs ends the half: bases and count clear, home bats, break label shows', () => {
  const st = fresh(); st.game.bases = [true, true, false];
  run(st, 'out', 'out', 'ball', 'out');
  assert.strictEqual(st.game.half, 'bottom');
  assert.strictEqual(st.game.outs, 0);
  assert.deepStrictEqual(st.game.bases, [false, false, false]);
  assert.strictEqual(S.inningState(st.game).label, 'MID 1');
  assert.strictEqual(S.battingKey(st.game), 'home');
  run(st, 'ball');
  assert.strictEqual(S.inningState(st.game).label, '');
  assert.strictEqual(awayPitcher(st).pitches, 1, 'away pitcher now pitching');
});
test('end of bottom half goes to the top of the next inning', () => {
  const st = fresh();
  E.apply(st, { type: 'endHalf' }); E.apply(st, { type: 'endHalf' });
  assert.strictEqual(st.game.inning, 2); assert.strictEqual(st.game.half, 'top');
  assert.strictEqual(S.inningState(st.game).label, 'END 1');
  assert.strictEqual(st.game.runs.away.length, 2);
});
test('batting order wraps after the ninth hitter and is kept per team', () => {
  const st = fresh();
  for (let i = 0; i < 9; i++) run(st, '1b');
  assert.strictEqual(st.teams.away.up, 0);
  assert.strictEqual(st.teams.home.up, 0);
});
test('linescore leaves unplayed halves blank', () => {
  const st = fresh();
  assert.strictEqual(S.lineCell(st.game, 'away', 0), '0');
  assert.strictEqual(S.lineCell(st.game, 'home', 0), '');
  E.apply(st, { type: 'endHalf' });
  assert.strictEqual(S.lineCell(st.game, 'home', 0), '');
  run(st, 'ball');
  assert.strictEqual(S.lineCell(st.game, 'home', 0), '0');
});
test('final in extras reads F/10', () => {
  const st = fresh();
  E.apply(st, { type: 'inning', inning: 10, half: 'bottom' });
  E.apply(st, { type: 'final' });
  assert.strictEqual(S.inningState(st.game).label, 'F/10');
});

console.log('stats & lines');
test('today line', () => {
  assert.strictEqual(S.todayLine({ pa: 4, ab: 3, h: 2, d: 1, t: 0, hr: 1, rbi: 3, bb: 1, so: 0, hbp: 0, sf: 0 }), '2-for-3, HR, 2B, 3 RBI, BB');
  assert.strictEqual(S.todayLine(null), 'First plate appearance');
});
test('pitch line and innings pitched', () => {
  assert.strictEqual(S.ipStr(17), '5.2');
  assert.strictEqual(S.pitchLine({ bf: 20, pitches: 80, outs: 18, h: 4, r: 1, bb: 2, so: 7 }), '6.0 IP, 4 H, 1 R, 2 BB, 7 K');
});
test('average formatting', () => {
  assert.strictEqual(S.fmtAvg('.287'), '.287');
  assert.strictEqual(S.fmtAvg(0.3), '.300');
  assert.strictEqual(S.fmtAvg('1.024'), '1.024');
  assert.strictEqual(S.fmtAvg(''), '—');
});

console.log('rosters');
test('CSV import builds roster, lineup of hitters, and picks a pitcher', () => {
  const st = fresh();
  const csv = '#,Name,Pos,AVG,HR\r\n7,"Smith, Will",SS,.250,3\n9,Al Jones,CF,.301,12\n30,Pete Arm,P,,\n';
  E.apply(st, { type: 'roster', team: 'home', csv });
  const t = st.teams.home;
  assert.strictEqual(t.roster.length, 3);
  assert.strictEqual(t.roster[0].last, 'Smith'); assert.strictEqual(t.roster[0].first, 'Will');
  assert.strictEqual(t.roster[1].first, 'Al');
  assert.strictEqual(t.lineup.length, 2);
  assert.strictEqual(S.playerById(t, t.pitcher).last, 'Arm');
});
test('CSV without a name column is rejected', () => {
  assert.throws(() => S.rosterFromCSV('a,b\n1,2'), /name/);
});
test('removing a player drops him from the lineup', () => {
  const st = fresh(), t = st.teams.away, id = t.lineup[3].id;
  E.apply(st, { type: 'removePlayer', team: 'away', id });
  assert.strictEqual(t.lineup.length, 8);
  assert.ok(!t.lineup.some(s => s.id === id));
});

console.log('graphics');
test('take pins the current batter; preview then take clears preview', () => {
  const st = fresh();
  E.apply(st, { type: 'preview', gfx: { type: 'batter' } });
  assert.strictEqual(st.gfx.preview.player, st.teams.away.lineup[0].id);
  E.apply(st, { type: 'take' });
  assert.strictEqual(st.gfx.lower.type, 'batter');
  assert.strictEqual(st.gfx.preview, null);
  run(st, '1b');
  assert.strictEqual(st.gfx.lower.player, st.teams.away.lineup[0].id, 'graphic on air still shows the first batter');
});
test('graphic actions are not undoable, game actions are', () => {
  const st = fresh();
  assert.strictEqual(E.apply(st, { type: 'bug' }), false);
  assert.strictEqual(E.apply(st, { type: 'pitch', kind: 'ball' }), true);
});
test('auto batter lower third after each plate appearance', () => {
  const st = fresh();
  E.apply(st, { type: 'auto', batter: true, secs: 5 });
  run(st, 'k');
  assert.strictEqual(st.gfx.lower.player, st.teams.away.lineup[1].id);
  assert.strictEqual(st.gfx.lower.secs, 5);
});
test('unknown actions throw', () => {
  assert.throws(() => E.apply(fresh(), { type: 'nope' }));
  assert.throws(() => E.apply(fresh(), { type: 'take', gfx: { type: 'nope' } }));
});
test('normalize fills in a sparse save', () => {
  const st = E.normalize({ teams: { away: { name: 'A', roster: [], lineup: [] }, home: { name: 'B', roster: [], lineup: [] } } });
  assert.strictEqual(st.game.inning, 1);
  assert.ok(st.gfx.ticker);
  assert.strictEqual(st.teams.away.abbr, 'AWA');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
