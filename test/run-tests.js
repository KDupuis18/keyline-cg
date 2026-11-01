/* Node unit tests: DataLinq parsing/lookup, RossTalk + HTTP control server, NDI FFI binding (against a fake libndi). */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const net = require('net');
const http = require('http');

let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log('  ✔ ' + name); }
  catch (e) { fail++; console.log('  ✘ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n    ')); }
}

(async () => {
  console.log('DataLinq');
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/datalinq.js'), 'utf8'), ctx);
  const D = ctx.window.DataLinq;
  const csv = 'Jersey,First,Last,Ht,Hometown\n21,Marcus,Delacroix,"5\' 11""","Lakewood, Ohio"\r\n7,Kenji,Nakamura,"6\' 1""","Sacramento, CA"\n';
  const rows = D.parseCSV(csv);
  await test('parses quotes, escaped quotes, commas and CRLF', () => {
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[1][3], `5' 11"`);
    assert.strictEqual(rows[1][4], 'Lakewood, Ohio');
    assert.strictEqual(rows[2][1], 'Kenji');
  });
  await test('parses TSV and semicolon CSV', () => {
    assert.deepStrictEqual([...D.parseCSV('a\tb\n1\t2')[1]], ['1', '2']);
    assert.deepStrictEqual([...D.parseCSV('a;b;c\n1;2;3')[1]], ['1', '2', '3']);
  });
  const src = { header: true };
  await test('lookup by row number + header name', () => assert.strictEqual(D.lookup(src, rows, { row: '2', col: 'last' }).value, 'Nakamura'));
  await test('lookup by key match (Column=Value)', () => assert.strictEqual(D.lookup(src, rows, { row: 'Jersey=21', col: 'Hometown' }).value, 'Lakewood, Ohio'));
  await test('lookup by column letter and number', () => { assert.strictEqual(D.lookup(src, rows, { row: '1', col: 'B' }).value, 'Marcus'); assert.strictEqual(D.lookup(src, rows, { row: '1', col: '3' }).value, 'Delacroix'); });
  await test('lookup without header row', () => assert.strictEqual(D.lookup({ header: false }, rows, { row: '1', col: 'A' }).value, 'Jersey'));
  await test('lookup reports missing row / column clearly', () => {
    assert.match(D.lookup(src, rows, { row: '9', col: 'A' }).error, /Row 9 does not exist/);
    assert.match(D.lookup(src, rows, { row: 'Jersey=99', col: 'A' }).error, /No row where/);
    assert.match(D.lookup(src, rows, { row: '1', col: 'Nope' }).error, /No column/);
  });
  await test('Google Sheets links become CSV export URLs', () => {
    assert.strictEqual(D.sheetToCsvUrl('https://docs.google.com/spreadsheets/d/1AbC_d-9/edit#gid=123'), 'https://docs.google.com/spreadsheets/d/1AbC_d-9/export?format=csv&gid=123');
    assert.strictEqual(D.sheetToCsvUrl('https://docs.google.com/spreadsheets/d/1AbC/edit', 'Roster'), 'https://docs.google.com/spreadsheets/d/1AbC/gviz/tq?tqx=out:csv&sheet=Roster');
    assert.strictEqual(D.sheetToCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-1x/pubhtml?gid=5'), 'https://docs.google.com/spreadsheets/d/e/2PACX-1x/pub?output=csv&gid=5');
    assert.strictEqual(D.sheetToCsvUrl('https://example.com/a.csv'), 'https://example.com/a.csv');
  });
  await test('column letters', () => { assert.strictEqual(D.colLetter(0), 'A'); assert.strictEqual(D.colLetter(27), 'AB'); assert.strictEqual(D.colIndex('AB'), 27); });

  console.log('RossTalk + HTTP control');
  const { createControl } = require('../src/control');
  const got = [];
  const ctl = createControl({ onCommand: c => { got.push(c); return typeof c === 'string' && c === 'LIST' ? { ok: true, takes: [{ id: 1001, name: 'X', layer: 0, onAir: false }] } : { ok: true }; } });
  const st = await ctl.configure({ enabled: true, rosstalkPort: 17788, httpPort: 18088 });
  await test('servers start on the configured ports', () => { assert.strictEqual(st.rosstalk, 17788); assert.strictEqual(st.http, 18088); });
  const tcpSend = (txt, keepOpen) => new Promise(res => { const s = net.connect(17788, '127.0.0.1', () => { s.write(txt); if (!keepOpen) s.end(); setTimeout(() => { s.destroy(); res(); }, 150); }); });
  await test('RossTalk: newline-separated commands', async () => { got.length = 0; await tcpSend('SEQI 1001:20\r\nCLFB 1:20\n'); assert.deepStrictEqual(got, ['SEQI 1001:20', 'CLFB 1:20']); });
  await test('RossTalk: command without trailing newline (DashBoard style)', async () => { got.length = 0; await tcpSend('CLRA'); assert.deepStrictEqual(got, ['CLRA']); });
  const get = p => new Promise((res, rej) => http.get('http://127.0.0.1:18088' + p, r => { let b = ''; r.on('data', c => { b += c; }); r.on('end', () => res({ status: r.statusCode, body: b, cors: r.headers['access-control-allow-origin'] })); }).on('error', rej));
  await test('HTTP routes map to RossTalk', async () => {
    got.length = 0;
    for (const p of ['/api/take/1001', '/api/take/1001/30', '/api/takeout/1001', '/api/clear/20', '/api/clearall', '/api/next', '/api/read/1002', '/api/rosstalk?cmd=UP']) await get(p);
    assert.deepStrictEqual(got, ['SEQI 1001', 'SEQI 1001:30', 'SEQO 1001', 'CLFB 1:20', 'CLRA', 'NEXT', 'READ 1002', 'UP']);
  });
  await test('HTTP /api/set builds a SETDATA command', async () => { got.length = 0; await get('/api/set/1003?LINE%201=Hello%20world&FLAG=LIVE'); assert.deepStrictEqual(got[0], { cmd: 'SETDATA', take: 1003, fields: { 'LINE 1': 'Hello world', FLAG: 'LIVE' } }); });
  await test('HTTP returns JSON with CORS, remote page at /', async () => {
    const r = await get('/api/takes'); assert.strictEqual(r.cors, '*'); assert.strictEqual(JSON.parse(r.body).takes[0].id, 1001);
    const page = await get('/'); assert.match(page.body, /Keyline Remote/);
    assert.strictEqual((await get('/nope')).status, 404);
  });
  await test('port conflict is reported, not thrown', async () => {
    const blocker = net.createServer().listen(17790);
    const c2 = createControl({ onCommand: () => ({}) });
    const s2 = await c2.configure({ enabled: true, rosstalkPort: 17790, httpPort: 0 });
    assert.strictEqual(s2.rosstalk, null); assert.match(s2.errors[0], /17790/);
    blocker.close(); await c2.close();
  });
  await ctl.close();

  console.log('NDI binding (fake libndi with the SDK struct layout)');
  const fakeLib = path.join(__dirname, 'fake-ndi', 'libfakendi.so');
  if (!fs.existsSync(fakeLib)) {
    try { require('child_process').execFileSync('gcc', ['-shared', '-fPIC', '-O2', '-o', fakeLib, path.join(__dirname, 'fake-ndi', 'fakendi.c')]); }
    catch (e) { console.log('  – skipped: needs gcc on Linux to build the fake NDI library'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  }
  const { NdiSender, unpremultiply, FRAME_RATES } = require('../src/ndi');
  const out = path.join(__dirname, 'fake-ndi', 'out-unit.json');
  process.env.FAKE_NDI_OUT = out;
  await test('loads runtime, creates sender, sends a BGRA frame with correct fields', () => {
    const s = new NdiSender(path.join(__dirname, 'fake-ndi', 'libfakendi.so'));
    s.start('Unit Test');
    const w = 64, hh = 36, buf = Buffer.alloc(w * hh * 4);
    for (let i = 0; i < w * hh; i++) buf[i * 4 + 3] = i < 100 ? 255 : i < 150 ? 128 : 0;
    const [N, D2] = FRAME_RATES['59.94'];
    s.sendFrame(buf, w, hh, N, D2);
    const r = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(r.name, 'Unit Test'); assert.strictEqual(r.xres, 64); assert.strictEqual(r.yres, 36);
    assert.strictEqual(r.fourcc, 0x41524742); assert.strictEqual(r.N, 60000); assert.strictEqual(r.D, 1001);
    assert.strictEqual(r.stride, 256); assert.strictEqual(r.format, 1); assert.strictEqual(r.tc_synth, true);
    assert.strictEqual(r.opaque, 100); assert.strictEqual(r.partial, 50); assert.strictEqual(r.inst, true);
    assert.ok(Math.abs(r.aspect - 64 / 36) < 1e-3);
    assert.strictEqual(s.connections(), 2);
    s.stop();
  });
  await test('missing runtime gives an install hint', () => assert.throws(() => new NdiSender('/nonexistent/libndi.so'), /NDI runtime not found|Install NDI Tools/));
  await test('unpremultiply restores straight alpha', () => { const b = Buffer.from([64, 32, 0, 128, 10, 10, 10, 255, 0, 0, 0, 0]); unpremultiply(b); assert.deepStrictEqual([...b], [128, 64, 0, 128, 10, 10, 10, 255, 0, 0, 0, 0]); });

  await test('fitFrame downsamples 2x frames and pads/crops odd sizes', () => {
    const { fitFrame } = require('../src/ndi');
    const big = Buffer.alloc(4 * 2 * 4); big.fill(200); const d = fitFrame(big, 4, 2, 2, 1); assert.strictEqual(d.length, 8); assert.strictEqual(d[0], 200);
    const odd = Buffer.alloc(3 * 2 * 4, 9); const p = fitFrame(odd, 3, 2, 4, 2); assert.strictEqual(p.length, 32); assert.strictEqual(p[12], 0); assert.strictEqual(p[16], 9);
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
