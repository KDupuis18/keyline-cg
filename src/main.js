'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, screen, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const { FRAME_RATES } = require('./ndi');
const { createControl } = require('./control');
const { readTitlePackage } = require('./titlepkg');
const { createMedia, KINDS } = require('./media');

const RENDERER = path.join(__dirname, 'renderer');
const PRELOAD = path.join(__dirname, 'preload.js');
const isMac = process.platform === 'darwin';
// worker threads cannot load scripts from inside app.asar
const UNPACKED = __dirname.replace(/app\.asar(?=[\\/]|$)/, 'app.asar.unpacked');

protocol.registerSchemesAsPrivileged([{ scheme: 'kl-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: false } }]);

let mainWin = null, media = null;
const outputs = new Map();   // webContents.id -> { win, kind, ch }
const ndi = new Map();       // "ch:fill" | "ch:key" -> { worker, win, name, fps, frames, connections, lib }
const screens = new Map();   // ch:mode -> BrowserWindow

/* ---------- main window ---------- */
function createMain() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWin = new BrowserWindow({
    width: Math.min(1680, width), height: Math.min(1000, height), minWidth: 1100, minHeight: 700,
    backgroundColor: '#2c323d', title: 'Keyline CG Studio', autoHideMenuBar: !isMac,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  mainWin.loadFile(path.join(RENDERER, 'index.html'));
  mainWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Undo/redo keys are routed here (before the page or the menu sees them) so each press acts exactly once:
  // in a text field it undoes typing, anywhere else it undoes the project. Same on Windows and macOS.
  mainWin.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || input.alt) return;
    if (!(isMac ? input.meta : input.control)) return;
    const k = String(input.key).toLowerCase();
    if (k === 'z' && !input.shift) { e.preventDefault(); mainWin.webContents.send('menu', 'smartUndo'); }
    else if (k === 'y' || (k === 'z' && input.shift)) { e.preventDefault(); mainWin.webContents.send('menu', 'smartRedo'); }
  });
  let unresponsive = false;
  mainWin.on('unresponsive', () => { unresponsive = true; });
  mainWin.on('responsive', () => { unresponsive = false; });
  mainWin.on('close', e => {
    if (mainWin.__forceClose) return;
    e.preventDefault();
    // a frozen or crashed editor must never trap the operator: offer a forced quit
    const forceAsk = () => {
      if (!mainWin || mainWin.__forceClose) return;
      const r = dialog.showMessageBoxSync(mainWin, { type: 'warning', buttons: ['Quit without saving', 'Keep waiting'], defaultId: 1, cancelId: 1, message: 'Keyline CG Studio is not responding.', detail: 'Quit now? Changes since the last autosave may be lost.' });
      if (r === 0) { mainWin.__forceClose = true; mainWin.destroy(); }
    };
    if (unresponsive || mainWin.webContents.isCrashed()) return forceAsk();
    mainWin.__closeAck = false;
    mainWin.webContents.send('app:beforeClose');
    setTimeout(() => { if (mainWin && !mainWin.__closeAck) forceAsk(); }, 3000);
  });
  mainWin.on('closed', () => { mainWin = null; stopAllNdi(); for (const w of screens.values()) if (!w.isDestroyed()) w.destroy(); app.quit(); });
}
ipcMain.on('app:closeAck', () => { if (mainWin) mainWin.__closeAck = true; });
ipcMain.on('app:closeNow', () => { if (mainWin) { mainWin.__forceClose = true; mainWin.close(); } });
ipcMain.on('win:title', (e, t) => { if (mainWin) mainWin.setTitle(t); });

/* ---------- native menu: shortcuts are owned here so they work the same on Windows and macOS ---------- */
function buildMenu() {
  const send = action => () => mainWin && mainWin.webContents.send('menu', action);
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: send('newProject') },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: send('open') },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: send('saveAs') },
      { type: 'separator' },
      { label: 'Import vMix GT Title…', click: send('importGT') },
      { label: 'Export DashBoard Panel…', click: send('exportDashboard') },
      ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }])
    ] },
    { label: 'Edit', submenu: [
      // text fields get native undo; everywhere else undo/redo the project
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', registerAccelerator: false, click: send('smartUndo') },
      { label: 'Redo', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', registerAccelerator: false, click: send('smartRedo') },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- media store ---------- */
const FILTERS = { image: [{ name: 'Images', extensions: KINDS.image }], video: [{ name: 'Video (WebM with alpha, MP4, MOV)', extensions: KINDS.video }], font: [{ name: 'Fonts', extensions: KINDS.font }] };
ipcMain.handle('media:import', async (e, kind) => {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Choose ' + kind, filters: FILTERS[kind] || FILTERS.image, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0];
  return { url: media.storeFile(f), name: path.basename(f), base: path.basename(f).replace(/\.[^.]+$/, '') };
});
ipcMain.handle('media:storeData', (e, uri) => { try { return media.storeDataUri(uri); } catch (err) { return null; } });

/* ---------- project files (.klcg = zip of project.json + media/) ---------- */
const PROJECT_FILTERS = [{ name: 'Keyline Project', extensions: ['klcg'] }, { name: 'JSON', extensions: ['json'] }];
ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Open project', filters: PROJECT_FILTERS, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { path: r.filePaths[0], text: await media.unpackProject(fs.readFileSync(r.filePaths[0])) };
});
ipcMain.handle('file:save', async (e, { text, path: p, saveAs, name }) => {
  let target = p;
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog(mainWin, { title: 'Save project', defaultPath: (name || 'Untitled') + '.klcg', filters: PROJECT_FILTERS });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  if (/\.json$/i.test(target)) fs.writeFileSync(target, text, 'utf8');
  else {
    const { buf } = await media.packProject(text);
    const tmp = target + '.saving';
    fs.writeFileSync(tmp, buf); fs.renameSync(tmp, target); // never leave a half-written project
  }
  return target;
});
ipcMain.handle('file:saveText', async (e, { text, defaultName, filters }) => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: defaultName, filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return r.filePath;
});
ipcMain.handle('file:autosave', (e, text) => { try { const p = path.join(app.getPath('userData'), 'autosave.json'); fs.writeFileSync(p + '.tmp', text); fs.renameSync(p + '.tmp', p); return true; } catch (err) { return false; } });
ipcMain.handle('file:loadAutosave', () => { try { return fs.readFileSync(path.join(app.getPath('userData'), 'autosave.json'), 'utf8'); } catch (err) { return null; } });

/* ---------- vMix titles ---------- */
ipcMain.handle('gt:import', async () => {
  const r = await dialog.showOpenDialog(mainWin, { title: 'Import vMix title', properties: ['openFile', 'multiSelections'], filters: [{ name: 'vMix titles', extensions: ['gtzip', 'gtxml', 'xaml', 'zip', 'xml'] }] });
  if (r.canceled) return null;
  const out = [];
  for (const file of r.filePaths) {
    const pkg = await readTitlePackage(file);
    // move package images into the media store so projects stay small
    for (const en of pkg.entries) if (en.dataUri) { try { en.dataUri = media.storeDataUri(en.dataUri); } catch (err) { /* keep inline */ } }
    out.push(pkg);
  }
  return out;
});

/* ---------- DataLinq: fetch in the main process (no CORS limits) ---------- */
const isLocal = url => /^file:|^[a-zA-Z]:\\|^\//.test(url);
const localPath = url => url.startsWith('file:') ? decodeURIComponent(new URL(url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')) : url;
async function fetchRaw(url) {
  if (isLocal(url)) return { ok: true, buf: fs.readFileSync(localPath(url)) };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'KeylineCG/3 DataLinq' } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` + (res.status === 401 || res.status === 403 ? ' — the sheet or feed is private. Share it as "Anyone with the link can view", or publish it to the web.' : '') };
    return { ok: true, buf };
  } finally { clearTimeout(t); }
}
ipcMain.handle('dl:fetch', async (e, url) => {
  try {
    const r = await fetchRaw(url);
    if (!r.ok) return r;
    const text = r.buf.toString('utf8');
    if (/^\s*<!doctype html|^\s*<html/i.test(text)) return { ok: false, error: 'The link returned a web page, not data. For Google Sheets, share as "Anyone with the link" or publish to the web.' };
    return { ok: true, text };
  } catch (err) { return { ok: false, error: err.name === 'AbortError' ? 'Timed out after 15 s' : err.message }; }
});
ipcMain.handle('dl:fetchBinary', async (e, url) => {
  try { const r = await fetchRaw(url); return r.ok ? { ok: true, base64: r.buf.toString('base64') } : r; }
  catch (err) { return { ok: false, error: err.name === 'AbortError' ? 'Timed out after 15 s' : err.message }; }
});
ipcMain.handle('dl:pickFile', async (e, kind) => {
  const filters = kind === 'xlsx' ? [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }] : kind === 'json' ? [{ name: 'JSON', extensions: ['json'] }] : [{ name: 'CSV', extensions: ['csv', 'txt', 'tsv'] }];
  const r = await dialog.showOpenDialog(mainWin, { title: 'Choose a data file', filters, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});

/* ---------- outputs ---------- */
function broadcast(msg) { for (const { win, ch } of outputs.values()) if (!win.isDestroyed() && (msg.ch == null || +msg.ch === ch)) win.webContents.send('out:msg', msg); }
ipcMain.on('out:send', (e, msg) => broadcast(msg));
ipcMain.on('out:ready', (e, ch) => { if (mainWin) mainWin.webContents.send('out:hello', { id: e.sender.id, ch: +ch || 1 }); });
ipcMain.on('out:sendTo', (e, { id, msg }) => { const o = outputs.get(id); if (o && !o.win.isDestroyed()) o.win.webContents.send('out:msg', msg); });

function outputWindow(opts, kind, ch, query) {
  const webPreferences = Object.assign({ preload: PRELOAD, contextIsolation: true, sandbox: true, backgroundThrottling: false }, opts.webPreferences || {});
  const win = new BrowserWindow(Object.assign({ show: false, frame: false }, opts, { webPreferences }));
  const id = win.webContents.id;
  outputs.set(id, { win, kind, ch });
  win.on('closed', () => outputs.delete(id));
  win.loadFile(path.join(RENDERER, 'output.html'), { query: Object.assign({ ch: String(ch) }, query) });
  return win;
}

/* NDI: an offscreen window renders one channel; a worker thread owns the sender.
   'fill' carries fill + alpha; 'key' is the alpha as a white-on-black picture for SDI fill/key converters. */
async function startNdi(o) {
  const ch = +o.ch || 1, mode = o.mode === 'key' ? 'key' : 'fill', id = ch + ':' + mode;
  stopNdi(id);
  const [N, D] = FRAME_RATES[String(o.fps || '29.97')] || FRAME_RATES['29.97'];
  const width = o.width || 1920, height = o.height || 1080;
  const worker = new Worker(path.join(UNPACKED, 'ndi-worker.js'), { workerData: { libPath: o.libPath || process.env.KEYLINE_NDI_LIB || null, name: o.name, fpsN: N, fpsD: D, width, height, unpremul: mode === 'fill' && o.unpremultiply !== false } });
  const started = await new Promise(res => {
    worker.once('message', m => res(m));
    worker.once('error', err => res({ type: 'error', error: err.message }));
  });
  if (started.type !== 'started') { worker.terminate(); return { ok: false, error: started.error }; }
  const win = outputWindow({ width, height, useContentSize: true, enableLargerThanScreen: true, transparent: mode === 'fill', backgroundColor: mode === 'fill' ? '#00000000' : '#000000', webPreferences: { offscreen: true } }, 'ndi', ch, mode === 'key' ? { mode: 'key' } : { bg: 'transparent' });
  win.setContentSize(width, height);
  win.webContents.setFrameRate(Math.min(60, Math.ceil(N / D)));
  const entry = { worker, win, name: o.name, fps: o.fps, ch, mode, frames: 0, connections: 0, lib: started.lib, size: null };
  ndi.set(id, entry);
  win.webContents.on('paint', (ev, dirty, image) => {
    const sz = image.getSize();
    if (!sz.width || !sz.height) return;
    const buf = image.toBitmap();
    if (buf.length !== sz.width * sz.height * 4) return;
    entry.size = `${width}×${height}`;
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    worker.postMessage({ type: 'frame', buf: ab, w: sz.width, h: sz.height }, [ab]);
  });
  worker.on('message', m => { if (m.type === 'status') { entry.frames = m.frames; entry.connections = m.connections; } });
  worker.on('error', () => stopNdi(id));
  entry.poll = setInterval(() => { try { worker.postMessage({ type: 'status' }); } catch (err) { /* stopped */ } }, 1000);
  win.webContents.invalidate();
  return { ok: true, lib: started.lib, name: o.name, id };
}
function stopNdi(id) {
  const e = ndi.get(id);
  if (!e) return;
  ndi.delete(id);
  clearInterval(e.poll);
  try { e.worker.postMessage({ type: 'stop' }); } catch (err) { /* gone */ }
  setTimeout(() => e.worker.terminate(), 500);
  if (!e.win.isDestroyed()) e.win.destroy();
}
function stopAllNdi() { for (const id of [...ndi.keys()]) stopNdi(id); }
ipcMain.handle('ndi:start', (e, o) => startNdi(o));
ipcMain.handle('ndi:stop', (e, id) => { if (id) stopNdi(id); else stopAllNdi(); return { ok: true }; });
ipcMain.handle('ndi:status', () => [...ndi.entries()].map(([id, e]) => ({ id, ch: e.ch, mode: e.mode, name: e.name, fps: e.fps, frames: e.frames, connections: e.connections, size: e.size, lib: e.lib })));

/* Fullscreen output of a channel (fill or key) on any connected display. */
ipcMain.handle('screen:list', () => screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1}: ${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' (primary)' : ''}` })));
ipcMain.handle('screen:open', (e, { displayId, ch, mode }) => {
  ch = +ch || 1; mode = mode === 'key' ? 'key' : 'fill';
  const k = ch + ':' + mode;
  if (screens.get(k) && !screens.get(k).isDestroyed()) screens.get(k).destroy();
  const d = screen.getAllDisplays().find(x => x.id === displayId) || screen.getPrimaryDisplay();
  const win = outputWindow({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, backgroundColor: '#000000' }, 'screen', ch, { bg: 'black', mode, label: `Keyline channel ${ch} ${mode} · press Esc to close` });
  screens.set(k, win);
  win.once('ready-to-show', () => { win.setFullScreen(true); win.show(); });
  win.webContents.on('before-input-event', (ev, input) => { if (input.key === 'Escape') win.destroy(); });
  win.on('closed', () => { if (screens.get(k) === win) screens.delete(k); });
  return { ok: true };
});
ipcMain.handle('screen:close', () => { for (const w of screens.values()) if (!w.isDestroyed()) w.destroy(); screens.clear(); return { ok: true }; });

/* ---------- RossTalk + HTTP control: commands round-trip to the renderer, which owns the rundown ---------- */
let reqId = 0;
const pending = new Map();
const control = createControl({
  onCommand: cmd => new Promise(resolve => {
    if (!mainWin) return resolve({ ok: false, error: 'No main window' });
    const id = ++reqId;
    pending.set(id, resolve);
    mainWin.webContents.send('control:cmd', { id, cmd });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ ok: false, error: 'Timed out' }); } }, 3000);
  }),
  log: line => mainWin && mainWin.webContents.send('control:log', line)
});
ipcMain.on('control:reply', (e, { id, result }) => { const r = pending.get(id); if (r) { pending.delete(id); r(result); } });
ipcMain.handle('control:config', (e, cfg) => control.configure(cfg));

/* ---------- lifecycle ---------- */
app.whenReady().then(() => {
  media = createMedia(path.join(app.getPath('userData'), 'media'));
  protocol.handle('kl-media', req => media.handle(req));
  buildMenu();
  createMain();
  app.on('activate', () => { if (!mainWin) createMain(); });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopAllNdi(); control.close(); });
