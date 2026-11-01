/* End-to-end: launches the real Electron app under Xvfb and drives it.
   Run: xvfb-run -a node test/e2e.js   (uses test/fake-ndi/libfakendi.so in place of the NDI runtime) */
'use strict';
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const NDI_OUT = path.join(__dirname, 'fake-ndi', 'out-e2e.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the fake NDI library rewrites its frame dump continuously from a worker thread; wait for a complete copy
async function waitDump(file = NDI_OUT + '.bgra', size = 1920 * 1080 * 4) { for (let i = 0; i < 40; i++) { try { if (fs.statSync(file).size === size) { const b = fs.readFileSync(file); if (b.length === size) return b; } } catch (e) { /* not yet */ } await sleep(50); } throw new Error('no complete NDI frame dump'); }
const readNdi = async () => { for (let i = 0; i < 20; i++) { try { return JSON.parse(fs.readFileSync(NDI_OUT, 'utf8')); } catch (e) { await sleep(50); } } throw new Error('no NDI status'); };
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  ✔ ' + name); } catch (e) { fail++; console.log('  ✘ ' + name + '\n    ' + String(e.stack || e).split('\n').slice(0, 4).join('\n    ')); } }
const tcp = txt => new Promise((res, rej) => { const s = net.connect(7788, '127.0.0.1', () => { s.end(txt); setTimeout(res, 250); }); s.on('error', rej); });
const getJson = p => new Promise((res, rej) => http.get('http://127.0.0.1:8088' + p, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));

(async () => {
  try { fs.unlinkSync(NDI_OUT); } catch (e) { /* none */ }
  fs.rmSync(path.join(require('os').homedir(), '.config', 'Keyline CG Studio'), { recursive: true, force: true }); // start from a clean profile (Linux test runner)
  const app = await electron.launch({
    executablePath: require('electron'), args: [ROOT, '--no-sandbox'],
    env: Object.assign({}, process.env, { KEYLINE_NDI_LIB: path.join(__dirname, 'fake-ndi', 'libfakendi.so'), FAKE_NDI_OUT: NDI_OUT })
  });
  const errors = [];
  const win = await app.firstWindow();
  win.on('pageerror', e => errors.push(e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await win.setViewportSize({ width: 1600, height: 960 }).catch(() => {});
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1600, 960); });
  await win.waitForFunction(() => window.__kl && document.querySelectorAll('#vpStage .go').length > 5);
  await sleep(800);

  console.log('Layout + keyframes');
  await test('fonts are bundled and load offline', async () => {
    const ok = await win.evaluate(async () => Promise.all(['600 40px "Oswald"', '700 40px "Barlow Condensed"', '400 40px "Anton"', '400 40px "Bebas Neue"', '700 40px "Teko"'].map(f => document.fonts.load(f).then(r => r.length))));
    assert.ok(ok.every(n => n > 0), 'faces loaded per font: ' + ok);
  });
  await win.screenshot({ path: path.join(SHOTS, '1-layout.png') });
  await test('preset animations were converted to editable keyframes', async () => {
    const n = await win.evaluate(() => __kl.P.scenes[0].objects.filter(o => o.keys && Object.keys(o.keys).length).length);
    assert.ok(n > 10, 'keyed objects: ' + n);
  });
  await test('frame stepping with , and . keys', async () => {
    await win.evaluate(() => __kl.setFrame(0)); await win.click('#vpWrap', { position: { x: 5, y: 5 } }).catch(() => {});
    await win.keyboard.press('Escape');
    for (let i = 0; i < 5; i++) await win.keyboard.press('.');
    await win.keyboard.press('Shift+.');
    await win.keyboard.press(',');
    assert.strictEqual(await win.evaluate(() => __kl.ui.frame), 14);
  });
  await test('manual keyframes: auto-key + drag in viewport writes keys and interpolates', async () => {
    // new scene with one quad
    await win.evaluate(() => __kl.act.newScene());
    await win.click('.libb >> text=Quad');
    await win.evaluate(() => __kl.setFrame(0));
    await win.keyboard.press('a'); // auto-key on
    const box = await win.locator('#vpStage .go').first().boundingBox();
    // key at frame 0 at current position
    await win.keyboard.press('k');
    await win.evaluate(() => __kl.setFrame(20));
    await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await win.mouse.down(); await win.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 + 60, { steps: 6 }); await win.mouse.up();
    const r = await win.evaluate(() => { const o = __kl.P.scenes.at(-1).objects[0]; return { kx: o.keys.x.map(k => [k.f, Math.round(k.v)]), mid: Math.round(KL.valueAt(o, 'x', 10)), s: document.querySelector('#vpWrap')._s }; });
    assert.strictEqual(r.kx.length, 2); assert.strictEqual(r.kx[0][0], 0); assert.strictEqual(r.kx[1][0], 20);
    const moved = r.kx[1][1] - r.kx[0][1];
    assert.ok(Math.abs(moved - 150 / r.s) < 4, 'moved ' + moved);
    assert.ok(r.mid > r.kx[0][1] && r.mid < r.kx[1][1], 'interpolates at frame 10');
  });
  await test('timeline: expand, drag a keyframe to a new frame, change easing', async () => {
    if (!(await win.evaluate(() => __kl.ui.expanded.has(__kl.P.scenes.at(-1).objects[0].id)))) await win.locator('.tllab[data-obj] .exp').first().click();
    const kf = win.locator('.tltrack.sub[data-prop="x"] .kf').nth(1);
    const b = await kf.boundingBox();
    const ppf = await win.evaluate(() => __kl.ui.ppf);
    await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await win.mouse.down(); await win.mouse.move(b.x + b.width / 2 + ppf * 10, b.y + b.height / 2, { steps: 5 }); await win.mouse.up();
    await win.selectOption('#tlEase', 'hold');
    const ks = await win.evaluate(() => __kl.P.scenes.at(-1).objects[0].keys.x.map(k => [k.f, k.e]));
    assert.deepStrictEqual(ks[1], [30, 'hold']);
  });
  await test('scrubbing the ruler moves the playhead and viewport', async () => {
    const r = await win.locator('.ruler').boundingBox();
    const ppf = await win.evaluate(() => __kl.ui.ppf);
    await win.mouse.click(r.x + ppf * 15 + 1, r.y + 12);
    assert.strictEqual(await win.evaluate(() => __kl.ui.frame), 15);
  });
  await win.keyboard.press('a');
  await win.evaluate(() => { __kl.ui.sceneId = __kl.P.scenes[0].id; __kl.ui.selObj = __kl.P.scenes[0].objects[5].id; __kl.ui.expanded.add(__kl.P.scenes[0].objects[5].id); __kl.setFrame(12); });
  await sleep(300);
  await win.screenshot({ path: path.join(SHOTS, '2-timeline.png') });

  console.log('vMix title import');
  await test('legacy XAML title converts to scene with published fields', async () => {
    const r = await win.evaluate(({ xaml, png }) => { const { scene, warnings } = GTImport.convert({ name: 'lower-third', file: 'x', entries: [{ path: 'lower-third.xaml', text: xaml }, { path: 'logo.png', dataUri: png }] }); return { names: scene.objects.map(o => `${o.type}:${o.name}:${o.x},${o.y},${o.w}x${o.h}`), pubs: scene.objects.filter(o => o.published).map(o => o.name), img: scene.objects.find(o => o.type === 'image').p.src.slice(0, 22), warnings, txt: scene.objects.find(o => o.name === 'Description').p.text, bugAlign: scene.objects.find(o => o.name === 'Bug').p.align }; },
      { xaml: fs.readFileSync(path.join(__dirname, 'fixtures/lower-third.xaml'), 'utf8'), png: 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'fixtures/logo.png')).toString('base64') });
    assert.deepStrictEqual(r.pubs, ['Headline', 'Description', 'Logo', 'Bug']);
    assert.ok(r.names.includes('text:Headline:130,860,1100x60'), r.names.join(' | '));
    assert.ok(r.names.some(n => n.startsWith('text:Bug:1520,70')), 'grid margin offset: ' + r.names.join(' | '));
    assert.strictEqual(r.img, 'data:image/png;base64,');
    assert.strictEqual(r.txt, 'Description text'); assert.strictEqual(r.bugAlign, 'center');
    assert.strictEqual(r.warnings.length, 0);
  });
  await test('.gtzip package (zip + gtxml + image) scales 1280×720 design to 1080p', async () => {
    const pkg = await require('../src/titlepkg').readTitlePackage(path.join(__dirname, 'fixtures/sample.gtzip'));
    const r = await win.evaluate(pkg => { const { scene } = GTImport.convert(pkg); __kl.P.scenes.push(scene); return { design: scene.source.design, objs: scene.objects.map(o => `${o.type}:${o.name}:${o.x},${o.y},${o.w}x${o.h}`), font: scene.objects.find(o => o.name === 'Headline').p.size, fill: scene.objects.find(o => o.type === 'rect').p.fill }; }, pkg);
    assert.strictEqual(r.design, '1280×720');
    assert.ok(r.objs.includes('text:Headline:120,825,990x84'), r.objs.join(' | '));
    assert.ok(r.objs.includes('image:Logo:1170,810,165x165'), r.objs.join(' | '));
    assert.strictEqual(r.font, 60); assert.match(r.fill, /^rgba\(30,74,140,0\.8/);
  });

  console.log('Sequencer, program, DataLinq');
  await win.keyboard.press('F4');
  await sleep(500);
  await test('Space takes the selected item and advances', async () => {
    await win.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    await win.click('#rundown tbody tr:nth-child(2) td:nth-child(4)');
    await win.keyboard.press('Space');
    await sleep(200);
    const r = await win.evaluate(() => ({ layers: Object.keys(__kl.program.layers), sel: __kl.P.takes.find(t => t.id === __kl.ui.selTake).num }));
    assert.deepStrictEqual(r.layers, ['0']); assert.strictEqual(r.sel, 1003);
  });
  await test('DataLinq: linked take shows roster values (Jersey=88)', async () => {
    const c = await win.evaluate(() => __kl.contentOf(__kl.P.takes.find(t => t.num === 1010)));
    assert.match(c, /Tomas \| Okonkwo \| 88 \| TE/);
  });

  console.log('RossTalk + HTTP (live sockets)');
  await test('RossTalk SEQI over TCP takes an L3 onto layer 20', async () => {
    await tcp('SEQI 1004:20\r\n'); await sleep(900);
    const ls = await win.evaluate(() => Object.keys(__kl.program.layers).sort());
    assert.deepStrictEqual(ls, ['0', '20']);
  });
  await test('RossTalk SETDATA updates the on-air L3 text', async () => {
    await tcp('SETDATA 1004:LINE 1:Results certified at 11:58 PM\r\n'); await sleep(300);
    const txt = await win.evaluate(() => [...document.querySelectorAll('#pgmLayers1 .layer')].map(l => l.textContent).join(' '));
    assert.match(txt, /Results certified at 11:58 PM/);
  });
  await win.screenshot({ path: path.join(SHOTS, '3-sequence-onair.png') });
  await test('HTTP /api/takes and /api/state', async () => {
    const t = await getJson('/api/takes'); assert.strictEqual(t.takes.length, 13); assert.ok(t.takes.find(x => x.id === 1004).onAir);
    const s = await getJson('/api/state'); assert.deepStrictEqual(s.layers.map(l => l.layer).sort(), [0, 20]);
  });

  console.log('NDI (fake runtime) + fullscreen output');
  await test('NDI starts and sends 1920×1080 BGRA frames with key', async () => {
    await win.evaluate(() => __kl.act.toggleNdi());
    await sleep(2500);
    const r = await readNdi();
    assert.strictEqual(r.name, 'Keyline CG'); assert.strictEqual(r.xres, 1920); assert.strictEqual(r.yres, 1080);
    assert.strictEqual(r.fourcc, 0x41524742); assert.strictEqual(r.N, 30000); assert.strictEqual(r.D, 1001);
    assert.ok(r.frames > 20, 'frames ' + r.frames);
    assert.ok(r.opaque > 1920 * 1080 * 0.9, 'full-screen graphic is opaque: ' + r.opaque);
  });
  await test('NDI alpha: lower third alone keys over transparency', async () => {
    await tcp('CLFB 1:0\r\n'); await sleep(1600);
    const r = await readNdi();
    const frac = r.opaque / (1920 * 1080);
    assert.ok(frac > 0.02 && frac < 0.2, 'opaque fraction ' + frac.toFixed(3));
    const { execFileSync } = require('child_process');
    fs.writeFileSync(NDI_OUT + '.stable.bgra', await waitDump());
    execFileSync('python3', ['-c', `from PIL import Image\nraw=open(r'${NDI_OUT}.stable.bgra','rb').read()\nim=Image.frombuffer('RGBA',(1920,1080),raw,'raw','BGRA',0,1)\nbg=Image.new('RGBA',im.size,(40,160,60,255))\nbg.alpha_composite(im)\nbg.convert('RGB').resize((960,540)).save(r'${path.join(SHOTS, '4-ndi-frame-over-green.png')}')`]);
  });
  await test('fullscreen output window mirrors program', async () => {
    await win.evaluate(() => window.kl.listDisplays().then(d => window.kl.openScreen(d[0].id)));
    await sleep(1500);
    const pages = app.windows();
    const out = pages.find(p => p.url().includes('output.html') && p !== win && p.url().includes('bg=black'));
    assert.ok(out, 'output window present');
    const ls = await out.evaluate(() => Object.keys(window.__program.layers));
    assert.deepStrictEqual(ls, ['20']);
    await out.screenshot({ path: path.join(SHOTS, '5-fullscreen-output.png') });
    await win.evaluate(() => window.kl.closeScreen());
  });
  await test('DataLinq live update reaches NDI output', async () => {
    await win.evaluate(() => { const s = __kl.P.dataSources[0]; s.text = s.text.replace('Okonkwo', 'Okonkwo-Reyes'); return __kl.fetchSource(s); });
    await tcp('SEQI 1010:0\r\n'); await sleep(1800);
    const ndiPage = app.windows().find(p => p.url().includes('bg=transparent'));
    const txt = ndiPage ? await ndiPage.evaluate(() => document.body.textContent) : '';
    assert.match(txt, /Okonkwo-Reyes/);
  });
  await win.screenshot({ path: path.join(SHOTS, '6-bio-datalinq.png') });
  await test('DashBoard panel XML is well-formed and has a button per take', async () => {
    const r = await win.evaluate(() => { const x = __kl.dashboardXML('10.0.0.5', 7788); const d = new DOMParser().parseFromString(x, 'application/xml'); return { err: !!d.querySelector('parsererror'), buttons: d.querySelectorAll('button').length, task: d.querySelector('button task').textContent, host: d.querySelector('param[oid=keyline_host]').getAttribute('value') }; });
    assert.strictEqual(r.err, false); assert.strictEqual(r.host, '10.0.0.5');
    assert.ok(r.buttons >= 4 + 10 * 2, 'buttons ' + r.buttons);
    assert.strictEqual(r.task, "rosstalk.sendMessage(params.getValue('keyline_host', 0), params.getValue('keyline_port', 0), 'NEXT');");
  });
  await test('DataLinq manager and Output & Control dialogs render', async () => {
    await win.evaluate(() => __kl.act.dataLinq()); await sleep(300);
    await win.screenshot({ path: path.join(SHOTS, '7-datalinq.png') });
    assert.ok(await win.locator('.prev table td').count() > 10);
    await win.keyboard.press('Escape');
    await win.evaluate(() => __kl.act.outputSettings()); await sleep(1300);
    await win.screenshot({ path: path.join(SHOTS, '8-output-control.png') });
    assert.match(await win.locator('#modal').textContent(), /CH1 FILL.*receivers?/);
    await win.keyboard.press('Escape');
  });
  await test('no renderer errors', () => assert.deepStrictEqual(errors, []));
  await win.evaluate(() => window.kl.ndiStop());
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
