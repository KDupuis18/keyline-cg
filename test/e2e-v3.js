/* End-to-end for v3 features: 3D text, shadows/outlines/shapes/masks, tickers, timers, two channels,
   key outputs, media store (images, WebM alpha video, fonts), zipped projects, JSON/Excel DataLinq, styles, undo.
   Run: xvfb-run -a node test/e2e-v3.js */
'use strict';
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const FX = path.join(__dirname, 'fixtures');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  ✔ ' + name); } catch (e) { fail++; console.log('  ✘ ' + name + '\n    ' + String(e.stack || e).split('\n').slice(0, 4).join('\n    ')); } }
const tcp = txt => new Promise((res, rej) => { const s = net.connect(7788, '127.0.0.1', () => { s.end(txt); setTimeout(res, 250); }); s.on('error', rej); });
const getJson = p => new Promise((res, rej) => http.get('http://127.0.0.1:8088' + p, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));
// real OS-level keys go through Electron's input pipeline (Playwright's synthetic keys skip it)
const osKey = (app, keyCode, modifiers) => app.evaluate(({ BrowserWindow }, a) => { const wc = BrowserWindow.getAllWindows()[0].webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: a.keyCode, modifiers: a.modifiers }); wc.sendInputEvent({ type: 'keyUp', keyCode: a.keyCode, modifiers: a.modifiers }); }, { keyCode, modifiers });
const dataUri = (file, mime) => `data:${mime};base64,` + fs.readFileSync(file).toString('base64');

(async () => {
  fs.rmSync(path.join(os.homedir(), '.config', 'Keyline CG Studio'), { recursive: true, force: true });
  const app = await electron.launch({ executablePath: require('electron'), args: [ROOT, '--no-sandbox'], env: Object.assign({}, process.env, { KEYLINE_NDI_LIB: path.join(__dirname, 'fake-ndi', 'libfakendi.so'), FAKE_NDI_OUT: path.join(__dirname, 'fake-ndi', 'out-v3.json') }) });
  const errors = [];
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push(e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1600, 960));
  await win.waitForFunction(() => window.__kl && window.KL3D);
  await sleep(600);
  const sceneId = name => win.evaluate(n => __kl.P.scenes.find(s => s.name === n).id, name);
  const openScene = async name => { await win.evaluate(id => { __kl.ui.sceneId = id; __kl.ui.selObj = null; __kl.act.tlHome(); __kl.setFrame(__kl.P.scenes.find(s => s.id === id).tl.pause); }, await sceneId(name)); await win.evaluate(() => { document.querySelector('#scenesL .scn.on')?.click(); }); };

  console.log('3D text, shadows, outlines, shapes, masks');
  await win.click('#scenesL .scn >> text=FS 3D TITLE');
  await sleep(400);
  await test('3D text renders extruded glyphs into its canvas', async () => {
    await win.waitForFunction(() => { const c = document.querySelector('#vpStage .go-text3d canvas'); if (!c || !c.width) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++; return n > 5000; }, null, { timeout: 15000 });
  });
  await test('3D text is lit: front and sides have different shading', async () => {
    const r = await win.evaluate(() => { const c = document.querySelector('#vpStage .go-text3d canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return set.size; });
    assert.ok(r > 20, 'distinct shades: ' + r);
  });
  await test('3D rotation keys (spin preset) change the render between frames', async () => {
    const hash = () => win.evaluate(() => { const c = document.querySelector('#vpStage .go-text3d canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
    const keys = await win.evaluate(() => Object.keys(__kl.P.scenes.find(s => s.name === 'FS 3D TITLE').objects[1].keys));
    assert.ok(keys.includes('rotY'), keys.join());
    await win.evaluate(() => __kl.setFrame(8)); await sleep(100); const a = await hash();
    await win.evaluate(() => __kl.setFrame(30)); await sleep(100); const b = await hash();
    assert.notStrictEqual(a, b);
  });
  await win.evaluate(() => __kl.setFrame(45));
  await sleep(300);
  await win.screenshot({ path: path.join(SHOTS, 'v3-1-3d-title-layout.png') });
  await test('adjustable shadow, glow and text outline are applied', async () => {
    const r = await win.evaluate(() => { const els = [...document.querySelectorAll('#vpStage .go')]; const sub = els.find(e => e.textContent.includes('Kickoff')); const glow = els[0]; return { sub: sub.style.filter, stroke: sub.style.webkitTextStroke, glow: glow.style.filter, shape: glow.firstChild.style.borderRadius }; });
    assert.match(r.sub, /drop-shadow\(rgba\(0, 0, 0, 0\.7\) 4\.2px 4\.2px 14px\)/); assert.match(r.stroke, /2px/);
    assert.match(r.glow, /drop-shadow\(rgba\(242, 194, 0, 0\.7\) 0px 0px 80px\)/); assert.strictEqual(r.shape, '50%');
  });
  await test('shadow controls in the inspector update the object live', async () => {
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'FS 3D TITLE'); __kl.ui.selObj = sc.objects[2].id; __kl.ui.inspTab = 'style'; __kl.act.tlHome(); __kl.setFrame(45); });
    const blur = win.locator('#inspBody .fl:text("Softness") + input');
    await blur.fill('40'); await blur.dispatchEvent('input');
    const f = await win.evaluate(() => [...document.querySelectorAll('#vpStage .go')].find(e => e.textContent.includes('Kickoff')).style.filter);
    assert.match(f, /40px/);
  });
  await test('shapes (tab clip-path) and masks (inset from mask box)', async () => {
    await win.click('#scenesL .scn >> text=L3 TICKER'); await sleep(300);
    const r = await win.evaluate(() => {
      const sc = __kl.P.scenes.find(s => s.name === 'L3 TICKER');
      const ticker = sc.objects.find(o => o.name === 'TICKER'), bar = sc.objects.find(o => o.name === 'Ticker Bar');
      ticker.mask = bar.id; bar.w = 1500; __kl.sceneChanged();
      const el = document.querySelector(`#vpStage .go[data-id="${ticker.id}"]`), tab = document.querySelector(`#vpStage .go[data-id="${sc.objects[1].id}"] .f`);
      return { clip: el.style.clipPath, tab: tab.style.clipPath };
    });
    assert.match(r.tab, /polygon/); assert.strictEqual(r.clip, 'inset(0px 420px 0px 0px)');
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'L3 TICKER'); delete sc.objects.find(o => o.name === 'TICKER').mask; sc.objects[0].w = 1920; __kl.sceneChanged(); });
  });

  console.log('Ticker, timers, channels');
  await win.keyboard.press('F4'); await sleep(400);
  await test('ticker crawls continuously on air', async () => {
    await tcp('SEQI 1012\r\n'); await sleep(900);
    const x1 = await win.evaluate(() => document.querySelector('#pgmLayers1 .go-ticker .tk').style.transform);
    await sleep(500);
    const x2 = await win.evaluate(() => document.querySelector('#pgmLayers1 .go-ticker .tk').style.transform);
    const n = s => -parseFloat(s.match(/-?[\d.]+/)[0]);
    assert.ok(n(x2) - n(x1) > 60 && n(x2) - n(x1) < 110, `${x1} -> ${x2}`);
  });
  await test('game clock: RossTalk TIMER SET/START/STOP and HTTP reset', async () => {
    await tcp('SEQI 1007\r\n'); await tcp('TIMER GAME:SET:1:05\r\n'); await tcp('TIMER GAME:START\r\n');
    await sleep(1300);
    const txt = await win.evaluate(() => [...document.querySelectorAll('#pgmLayers1 [data-clock]')].map(e => e.textContent).join('|'));
    assert.match(txt, /1:0[34]/);
    await tcp('TIMER GAME:STOP\r\n'); const s1 = await getJson('/api/state'); await sleep(400); const s2 = await getJson('/api/state');
    assert.strictEqual(s1.timers.GAME.value, s2.timers.GAME.value); assert.strictEqual(s2.timers.GAME.running, false);
    await getJson('/api/timer/GAME/reset'); const s3 = await getJson('/api/state'); assert.strictEqual(s3.timers.GAME.value, '12:00');
  });
  await test('under one minute the game clock shows tenths', async () => {
    await tcp('TIMER GAME:SET:0:42.5\r\n'); await sleep(200);
    const txt = await win.evaluate(() => [...document.querySelectorAll('#pgmLayers1 [data-clock]')].map(e => e.textContent).join('|'));
    assert.match(txt, /42\.5/);
  });
  await test('channel 2 is independent: take, output window, clear', async () => {
    await win.evaluate(() => window.kl.listDisplays().then(d => window.kl.openScreen(d[0].id, 2, 'fill')));
    await sleep(1200);
    await tcp('SEQI 1013\r\n'); await sleep(600);
    const st = await getJson('/api/state');
    assert.ok(st.layers.some(l => l.channel === 2 && l.layer === 31), JSON.stringify(st.layers));
    const out = app.windows().find(p => p.url().includes('output.html') && p.url().includes('ch=2'));
    assert.ok(out, 'channel 2 output window');
    assert.deepStrictEqual(await out.evaluate(() => Object.keys(window.__program.layers)), ['31']);
    await tcp('CLFB 2\r\n'); await sleep(900);
    const st2 = await getJson('/api/state');
    assert.ok(!st2.layers.some(l => l.channel === 2), 'ch2 cleared'); assert.ok(st2.layers.some(l => l.channel === 1), 'ch1 untouched');
    await win.evaluate(() => window.kl.closeScreen());
  });
  await tcp('SEQI 1011\r\n'); await sleep(2200);
  await win.evaluate(() => { document.querySelector('#pgmCh1').click(); });
  await sleep(200);
  await win.screenshot({ path: path.join(SHOTS, 'v3-2-sequence-3d-ticker.png') });
  await test('key output renders alpha as white on black', async () => {
    await win.evaluate(() => window.kl.listDisplays().then(d => window.kl.openScreen(d[0].id, 1, 'key')));
    await sleep(1500);
    const out = app.windows().find(p => p.url().includes('mode=key'));
    const png = await out.screenshot({ path: path.join(SHOTS, 'v3-3-key-output.png') });
    const { execFileSync } = require('child_process');
    const stats = execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open(r'${path.join(SHOTS, 'v3-3-key-output.png')}').convert('RGB')\npx=list(im.getdata())\nwhite=sum(1 for p in px if min(p)>240)\nblack=sum(1 for p in px if max(p)<15)\ncolor=sum(1 for p in px if max(p)-min(p)>40)\nprint(white,black,color,len(px))`]).toString().trim().split(' ').map(Number);
    const [white, black, color, total] = stats;
    assert.ok(white / total > 0.03, 'white ' + white); assert.ok(black / total > 0.4, 'black ' + black); assert.ok(color / total < 0.001, 'no colour in a key signal: ' + color);
    await win.evaluate(() => window.kl.closeScreen());
  });
  await test('NDI: two channels with fill + key start as four senders on worker threads', async () => {
    await win.evaluate(() => { const S = JSON.parse(localStorage.getItem('keyline-cg-settings-v1') || '{}'); }); // settings live in the app; set through the UI object
    await win.evaluate(async () => { window.__S = true; });
    const r = await win.evaluate(async () => {
      const plan = [{ ch: 1, mode: 'fill', name: 'T1' }, { ch: 1, mode: 'key', name: 'T1 (Key)' }, { ch: 2, mode: 'fill', name: 'T2' }, { ch: 2, mode: 'key', name: 'T2 (Key)' }];
      const res = []; for (const p of plan) res.push(await window.kl.ndiStart(Object.assign({ fps: '59.94' }, p)));
      await new Promise(r => setTimeout(r, 2500));
      const st = await window.kl.ndiStatus(); await window.kl.ndiStop(); return { res, st };
    });
    assert.ok(r.res.every(x => x.ok), JSON.stringify(r.res));
    assert.strictEqual(r.st.length, 4);
    for (const s of r.st) assert.ok(s.frames > 20, `${s.id} sent ${s.frames} frames`); // the fake runtime writes an 8 MB dump per frame, so this is disk-bound
  });
  await test('UI stays responsive while 4 NDI senders run (main process not blocked)', async () => {
    await win.evaluate(async () => { for (const p of [{ ch: 1, mode: 'fill' }, { ch: 1, mode: 'key' }, { ch: 2, mode: 'fill' }, { ch: 2, mode: 'key' }]) await window.kl.ndiStart(Object.assign({ fps: '59.94', name: 'R' + p.ch + p.mode }, p)); });
    await sleep(800);
    const t0 = Date.now(); for (let i = 0; i < 10; i++) await getJson('/api/state'); const ms = (Date.now() - t0) / 10;
    await win.evaluate(() => window.kl.ndiStop());
    assert.ok(ms < 60, 'RossTalk/HTTP round-trip ' + ms.toFixed(1) + ' ms');
  });

  console.log('Media, fonts, projects');
  await test('images go to the media store and load via kl-media://', async () => {
    const r = await win.evaluate(async uri => { const url = await window.kl.storeDataUri(uri); const img = new Image(); img.src = url; await img.decode(); return { url, w: img.naturalWidth }; }, dataUri(path.join(FX, 'logo.png'), 'image/png'));
    assert.match(r.url, /^kl-media:\/\/[a-f0-9]{40}\.png$/); assert.strictEqual(r.w, 128);
  });
  await test('WebM video with alpha plays from the media store (range requests)', async () => {
    const r = await win.evaluate(async uri => {
      const url = await window.kl.storeDataUri(uri);
      const v = document.createElement('video'); v.muted = true; v.loop = true; v.src = url; document.body.append(v);
      await v.play(); await new Promise(r => setTimeout(r, 700));
      const res = { url, ready: v.readyState, t: v.currentTime, w: v.videoWidth }; v.remove(); return res;
    }, dataUri(path.join(FX, 'alpha.webm'), 'video/webm'));
    assert.ok(r.ready >= 2 && r.t > 0.2 && r.w === 320, JSON.stringify(r));
  });
  await test('custom fonts register and work in 2D and 3D text', async () => {
    const r = await win.evaluate(async uri => {
      const url = await window.kl.storeDataUri(uri);
      __kl.P.fonts.push({ family: 'My Brand Font', url }); KL.setFonts(__kl.P.fonts);
      const faces = await document.fonts.load('40px "My Brand Font"');
      return { faces: faces.length, url };
    }, dataUri(path.join(ROOT, 'node_modules/@fontsource/teko/files/teko-latin-600-normal.woff'), 'font/woff'));
    assert.strictEqual(r.faces, 1); assert.match(r.url, /\.woff$/);
  });
  await test('older embedded images are moved out of the project', async () => {
    const big = dataUri(path.join(FX, 'logo.png'), 'image/png') + ''.padEnd(0);
    const r = await win.evaluate(async uri => {
      const sc = __kl.P.scenes.find(s => s.name === 'FS BULLETS');
      const img = sc.objects.find(o => o.type === 'image'); img.p.src = uri.repeat(1); // ~4 KB, below threshold: stays
      const p = JSON.parse(JSON.stringify(__kl.P)); p.scenes[0].objects.find(o => o.type === 'image').p.src = 'data:image/png;base64,' + 'A'.repeat(20000);
      __kl.loadProject(p, null); await new Promise(r => setTimeout(r, 800));
      return __kl.P.scenes[0].objects.find(o => o.type === 'image').p.src.slice(0, 11);
    }, big);
    assert.strictEqual(r, 'kl-media://');
  });
  await test('projects save as .klcg packages containing their media', async () => {
    const target = path.join(os.tmpdir(), 'kl-test-' + Date.now() + '.klcg');
    const saved = await win.evaluate(async t => window.kl.saveProject(JSON.stringify(__kl.P), t, false, 'x'), target);
    assert.strictEqual(saved, target);
    const zip = await require('jszip').loadAsync(fs.readFileSync(target));
    const names = Object.keys(zip.files);
    assert.ok(names.includes('project.json'), names.join());
    assert.ok(names.some(n => /^media\/[a-f0-9]{40}\.png$/.test(n)), names.join());
    const { createMedia } = require('../src/media');
    const m = createMedia(path.join(os.tmpdir(), 'kl-media-test-' + Date.now()));
    const txt = await m.unpackProject(fs.readFileSync(target));
    assert.ok(JSON.parse(txt).scenes.length > 5); assert.ok(fs.readdirSync(m.dir).length >= 1);
  });

  console.log('DataLinq: JSON, Excel, formatting');
  await test('JSON feed with a path becomes rows and columns', async () => {
    const r = await win.evaluate(async file => {
      const s = { id: 'jsonsrc', name: 'Scores', type: 'json', url: file, path: 'data.games', header: true, interval: 0, enabled: true };
      __kl.P.dataSources.push(s); await __kl.fetchSource(s); return __kl.DL.jsonsrc;
    }, path.join(FX, 'scores.json'));
    assert.strictEqual(r.error, null);
    assert.deepStrictEqual(r.rows[0], ['home.name', 'home.score', 'away.name', 'away.score', 'status']);
    assert.deepStrictEqual(r.rows[2], ['Lakewood', '77', 'Boise', '81', 'Q4 2:31']);
  });
  await test('Excel workbook: named sheet, numbers, booleans, formulas without cached values', async () => {
    const r = await win.evaluate(async file => {
      const s = { id: 'xl', name: 'Box', type: 'xlsx', url: file, sheet: 'Box', header: true, interval: 0, enabled: true };
      __kl.P.dataSources.push(s); await __kl.fetchSource(s); return __kl.DL.xl;
    }, path.join(FX, 'stats.xlsx'));
    assert.strictEqual(r.error, null, r.error);
    assert.deepStrictEqual(r.rows, [['Team', 'Score', 'Shots', 'Pct'], ['Ridgeline', '3', '31', '0.0968'], ['Harbor City', '2', '27', ''], ['Totals', '', '58', 'TRUE']]);
  });
  await test('formatting and color rules apply to linked values', async () => {
    const r = await win.evaluate(() => {
      const t = __kl.P.takes.find(x => x.num === 1007); const sc = __kl.P.scenes.find(s => s.id === t.sceneId);
      const s1 = sc.objects.find(o => o.name === 'SCORE 1'), team = sc.objects.find(o => o.name === 'TEAM 1');
      t.data[s1.id] = { link: { src: 'jsonsrc', row: '1', col: 'home.score', fmt: { prefix: '', suffix: ' pts' }, rule: { op: '>', value: '99', color: '#ffd400' } } };
      t.data[team.id] = { link: { src: 'jsonsrc', row: 'status=Final', col: 'home.name', fmt: { case: 'upper' } } };
      return __kl.contentOf(t) + ' || ' + JSON.stringify(window.__kl && (() => { const o = {}; return o; })());
    });
    assert.match(r, /RIDGELINE \| 104 pts/);
    const color = await win.evaluate(() => { __kl.handleControl('SEQI 1007'); return new Promise(res => setTimeout(() => res([...document.querySelectorAll('#pgmLayers1 .go-text')].find(e => e.textContent === '104 pts').style.color), 300)); });
    assert.strictEqual(color, 'rgb(255, 212, 0)');
  });
  await test('ticker linked to a whole column (Row = *)', async () => {
    const v = await win.evaluate(() => { const t = __kl.P.takes.find(x => x.num === 1012); const sc = __kl.P.scenes.find(s => s.id === t.sceneId); const tk = sc.objects.find(o => o.type === 'ticker'); t.data[tk.id] = { link: { src: 'jsonsrc', row: '*', col: 'home.name' } }; return __kl.contentOf(t); });
    assert.match(v, /\[ticker: 2 items\] Ridgeline/);
  });

  console.log('Editing: styles, undo, next preview');
  await test('next-take strip shows the following take', async () => {
    await win.evaluate(() => { __kl.ui.selTake = __kl.P.takes.find(t => t.num === 1004).id; __kl.act.playPvw(); });
    await win.click('#rundown tbody tr:nth-child(4) td:nth-child(4)');
    assert.match(await win.locator('#nextStrip').textContent(), /1005.*L3 WEATHER ALERT/);
  });
  await test('save a style from one object and apply it to another', async () => {
    await win.keyboard.press('F3'); await sleep(300);
    await win.click('#scenesL .scn >> text=L3 TOPIC BAR'); await sleep(300);
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR'); __kl.ui.selObj = sc.objects.find(o => o.name === 'FLAG').id; });
    await win.click('#styleList >> text=+ Save style');
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR'); __kl.ui.selObj = sc.objects.find(o => o.name === 'LINE 2').id; });
    await win.click('#styleList .stylechip >> text=FLAG style');
    const p = await win.evaluate(() => { const o = __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR').objects.find(o => o.name === 'LINE 2'); return [o.p.font, o.p.size, o.p.shadowOn, o.p.text]; });
    assert.deepStrictEqual(p, ['Oswald', 44, true, 'Vote passes 7-2 after four hours of debate']);
  });
  await test('Ctrl+Z goes through the Edit menu: one project undo outside text fields', async () => {
    await win.evaluate(() => document.activeElement && document.activeElement.blur());
    const font = () => win.evaluate(() => __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR').objects.find(o => o.name === 'LINE 2').p.font);
    await osKey(app, 'Z', ['control']); await sleep(300);
    assert.strictEqual(await font(), 'Barlow Condensed');
    await osKey(app, 'Y', ['control']); await sleep(300);
    assert.strictEqual(await font(), 'Oswald', 'redo');
    await osKey(app, 'Z', ['control']); await sleep(300);
  });
  await test('Ctrl+Z inside a text field undoes typing, not the project', async () => {
    await win.evaluate(() => { const sc = __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR'); __kl.ui.selObj = sc.objects.find(o => o.name === 'LINE 1').id; __kl.ui.inspTab = 'object'; __kl.setFrame(__kl.ui.frame); });
    await win.click('#scenesL .scn >> text=L3 TOPIC BAR');
    const n = await win.evaluate(() => __kl.P.scenes.length);
    const name = win.locator('#inspBody input.in').first();
    await name.click(); await name.press('End'); await name.type('XYZ'); await osKey(app, 'Z', ['control']); await sleep(200);
    assert.strictEqual(await win.evaluate(() => __kl.P.scenes.length), n);
    const v = await name.inputValue(), objName = await win.evaluate(() => __kl.P.scenes.find(s => s.name === 'L3 TOPIC BAR').objects.find(o => o.id === __kl.ui.selObj).name);
    assert.ok(!v.endsWith('XYZ'), 'field after undo: ' + v); assert.strictEqual(objName, v);
  });
  await test('no renderer errors', () => assert.deepStrictEqual(errors.filter(e => !/Autofill/.test(e)), []));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
