/* End-to-end: start the server, drive the operator console in Chromium, check the
   program output, and save screenshots to test/shots/. node test/e2e.js */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { chromium } = require('playwright');

const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(__dirname, 'shots');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bullpen-e2e-'));
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const state = async () => (await fetch(BASE + '/api/state')).json();
async function waitFor(fn, what, ms = 4000) {
  const t0 = Date.now();
  for (;;) {
    const s = await state();
    if (fn(s)) return s;
    if (Date.now() - t0 > ms) throw new Error('Timed out waiting for ' + what);
    await sleep(60);
  }
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', BULLPEN_DATA: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('running')) r(); }));
  const browser = await chromium.launch();
  let ok = 0;
  const step = async (name, fn) => { await fn(); ok++; console.log('  ok   ' + name); };
  const errors = [];
  try {
    const op = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    op.on('pageerror', err => errors.push('operator: ' + err.message));
    await op.goto(BASE + '/');
    await op.waitForSelector('#conn.ok');

    const out = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    out.on('pageerror', err => errors.push('output: ' + err.message));
    await out.goto(BASE + '/output?bg=3a5a3a');
    await out.waitForSelector('.bug');

    await step('keyboard pitches update the count and bug', async () => {
      await op.click('.brand');
      await op.keyboard.press('b'); await op.keyboard.press('s');
      await waitFor(s => s.game.balls === 1 && s.game.strikes === 1, 'count 1-1');
      await out.waitForFunction(() => document.querySelector('.bug .ct').textContent === '1-1');
    });

    await step('double puts the runner on second', async () => {
      await op.click('[data-res="2b"]');
      const s = await waitFor(s => s.game.bases[1], 'runner on second');
      assert.strictEqual(s.game.hits.away, 1);
      await out.waitForFunction(() => document.querySelectorAll('.bug-bases rect.on').length === 1);
    });

    await step('home run scores two and shows on the bug', async () => {
      await op.click('[data-res="hr"]');
      await waitFor(s => BPruns(s, 'away') === 2, 'two runs');
      await out.waitForFunction(() => document.querySelector('[data-k="score-away"]').textContent === '2');
    });

    await step('undo takes the home run back', async () => {
      await op.click('#undo');
      await waitFor(s => BPruns(s, 'away') === 0 && s.game.bases[1], 'undo');
      await op.click('#redo');
      await waitFor(s => BPruns(s, 'away') === 2, 'redo');
    });

    await step('preview then take the batter lower third', async () => {
      await op.click('#lib button:has-text("Batter")');
      await waitFor(s => s.gfx.preview && s.gfx.preview.type === 'batter', 'preview');
      await op.click('#take');
      await waitFor(s => s.gfx.lower && s.gfx.lower.type === 'batter', 'batter on air');
      await out.waitForSelector('.slot-lower .l3');
      const name = await out.textContent('.l3-name .last');
      assert.strictEqual(name, 'Whitfield');
      await sleep(700);
      await out.screenshot({ path: path.join(SHOTS, 'out-batter.png') });
      await op.screenshot({ path: path.join(SHOTS, 'operator-game.png') });
    });

    await step('pitch speed flash under the bug', async () => {
      await op.fill('#mph', '98');
      await op.selectOption('#pitchType', 'Sinker');
      await op.click('#mphTake');
      await out.waitForSelector('.slot-flash .flash');
    });

    await step('three outs: MID 1, home bats', async () => {
      await op.keyboard.press('Escape');
      await op.click('[data-res="k"]'); await op.click('[data-res="out"]'); await op.click('[data-res="out"]');
      await waitFor(s => s.game.half === 'bottom' && s.game.transition, 'end of top half');
      await out.waitForFunction(() => document.querySelector('.bug .inn').textContent === 'MID 1');
    });

    await step('due up, matchup, linescore and pitcher graphics render', async () => {
      for (const [gfx, sel] of [['dueup', '.du'], ['linescore', '.ls'], ['matchup', '.mu'], ['pitcher', '.l3'], ['pitchcount', '.pcbox']]) {
        await fetch(`${BASE}/api/do/take?gfx=${gfx}`);
        await out.waitForSelector('.slot-lower:not(.out) ' + sel);
        await sleep(650);
        await out.screenshot({ path: path.join(SHOTS, `out-${gfx}.png`) });
      }
      await fetch(`${BASE}/api/do/clear?slot=lower`);
    });

    await step('ticker raises the lower third', async () => {
      await op.check('#tickerOn');
      await out.waitForSelector('.ticker');
      await fetch(`${BASE}/api/do/take?gfx=batter`);
      await out.waitForSelector('.slot-lower:not(.out) .l3');
      await sleep(800);
      const bottom = await out.$eval('.slot-lower:not(.out) .l3', el => getComputedStyle(el).bottom);
      assert.strictEqual(bottom, '128px');
      await out.screenshot({ path: path.join(SHOTS, 'out-ticker.png') });
      await op.uncheck('#tickerOn');
      await fetch(`${BASE}/api/do/clear?slot=all`);
    });

    await step('full-screen lineup and scoreboard', async () => {
      await op.dblclick('#lib button:has-text("Lineup") >> nth=1');
      await out.waitForSelector('.slot-full .card');
      assert.strictEqual(await out.$$eval('.slot-full .lu-row', r => r.length), 9);
      await sleep(600);
      await out.screenshot({ path: path.join(SHOTS, 'out-lineup.png') });
      await fetch(`${BASE}/api/do/take?gfx=scoreboard`);
      await out.waitForSelector('.slot-full:not(.out) .sb');
      await sleep(600);
      await out.screenshot({ path: path.join(SHOTS, 'out-scoreboard.png') });
      await fetch(`${BASE}/api/do/clear?slot=full`);
    });

    await step('auto-clear removes a timed graphic', async () => {
      await fetch(`${BASE}/api/do/take?gfx=linescore&secs=1`);
      await waitFor(s => s.gfx.lower, 'linescore on');
      await waitFor(s => !s.gfx.lower, 'linescore auto-cleared', 3000);
    });

    await step('key output is white on black', async () => {
      const key = await browser.newPage({ viewport: { width: 960, height: 540 } });
      await key.goto(BASE + '/output?key=1');
      await key.waitForSelector('.bug');
      const f = await key.$eval('.slot-bug', el => getComputedStyle(el).filter);
      assert.ok(/invert/.test(f), 'key filter applied');
      await key.close();
    });

    await step('teams tab: rename a team and import a CSV roster', async () => {
      await op.click('[data-tab="teams"]');
      const city = op.locator('[data-tf="city"][data-team="home"]');
      await city.fill('Ridgeview Heights'); await city.press('Tab');
      await waitFor(s => s.teams.home.city === 'Ridgeview Heights', 'rename');
      const csv = path.join(DATA, 'roster.csv');
      fs.writeFileSync(csv, 'num,first,last,pos,avg,hr,rbi\n' + Array.from({ length: 10 }, (_, i) => `${i + 1},Test,Player${i + 1},${['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'][i]},.250,${i},${i * 3}`).join('\n'));
      op.once('dialog', d => d.accept());
      await op.setInputFiles('[data-csv="home"]', csv);
      const s = await waitFor(s => s.teams.home.roster.length === 10, 'roster import');
      assert.strictEqual(s.teams.home.lineup.length, 9);
      await op.screenshot({ path: path.join(SHOTS, 'operator-teams.png') });
      await op.click('[data-tab="settings"]');
      await op.screenshot({ path: path.join(SHOTS, 'operator-settings.png') });
    });

    await step('state survives a restart (autosave)', async () => {
      await sleep(600);
      assert.ok(fs.existsSync(path.join(DATA, 'autosave.json')));
      const saved = JSON.parse(fs.readFileSync(path.join(DATA, 'autosave.json'), 'utf8'));
      assert.strictEqual(saved.teams.home.city, 'Ridgeview Heights');
    });

    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(`\n${ok} scenarios passed. Screenshots in ${SHOTS}`);
  } catch (err) {
    console.error('\nFAILED:', err.message, errors);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.kill();
  }
})();

function BPruns(s, k) { return s.game.runs[k].reduce((a, b) => a + b, 0); }
