#!/usr/bin/env node
/* Bullpen CG server: serves the operator console and output pages, holds the
   game state, and pushes every change to all connected pages over SSE. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const E = require('./lib/engine');

const PORT = Number(process.env.PORT) || 8180;
const HOST = process.env.HOST || '0.0.0.0';
const DATA = process.env.BULLPEN_DATA || path.join(__dirname, 'data');
const AUTOSAVE = path.join(DATA, 'autosave.json');
const PUB = path.join(__dirname, 'public');
const FONTS = path.join(path.dirname(require.resolve('@fontsource/barlow-condensed/package.json')), 'files');
const MAX_BODY = 8 * 1024 * 1024;
const UNDO_DEPTH = 100;

fs.mkdirSync(DATA, { recursive: true });

let state;
try { state = E.normalize(JSON.parse(fs.readFileSync(AUTOSAVE, 'utf8'))); console.log('Restored game from', AUTOSAVE); }
catch { state = E.newState(); }

const undo = [], redo = [];
const snap = () => JSON.stringify({ meta: state.meta, teams: state.teams, game: state.game, today: state.today, pit: state.pit });
const restore = s => Object.assign(state, JSON.parse(s));

/* ---------- broadcasting ---------- */
const clients = new Set();
let saveTimer = null;
function publish() {
  const payload = JSON.stringify(Object.assign({}, state, { canUndo: undo.length > 0, canRedo: redo.length > 0 }));
  for (const res of clients) res.write('data: ' + payload + '\n\n');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(AUTOSAVE + '.tmp', JSON.stringify(state), err => {
      if (!err) fs.rename(AUTOSAVE + '.tmp', AUTOSAVE, () => {});
    });
  }, 400);
  armTimers();
}

/* Graphics taken with `secs` clear themselves. */
const timers = { lower: null, full: null, flash: null };
function armTimers() {
  for (const slot of Object.keys(timers)) {
    const g = state.gfx[slot];
    const t = timers[slot];
    if (t && (!g || g.id !== t.id)) { clearTimeout(t.handle); timers[slot] = null; }
    if (g && Number(g.secs) > 0 && !timers[slot]) {
      timers[slot] = {
        id: g.id,
        handle: setTimeout(() => {
          timers[slot] = null;
          if (state.gfx[slot] && state.gfx[slot].id === g.id) { state.gfx[slot] = null; publish(); }
        }, Number(g.secs) * 1000)
      };
    }
  }
}

function dispatch(action) {
  if (!action || typeof action.type !== 'string') throw new Error('Action needs a "type"');
  if (action.type === 'undo' || action.type === 'redo') {
    const from = action.type === 'undo' ? undo : redo, to = action.type === 'undo' ? redo : undo;
    if (!from.length) throw new Error('Nothing to ' + action.type);
    to.push(snap()); restore(from.pop());
    publish(); return;
  }
  if (action.type === 'load') {
    undo.push(snap()); redo.length = 0;
    state = E.normalize(action.state);
    publish(); return;
  }
  const before = snap();
  const work = JSON.parse(JSON.stringify(state)); // validate on a copy so a bad action changes nothing
  const isGame = E.apply(work, action);
  state = work;
  if (isGame) {
    undo.push(before); if (undo.length > UNDO_DEPTH) undo.shift();
    redo.length = 0;
  }
  publish();
}

/* ---------- http ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.csv': 'text/csv' };
function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
/* Query-string values for the GET control API: numbers and booleans are converted. */
function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !Number.isNaN(Number(v)) && !/^0\d/.test(v)) return Number(v);
  return v;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }
    if (p === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1000\n');
      res.write('data: ' + JSON.stringify(Object.assign({}, state, { canUndo: undo.length > 0, canRedo: redo.length > 0 })) + '\n\n');
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (p === '/api/state') return json(res, 200, state);
    if (p === '/api/action' && req.method === 'POST') {
      const a = JSON.parse(await body(req) || '{}');
      dispatch(a);
      return json(res, 200, { ok: true });
    }
    /* GET control API for Stream Deck / Companion / automation:
       /api/do/pitch?kind=ball   /api/do/take?type=batter   /api/do/clear?slot=lower */
    if (p.startsWith('/api/do/')) {
      const type = p.slice(8);
      const a = { type };
      for (const [k, v] of url.searchParams) a[k] = coerce(v);
      if (type === 'take' || type === 'preview') {
        if (a.type !== type) a.type = type;
        if (url.searchParams.has('gfx')) a.gfx = { type: url.searchParams.get('gfx') };
        else if (url.searchParams.has('graphic')) a.gfx = { type: url.searchParams.get('graphic') };
        if (a.gfx) for (const [k, v] of url.searchParams) if (!['gfx', 'graphic'].includes(k)) a.gfx[k] = coerce(v);
      }
      dispatch(a);
      return json(res, 200, { ok: true });
    }
    if (p === '/api/export') {
      const name = (state.meta.title || 'game').replace(/[^\w\- ]+/g, '').trim() || 'game';
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${name}.bullpen.json"` });
      return res.end(JSON.stringify(state, null, 2));
    }
    if (p.startsWith('/fonts/')) {
      const f = path.join(FONTS, path.basename(p));
      return sendFile(res, f);
    }
    if (req.method !== 'GET') return json(res, 404, { error: 'Not found' });
    const route = { '/': 'operator.html', '/output': 'output.html' }[p] || p.slice(1);
    const file = path.normalize(path.join(PUB, route));
    if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
    return sendFile(res, file);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log(`\nBullpen CG is running.\n`);
    console.log(`  Operator console:  http://localhost:${PORT}/`);
    for (const ip of ips) console.log(`                     http://${ip}:${PORT}/`);
    console.log(`  Program (fill):    http://localhost:${PORT}/output`);
    console.log(`  Program (key):     http://localhost:${PORT}/output?key=1`);
    console.log(`  Green screen:      http://localhost:${PORT}/output?bg=00ff00\n`);
  });
}

module.exports = { server, dispatch, getState: () => state };
