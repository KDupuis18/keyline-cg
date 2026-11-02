/* Baseball mode end-to-end: scoring console, live-linked graphics, automatic takes,
   undo separation, RossTalk/HTTP control. Run with: xvfb-run -a node test/e2e-baseball.js */
'use strict';
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function test(name, fn) { try { await fn(); pass++; console.log('  ✔ ' + name); } catch (e) { fail++; console.log('  ✘ ' + name + '\n    ' + String(e.stack || e).split('\n').slice(0, 4).join('\n    ')); } }
const tcp = txt => new Promise((res, rej) => { const s = net.connect(7788, '127.0.0.1', () => { s.end(txt); setTimeout(res, 300); }); s.on('error', rej); });
const getJson = p => new Promise((res, rej) => http.get('http://127.0.0.1:8088' + p, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));
const osKey = (app, keyCode, modifiers) => app.evaluate(({ BrowserWindow }, a) => { const wc = BrowserWindow.getAllWindows()[0].webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: a.keyCode, modifiers: a.modifiers }); wc.sendInputEvent({ type: 'keyUp', keyCode: a.keyCode, modifiers: a.modifiers }); }, { keyCode, modifiers });

(async () => {
  fs.rmSync(path.join(os.homedir(), '.config', 'Keyline CG Studio'), { recursive: true, force: true });
  const app = await electron.launch({ executablePath: require('electron'), args: [ROOT, '--no-sandbox'] });
  const errors = [];
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push(e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1600, 960));
  await win.waitForFunction(() => window.__kl);
  await sleep(500);

  const game = () => win.evaluate(() => __kl.P.baseball.game);
  const runs = async k => (await game()).runs[k].reduce((a, b) => a + b, 0);
  /* text of a named object in what channel 1 is showing */
  const onAir = (scene, obj) => win.evaluate(([s, o]) => {
    const sc = __kl.P.scenes.find(x => x.name === s); const ob = sc && sc.objects.find(x => x.name === o);
    const el = ob && document.querySelector(`#pgmLayers1 .go[data-id="${ob.id}"]`);
    return el ? { text: el.textContent, hidden: el.style.visibility === 'hidden', fill: el.firstChild && el.firstChild.style ? el.firstChild.style.background : '', src: el.querySelector('img') ? el.querySelector('img').src : '' } : null;
  }, [scene, obj]);
  const takeRow = name => win.locator(`#bbTakes tr:has-text("${name}") [data-take]`);

  console.log('Baseball mode');
  await test('F5 opens Baseball mode with a sample game and adds the live data source', async () => {
    await win.keyboard.press('F5');
    await win.waitForSelector('#bbMode:not([hidden]) .bb-b.ball');
    const s = await win.evaluate(() => ({ teams: __kl.P.baseball.teams.away.name + '/' + __kl.P.baseball.teams.home.name, src: __kl.P.dataSources.find(x => x.id === 'baseball').type }));
    assert.deepStrictEqual(s, { teams: 'Gulls/Foxes', src: 'baseball' });
    assert.ok(await win.isVisible('#bbPgmSlot #pgmWrap'), 'program monitor moved into Baseball mode');
  });
  await test('starter graphics: editable scenes and linked takes, auto batter take set', async () => {
    await win.click('[data-bb="starter"]');
    const r = await win.evaluate(() => ({ scenes: __kl.P.scenes.filter(s => /^BB /.test(s.name)).length, takes: __kl.P.takes.filter(t => /^Baseball:/.test(t.name)).length, auto: !!__kl.P.baseball.auto.batterTake }));
    assert.deepStrictEqual(r, { scenes: 13, takes: 14, auto: true });
  });
  await test('take the scorebug: team abbreviations, team color and score on air', async () => {
    await takeRow('SCOREBUG').click();
    await win.waitForFunction(() => document.querySelector('#pgmLayers1 .go'));
    await sleep(1200);
    assert.strictEqual((await onAir('BB SCOREBUG', 'AWAY ABBR')).text, 'HCG');
    assert.strictEqual((await onAir('BB SCOREBUG', 'AWAY SCORE')).text, '0');
    assert.match((await onAir('BB SCOREBUG', 'AWAY BAR')).fill, /rgb\(14, 59, 110\)/);
  });
  await test('keyboard scoring updates the bug live without re-taking it', async () => {
    await win.click('#bbLast');
    await win.keyboard.press('b'); await win.keyboard.press('s');
    await sleep(150);
    assert.strictEqual((await onAir('BB SCOREBUG', 'COUNT')).text, '1-1');
    assert.strictEqual((await onAir('BB SCOREBUG', 'PITCH COUNT')).text, 'P: 2');
  });
  await test('double: runner diamond image lights second base', async () => {
    const before = (await onAir('BB SCOREBUG', 'BASES')).src;
    await win.click('[data-res="2b"]'); await sleep(150);
    assert.deepStrictEqual((await game()).bases, [false, true, false]);
    assert.notStrictEqual((await onAir('BB SCOREBUG', 'BASES')).src, before);
  });
  await test('"show only when set": the at-bat arrow shows for the batting team only', async () => {
    assert.strictEqual((await onAir('BB SCOREBUG', 'AWAY AT BAT')).hidden, false);
    assert.strictEqual((await onAir('BB SCOREBUG', 'HOME AT BAT')).hidden, true);
  });
  await test('home run scores two; the new batter lower third is taken automatically', async () => {
    await win.keyboard.press('h'); await sleep(1300);
    assert.strictEqual(await runs('away'), 2);
    assert.strictEqual((await onAir('BB SCOREBUG', 'AWAY SCORE')).text, '2');
    const name = await onAir('BB BATTER L3', 'NAME');
    assert.ok(name, 'batter L3 on air');
    assert.strictEqual(name.text, 'Andre Whitfield');
    await win.screenshot({ path: path.join(SHOTS, 'bb-1-console.png') });
  });
  await test('Undo play (Ctrl+Z in Baseball mode) rewinds the scoring, not the design', async () => {
    await win.evaluate(() => document.activeElement && document.activeElement.blur());
    await osKey(app, 'Z', ['control']); await sleep(250);
    assert.strictEqual(await runs('away'), 0);
    assert.strictEqual((await onAir('BB SCOREBUG', 'AWAY SCORE')).text, '0');
    assert.strictEqual(await win.evaluate(() => __kl.P.scenes.filter(s => /^BB /.test(s.name)).length), 13);
    await osKey(app, 'Y', ['control']); await sleep(250);
    assert.strictEqual(await runs('away'), 2);
  });
  await test('three outs: inning label goes to MID 1 and the home team is batting', async () => {
    for (const k of ['k', 'o', 'o']) { await win.keyboard.press(k); await sleep(80); }
    const g = await game();
    assert.strictEqual(g.half, 'bottom');
    assert.strictEqual((await onAir('BB SCOREBUG', 'INNING')).text, 'MID 1');
    assert.strictEqual((await onAir('BB SCOREBUG', 'HOME AT BAT')).hidden, true, 'nobody batting during the break');
  });
  await test('pitch speed: SHOW sets the value and takes the pitch graphic', async () => {
    await win.fill('#bbMph', '98'); await win.selectOption('#bbPitchType', 'Sinker');
    await win.click('#bbMphGo'); await sleep(900);
    assert.strictEqual((await onAir('BB PITCH SPEED', 'MPH')).text, '98 MPH');
    assert.strictEqual((await onAir('BB PITCH SPEED', 'TYPE')).text, 'SINKER');
  });
  await test('due up and linescore takes show the right data', async () => {
    await takeRow('DUE UP').click(); await sleep(900);
    assert.strictEqual((await onAir('BB DUE UP', 'DUE TEAM')).text, 'Foxes');
    assert.strictEqual((await onAir('BB DUE UP', 'NAME 1')).text, 'Castellano');
    await takeRow('LINESCORE').click(); await sleep(900);
    assert.strictEqual((await onAir('BB LINESCORE', 'AWAY 1')).text, '2');
    assert.strictEqual((await onAir('BB LINESCORE', 'HOME 1')).text, '');
    await win.screenshot({ path: path.join(SHOTS, 'bb-2-linescore.png') });
  });
  await test('changing a team color in Teams & rosters recolors the bug on air', async () => {
    await win.click('.bb-tabs [data-view="teams"]');
    await win.evaluate(() => { const el = document.querySelector('[data-tf="color"][data-team="home"]'); el.value = '#2b6be0'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(200);
    assert.match((await onAir('BB SCOREBUG', 'HOME BAR')).fill, /rgb\(43, 107, 224\)/);
    await win.screenshot({ path: path.join(SHOTS, 'bb-3-teams.png') });
  });
  await test('roster CSV import replaces the roster and batting order', async () => {
    const csv = path.join(os.tmpdir(), 'kl-bb-roster.csv');
    fs.writeFileSync(csv, 'num,first,last,pos,avg,hr,rbi,photo\n' + ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'].map((p, i) => `${i + 1},Test,Player${i + 1},${p},.250,${i},${i * 3},`).join('\n'));
    win.once('dialog', d => d.accept());
    await win.setInputFiles('[data-csv="home"]', csv);
    await win.waitForFunction(() => __kl.P.baseball.teams.home.roster.length === 10);
    assert.strictEqual(await win.evaluate(() => __kl.P.baseball.teams.home.lineup.length), 9);
  });
  await test('graphics setup lists every live field with its current value', async () => {
    await win.click('.bb-tabs [data-view="setup"]');
    const n = await win.locator('.bb-fields tbody tr').count();
    assert.ok(n > 300, 'fields: ' + n);
    assert.ok(await win.isVisible('.bb-fields button:text-is("bat.last")'));
    await win.screenshot({ path: path.join(SHOTS, 'bb-4-fields.png') });
    await win.click('.bb-tabs [data-view="game"]');
  });

  console.log('Bug control');
  const takeOn = name => win.evaluate(n => { const t = __kl.P.takes.find(x => x.name === n); return !!Object.values(__kl.programs).some(p => Object.values(p.layers).some(l => l.msg.takeId === t.id)); }, name);
  await test('starter graphics fill in the bug parts and automatic takes', async () => {
    const r = await win.evaluate(() => { const b = __kl.P.baseball; const nm = id => (__kl.P.takes.find(t => t.id === id) || {}).name; return { parts: b.bug.parts.map(p => p.id + ':' + nm(p.take)), run: nm(b.auto.runTake), ev: nm(b.auto.eventTake) }; });
    assert.ok(r.parts.includes('box:Baseball: AT-BAT BOX'), r.parts.join());
    assert.ok(r.parts.includes('scoreboard:Baseball: LINESCORE'));
    assert.strictEqual(r.run, 'Baseball: RUN SCORES / HOME RUN'); assert.strictEqual(r.ev, 'Baseball: PLAY POPUP');
  });
  await test('F7 toggles the at-bat box on and off; BUG OUT clears every part', async () => {
    await win.evaluate(() => __kl.act.clearAll && document.activeElement && document.activeElement.blur());
    await win.keyboard.press('F7'); await sleep(700);
    assert.strictEqual(await takeOn('Baseball: AT-BAT BOX'), true);
    assert.strictEqual((await onAir('BB AT BAT BOX', 'PITCHER')).text, 'CORRIGAN', 'home team at bat, away pitching');
    await win.keyboard.press('F7'); await sleep(700);
    assert.strictEqual(await takeOn('Baseball: AT-BAT BOX'), false);
    await win.keyboard.press('F1'); await win.keyboard.press('F8'); await sleep(600);
    assert.strictEqual(await takeOn('Baseball: TOP NOTE'), true);
    await win.click('[data-bugout]'); await sleep(700);
    for (const n of ['Baseball: SCOREBUG', 'Baseball: TOP NOTE']) assert.strictEqual(await takeOn(n), false, n);
    await win.keyboard.press('F1'); await sleep(600);
    assert.strictEqual(await takeOn('Baseball: SCOREBUG'), true);
  });
  await test('notes fill themselves by type; custom text works', async () => {
    await win.fill('#bbEv', '104'); await win.fill('#bbLa', '28'); await win.fill('#bbDist', '412'); await win.click('#bbHitGo');
    assert.match(await win.textContent('#bbNotes'), /EXIT VELO 104 MPH · 28° · 412 FT/);
    await win.selectOption('[data-note-type="bottom"]', 'custom');
    await win.fill('[data-note-text="bottom"]', 'Career high 3 hits'); await win.press('[data-note-text="bottom"]', 'Tab');
    await win.keyboard.press('F9'); await sleep(700);
    assert.strictEqual((await onAir('BB NOTE BOTTOM', 'NOTE')).text, 'Career high 3 hits');
    await win.keyboard.press('F9'); await sleep(500);
  });
  await test('strikeout looking (Shift+K) fires the play popup with ꓘ', async () => {
    await win.click('#bbLast');
    await win.keyboard.press('Shift+K'); await sleep(800);
    assert.strictEqual((await game()).event.kind, 'kl');
    assert.strictEqual((await onAir('BB PLAY POPUP', 'SHORT')).text, 'ꓘ');
    assert.strictEqual((await onAir('BB PLAY POPUP', 'LABEL')).text, 'STRIKEOUT LOOKING');
    assert.match((await onAir('BB PLAY POPUP', 'TEXT')).text, /K FOR CORRIGAN/);
  });
  await test('a run takes the RUN SCORES takeover and holds the bug score until it covers', async () => {
    const before = await runs('home');
    await win.evaluate(() => __kl.bbDispatch({ type: 'result', kind: 'hr' }));
    await sleep(120);
    assert.strictEqual(await takeOn('Baseball: RUN SCORES / HOME RUN'), true);
    assert.strictEqual((await onAir('BB SCOREBUG', 'HOME SCORE')).text, String(before), 'score still held');
    assert.strictEqual((await onAir('BB RUN SCORES', 'LABEL')).text, 'HOME RUN');
    await sleep(600);
    assert.strictEqual((await onAir('BB SCOREBUG', 'HOME SCORE')).text, String(before + 1), 'score revealed');
    const masked = await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'BB RUN SCORES'); const o = sc.objects.find(x => x.name === 'LABEL'); return document.querySelector(`#pgmLayers1 .go[data-id="${o.id}"]`).style.maskImage; });
    assert.match(masked, /^url\("data:image\/svg/, 'takeover is revealed through a shape mask');
    await win.screenshot({ path: path.join(SHOTS, 'bb-6-takeover.png') });
  });
  await test('LOB counts runners stranded at the end of a half', async () => {
    const lob = (await game()).lob.home;
    await win.evaluate(() => { __kl.bbDispatch({ type: 'result', kind: 'bb' }); });
    const outs = 3 - (await game()).outs;
    for (let i = 0; i < outs; i++) await win.evaluate(() => __kl.bbDispatch({ type: 'result', kind: 'out' }));
    assert.strictEqual((await game()).lob.home, lob + 1);
  });
  await test('data delay: graphics follow the game later', async () => {
    await win.evaluate(() => __kl.bbDispatch({ type: 'auto', delayMs: 800 }));
    const ct = (await onAir('BB SCOREBUG', 'COUNT')).text;
    await win.evaluate(() => __kl.bbDispatch({ type: 'pitch', kind: 'ball' }));
    await sleep(300);
    assert.strictEqual((await onAir('BB SCOREBUG', 'COUNT')).text, ct, 'not yet');
    await sleep(800);
    assert.notStrictEqual((await onAir('BB SCOREBUG', 'COUNT')).text, ct, 'arrived');
    await win.evaluate(() => __kl.bbDispatch({ type: 'auto', delayMs: 0 }));
  });
  await test('Bug Control screenshot', async () => { await win.screenshot({ path: path.join(SHOTS, 'bb-7-bugcontrol.png') }); });

  console.log('Masks');
  await test('shape, inverted, feathered and image masks render as CSS masks', async () => {
    const r = await win.evaluate(() => {
      const mkO = (type, name, x, y, w, h, p) => ({ id: name, name, type, x, y, w, h, alpha: 100, visible: true, anim: { in: 'none' }, p: Object.assign({}, KL.DEF[type], p) });
      const objs = [mkO('rect', 'A', 0, 0, 400, 200, { fill: '#f00' }), mkO('rect', 'MA', 50, 0, 300, 200, { shape: 'chevron' }), mkO('image', 'MI', 0, 0, 200, 200, { src: KL.LOGO })];
      objs[0].mask = 'MA'; objs[0].maskMode = 'shape'; objs[1].rotation = 15;
      const host = document.createElement('div'); document.body.append(host);
      const sc = { objects: objs, tl: { fps: 30, pause: 30, end: 45 } };
      const pl = new KL.Player(host, sc, {}); const el = host.querySelector('[data-id="A"]');
      const shape = decodeURIComponent(el.style.maskImage);
      objs[0].maskInvert = true; objs[0].maskFeather = 20; pl.seek(30); const inv = decodeURIComponent(el.style.maskImage);
      objs[0].mask = 'MI'; objs[0].maskMode = 'alpha'; objs[0].maskInvert = false; objs[0].maskFeather = 0; pl.seek(30); const img = el.style.maskImage;
      objs[0].maskMode = 'box'; pl.seek(30); const box = [el.style.maskImage, el.style.clipPath];
      host.remove();
      return { shape, inv, img, box };
    });
    assert.match(r.shape, /<polygon points=/); assert.match(r.shape, /rotate\(15\)/);
    assert.match(r.inv, /<mask id='m'/); assert.match(r.inv, /feGaussianBlur stdDeviation='10'/);
    assert.match(r.img, /^url\("data:image\/svg\+xml/); // the logo itself is an SVG data URI
    assert.strictEqual(r.box[0], ''); assert.match(r.box[1], /^inset\(/);
  });

  console.log('Design integration');
  await test('Edit opens a baseball scene in Layout mode; a design change shows on air', async () => {
    await win.click('.bb-tabs [data-view="setup"]');
    await win.click('[data-edit] >> text=Edit BB SCOREBUG');
    assert.strictEqual(await win.evaluate(() => __kl.ui.mode), 'layout');
    assert.strictEqual(await win.evaluate(() => __kl.P.scenes.find(s => s.id === __kl.ui.sceneId).name), 'BB SCOREBUG');
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'BB SCOREBUG'); const o = sc.objects.find(x => x.name === 'BUG PANEL'); __kl.setProp(o, 'w', 520); __kl.sceneChanged(); });
    await sleep(300);
    const w = await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'BB SCOREBUG'); const o = sc.objects.find(x => x.name === 'BUG PANEL'); return document.querySelector(`#pgmLayers1 .go[data-id="${o.id}"]`).style.width; });
    assert.strictEqual(w, '520px');
    await win.screenshot({ path: path.join(SHOTS, 'bb-5-layout.png') });
  });
  await test('design undo in Layout mode does not rewind the score', async () => {
    const before = await runs('away'), home = await runs('home'), scenes = await win.evaluate(() => __kl.P.scenes.length);
    await win.evaluate(() => __kl.act.dupScene());
    assert.strictEqual(await win.evaluate(() => __kl.P.scenes.length), scenes + 1);
    await win.evaluate(() => __kl.bbDispatch({ type: 'runs', team: 'home', delta: 1 }));
    await win.evaluate(() => document.activeElement && document.activeElement.blur());
    await osKey(app, 'Z', ['control']); await sleep(250);
    assert.strictEqual(await win.evaluate(() => __kl.P.scenes.length), scenes, 'duplicate scene undone');
    assert.strictEqual(await runs('home'), home + 1, 'the run scored after it is kept');
    assert.strictEqual(await runs('away'), before);
  });
  await test('Sequence mode: the DL editor picks baseball fields by name', async () => {
    await win.keyboard.press('F4');
    const id = await win.evaluate(() => __kl.P.takes.find(t => t.name === 'Baseball: BATTER').id);
    await win.click(`#rundown tr[data-id="${id}"]`);
    await sleep(200);
    const vals = await win.evaluate(() => [...document.querySelectorAll('#tiBody input.bbfield')].map(i => i.value));
    assert.ok(vals.includes('bat.name'), vals.join());
    const shown = await win.evaluate(() => [...document.querySelectorAll('#tiBody .dlval')].map(e => e.textContent).join('|'));
    const now = await win.evaluate(() => new Map(__kl.ui.bbRows.map(r => [r[0], r[1]])).get('bat.name'));
    assert.ok(shown.includes('= ' + now), `${shown} should show the batter now up, ${now}`);
  });

  console.log('Control');
  await test('RossTalk BB commands score the game', async () => {
    const b = (await game()).balls;
    await tcp('BB pitch kind=ball\r\n');
    assert.strictEqual((await game()).balls, b + 1);
  });
  await test('HTTP /api/baseball/… scores and /api/baseball/state returns live fields', async () => {
    const r = await getJson('/api/baseball/result?kind=1b');
    assert.strictEqual(r.ok, true);
    const st = await getJson('/api/baseball/state');
    assert.strictEqual(st.fields['runners'], 'Runner on 1st');
    assert.strictEqual(st.fields['home.abbr'], 'RDG');
    const bad = await getJson('/api/baseball/nope');
    assert.strictEqual(bad.ok, false);
  });
  await test('the game saves inside the project file', async () => {
    const home = await runs('home');
    const txt = await win.evaluate(() => JSON.stringify(__kl.P));
    const p = JSON.parse(txt);
    assert.ok(p.baseball && p.baseball.teams.home.roster.length === 10);
    await win.evaluate(t => __kl.loadProject(JSON.parse(t), null), txt);
    assert.strictEqual(await runs('home'), home);
  });
  await test('no renderer errors', () => assert.deepStrictEqual(errors.filter(e => !/Autofill/.test(e)), []));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
