/* External control: RossTalk over TCP (DashBoard, switchers, any RossTalk sender) and a small HTTP API. */
'use strict';
const net = require('net');
const http = require('http');
const { URL } = require('url');

function createControl({ onCommand, log }) {
  let tcp = null, web = null, cfg = { enabled: false };
  const status = { rosstalk: null, http: null, errors: [] };

  function closeAll() {
    return Promise.all([tcp, web].filter(Boolean).map(s => new Promise(r => s.close(() => r()))))
      .then(() => { tcp = web = null; status.rosstalk = status.http = null; });
  }

  const clean = a => String(a || '').replace(/^::ffff:/, '');
  function allowed(addr) {
    const a = clean(addr);
    if (cfg.bind === 'local') return a === '127.0.0.1' || a === '::1';
    if (!cfg.allow) return true;
    const list = String(cfg.allow).split(/[\s,]+/).filter(Boolean);
    return a === '127.0.0.1' || a === '::1' || list.some(x => x.endsWith('*') ? a.startsWith(x.slice(0, -1)) : a === x);
  }
  const host = () => cfg.bind === 'local' ? '127.0.0.1' : '0.0.0.0';
  function startTcp(port) {
    return new Promise(resolve => {
      const srv = net.createServer(sock => {
        if (!allowed(sock.remoteAddress)) { log && log(`RossTalk refused ${clean(sock.remoteAddress)} (not in the allowed list)`); sock.destroy(); return; }
        let buf = '';
        sock.setEncoding('utf8');
        sock.on('data', chunk => {
          buf += chunk;
          const parts = buf.split(/\r\n|\n|\r/);
          buf = parts.pop();
          for (const line of parts) {
            const cmd = line.trim();
            if (!cmd) continue;
            log && log(`RossTalk ${sock.remoteAddress}: ${cmd}`);
            Promise.resolve(onCommand(cmd)).then(res => { if (res && res.reply) sock.write(res.reply + '\r\n'); }).catch(() => {});
          }
        });
        // DashBoard's rosstalk.sendMessage often closes without a trailing newline
        sock.on('end', () => { const cmd = buf.trim(); buf = ''; if (cmd) { log && log(`RossTalk ${sock.remoteAddress}: ${cmd}`); onCommand(cmd); } });
        sock.on('error', () => {});
      });
      srv.on('error', e => { status.errors.push(`RossTalk port ${port}: ${e.message}`); resolve(null); });
      srv.listen(port, host(), () => { status.rosstalk = port; resolve(srv); });
    });
  }

  const ROUTES = [
    [/^\/api\/take\/(\d+)(?:\/(\d+))?$/, m => `SEQI ${m[1]}${m[2] ? ':' + m[2] : ''}`],
    [/^\/api\/takeout\/(\d+)$/, m => `SEQO ${m[1]}`],
    [/^\/api\/read\/(\d+)$/, m => `READ ${m[1]}`],
    [/^\/api\/clear\/(\d+)$/, m => `CLFB 1:${m[1]}`],
    [/^\/api\/resume\/(\d+)$/, m => `RESUME 1:${m[1]}`],
    [/^\/api\/clearall$/, () => 'CLRA'],
    [/^\/api\/next$/, () => 'NEXT'],
    [/^\/api\/up$/, () => 'UP'],
    [/^\/api\/down$/, () => 'DOWN'],
    [/^\/api\/takes$/, () => 'LIST'],
    [/^\/api\/timer\/([\w-]+)\/(start|stop|reset)$/i, m => `TIMER ${m[1]}:${m[2]}`],
    [/^\/api\/state$/, () => 'STATE']
  ];

  function startHttp(port) {
    return new Promise(resolve => {
      const srv = http.createServer(async (req, res) => {
        const send = (code, body, type) => {
          res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
          res.end(typeof body === 'string' ? body : JSON.stringify(body));
        };
        try {
          if (!allowed(req.socket.remoteAddress)) return send(403, { ok: false, error: 'This address is not allowed. Change Remote control access in Keyline.' });
          if (req.method === 'OPTIONS') return send(204, '');
          const u = new URL(req.url, 'http://localhost');
          if (u.pathname === '/' || u.pathname === '/remote') return send(200, REMOTE_HTML, 'text/html; charset=utf-8');
          if (u.pathname === '/api/rosstalk') {
            const cmd = u.searchParams.get('cmd');
            if (!cmd) return send(400, { ok: false, error: 'Add ?cmd=, for example ?cmd=SEQI%201001:20' });
            return send(200, await onCommand(cmd));
          }
          /* baseball scoring: /api/baseball/pitch?kind=ball, /api/baseball/result?kind=hr, /api/baseball/state */
          const bb = u.pathname.match(/^\/api\/baseball\/(\w+)$/);
          if (bb) {
            if (bb[1] === 'state') return send(200, await onCommand({ cmd: 'BASEBALLSTATE' }));
            const action = { type: bb[1] };
            for (const [k, v] of u.searchParams) action[k] = /^-?\d+$/.test(v) ? +v : v === 'true' ? true : v === 'false' ? false : v;
            if (req.method === 'POST') Object.assign(action, await readJson(req));
            return send(200, await onCommand({ cmd: 'BASEBALL', action }));
          }
          const tset = u.pathname.match(/^\/api\/timer\/([\w-]+)\/set$/i);
          if (tset) return send(200, await onCommand(`TIMER ${tset[1]}:SET:${u.searchParams.get('value') || '0:00'}`));
          const set = u.pathname.match(/^\/api\/set\/(\d+)$/);
          if (set) {
            const fields = {};
            for (const [k, v] of u.searchParams) fields[k] = v;
            if (req.method === 'POST') Object.assign(fields, await readJson(req));
            return send(200, await onCommand({ cmd: 'SETDATA', take: +set[1], fields }));
          }
          for (const [re, fn] of ROUTES) { const m = u.pathname.match(re); if (m) return send(200, await onCommand(fn(m))); }
          send(404, { ok: false, error: 'Unknown route. Open / for the list of endpoints.' });
        } catch (e) { send(500, { ok: false, error: e.message }); }
      });
      srv.on('error', e => { status.errors.push(`HTTP port ${port}: ${e.message}`); resolve(null); });
      srv.listen(port, host(), () => { status.http = port; resolve(srv); });
    });
  }

  async function configure(next) {
    cfg = Object.assign({ enabled: true, rosstalkPort: 7788, httpPort: 8088, bind: 'all', allow: '' }, next);
    await closeAll();
    status.errors = [];
    if (cfg.enabled) {
      tcp = await startTcp(cfg.rosstalkPort);
      if (cfg.httpPort) web = await startHttp(cfg.httpPort);
    }
    return getStatus();
  }
  const getStatus = () => ({ enabled: cfg.enabled, bind: cfg.bind, allow: cfg.allow, rosstalk: status.rosstalk, http: status.http, errors: status.errors.slice() });
  return { configure, status: getStatus, close: closeAll };
}

function readJson(req) {
  return new Promise(res => { let s = ''; req.on('data', c => { s += c; }); req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (e) { res({}); } }); });
}

const REMOTE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keyline Remote</title>
<style>body{margin:0;font:14px system-ui,sans-serif;background:#1c2028;color:#e8ebf0;padding:16px}h1{font-size:18px;margin:0 0 12px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}button{font:inherit;border:1px solid #4a5263;background:#2c323e;color:inherit;padding:10px 14px;border-radius:4px;cursor:pointer}
button.take{background:#b8191f;border-color:#e0464c;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.t{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}.t b{font-family:Consolas,monospace}.t.air{border-color:#ff5258;background:#4a1e22}
code{background:#2c323e;padding:1px 5px;border-radius:3px}</style>
<h1>Keyline CG Studio · Remote</h1><div class="bar"><button class="take" onclick="go('/api/next')">TAKE NEXT</button><button onclick="go('/api/clearall')">CLEAR ALL</button><button onclick="go('/api/up')">▲ Up</button><button onclick="go('/api/down')">▼ Down</button></div>
<div class="grid" id="g"></div>
<p style="color:#9aa3b2;margin-top:18px">RossTalk on TCP: <code>SEQI 1001:20</code> <code>SEQO 1001</code> <code>CLFB 1:20</code> <code>CLRA</code> <code>READ 1001</code> <code>NEXT</code> <code>RESUME 1:20</code> <code>SETDATA 1001:FIELD:value</code> <code>TIMER GAME:START</code> <code>BB pitch kind=ball</code> <code>BB result kind=hr</code></p><p style="color:#9aa3b2">Baseball over HTTP: <code>/api/baseball/pitch?kind=ball</code> <code>/api/baseball/result?kind=1b</code> <code>/api/baseball/runs?team=home&amp;delta=1</code> <code>/api/baseball/undo</code> <code>/api/baseball/state</code></p>
<script>function go(u){fetch(u).then(load)}
function load(){fetch('/api/takes').then(r=>r.json()).then(d=>{const g=document.getElementById('g');g.innerHTML='';(d.takes||[]).forEach(t=>{const b=document.createElement('button');b.className='t'+(t.onAir?' air':'');b.innerHTML='<b>'+String(t.id).padStart(4,'0')+'</b>'+t.name.replace(/</g,'&lt;')+'<small>Layer '+t.layer+(t.onAir?' · ON AIR':'')+'</small>';b.onclick=()=>go(t.onAir?'/api/takeout/'+t.id:'/api/take/'+t.id);g.appendChild(b)})})}
load();setInterval(load,2000)</script>`;

module.exports = { createControl };
