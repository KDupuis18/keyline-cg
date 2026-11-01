/* Media store: images, video and fonts live as files (content-addressed) and are referenced
   from projects as kl-media://<sha1>.<ext>. Projects (.klcg) are zip packages: project.json + media/. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  webm: 'video/webm', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', ogv: 'video/ogg',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2'
};
const KINDS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],
  video: ['webm', 'mp4', 'm4v', 'mov', 'ogv'],
  font: ['ttf', 'otf', 'woff', 'woff2']
};
const URL_RE = /kl-media:\/\/([a-f0-9]{40}\.[a-z0-9]{2,5})/g;

function createMedia(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const fileFor = name => {
    const safe = path.basename(name);
    if (!/^[a-f0-9]{40}\.[a-z0-9]{2,5}$/.test(safe)) throw new Error('bad media name');
    return path.join(dir, safe);
  };
  function storeBuffer(buf, ext) {
    ext = String(ext || 'bin').toLowerCase().replace(/^\./, '');
    const name = crypto.createHash('sha1').update(buf).digest('hex') + '.' + ext;
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, buf);
    return 'kl-media://' + name;
  }
  function storeFile(file) {
    const ext = path.extname(file).slice(1).toLowerCase();
    // hash in chunks so multi-GB video doesn't need to fit in memory
    const h = crypto.createHash('sha1');
    const fd = fs.openSync(file, 'r'); const chunk = Buffer.alloc(1 << 20); let n;
    while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) h.update(chunk.subarray(0, n));
    fs.closeSync(fd);
    const name = h.digest('hex') + '.' + ext;
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) fs.copyFileSync(file, p);
    return 'kl-media://' + name;
  }
  function storeDataUri(uri) {
    const m = String(uri).match(/^data:([\w/+.-]+)(;base64)?,(.*)$/s);
    if (!m) throw new Error('not a data URI');
    const ext = Object.keys(MIME).find(k => MIME[k] === m[1]) || 'bin';
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    return storeBuffer(buf, ext);
  }

  /* protocol handler with HTTP range support (video seeking/looping) */
  async function handle(request) {
    try {
      const u = new URL(request.url);
      const file = fileFor(u.hostname + u.pathname.replace(/^\//, ''));
      if (!fs.existsSync(file)) return new Response('missing media', { status: 404 });
      const size = fs.statSync(file).size;
      const type = MIME[path.extname(file).slice(1)] || 'application/octet-stream';
      const range = request.headers.get('range');
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=31536000, immutable' };
      if (range) {
        const r = range.match(/bytes=(\d*)-(\d*)/);
        let start = r && r[1] ? +r[1] : 0, end = r && r[2] ? +r[2] : size - 1;
        if (r && !r[1] && r[2]) { start = size - +r[2]; end = size - 1; }
        end = Math.min(end, size - 1);
        if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
        return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }) });
      }
      return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: Object.assign(headers, { 'Content-Length': String(size) }) });
    } catch (e) {
      return new Response(String(e.message), { status: 400 });
    }
  }

  async function packProject(text) {
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file('project.json', text);
    const names = new Set([...text.matchAll(URL_RE)].map(m => m[1]));
    const missing = [];
    for (const n of names) {
      const p = path.join(dir, n);
      if (fs.existsSync(p)) zip.file('media/' + n, fs.readFileSync(p), { compression: /\.(png|jpe?g|gif|webp|webm|mp4|m4v|mov|woff2?)$/.test(n) ? 'STORE' : 'DEFLATE' });
      else missing.push(n);
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { buf, media: names.size, missing };
  }
  async function unpackProject(buf) {
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) return buf.toString('utf8'); // v2 plain-JSON project
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buf);
    const pj = zip.file('project.json');
    if (!pj) throw new Error('This .klcg package has no project.json');
    for (const [p, f] of Object.entries(zip.files)) {
      const m = p.match(/^media\/([a-f0-9]{40}\.[a-z0-9]{2,5})$/);
      if (!m || f.dir) continue;
      const out = path.join(dir, m[1]);
      if (!fs.existsSync(out)) fs.writeFileSync(out, await f.async('nodebuffer'));
    }
    return pj.async('string');
  }
  return { dir, storeBuffer, storeFile, storeDataUri, handle, packProject, unpackProject, fileFor };
}

module.exports = { createMedia, KINDS, MIME };
