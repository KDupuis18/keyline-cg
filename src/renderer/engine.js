/* Keyline CG Studio — shared render engine (editor, preview, program, output windows).
   Scenes are 1920x1080. Every object has static base values and optional keyframe tracks. */
(function () {
  'use strict';
  const W = 1920, H = 1080;

  const svgURI = s => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
  const SIL = (bg = '#e6e6e6', fg = '#2b2b2b') => svgURI(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 360' preserveAspectRatio='xMidYMid slice'><rect width='300' height='360' fill='${bg}'/><circle cx='150' cy='132' r='66' fill='${fg}'/><path d='M14 360c4-94 64-138 136-138s132 44 136 138z' fill='${fg}'/></svg>`);
  const LOGO = svgURI(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><path d='M60 6 104 22v38c0 28-20 46-44 54C36 106 16 88 16 60V22z' fill='#111' stroke='#fff' stroke-width='5'/><path d='M32 40l22 10-22 10M88 40l-22 10 22 10M40 82l20-8 20 8' fill='none' stroke='#fb4f14' stroke-width='8' stroke-linecap='round' stroke-linejoin='round'/></svg>`);

  const SHADOW = { shadowOn: false, shadowColor: '#000000', shadowOpacity: 60, shadowBlur: 12, shadowDist: 6, shadowAngle: 45 };
  const TEXTP = { font: 'Barlow Condensed', size: 56, weight: 700, color: '#ffffff', align: 'left', upper: false, italic: false, tracking: 0, strokeColor: '#000000', strokeW: 0 };
  const DEF = {
    text: Object.assign({ text: 'New Text', squeeze: true }, TEXTP, SHADOW),
    rect: Object.assign({ fill: '#d4141c', fill2: '', angle: 180, radius: 0, skew: 0, stroke: '#ffffff', strokeW: 0, shape: 'rect' }, SHADOW),
    image: Object.assign({ src: '', fit: 'cover' }, SHADOW),
    clock: Object.assign({}, TEXTP, { format: 'HH:MM:SS', mode: 'time', timer: 'GAME', size: 44, align: 'center' }, SHADOW),
    ticker: Object.assign({}, TEXTP, { items: 'First headline\nSecond headline\nThird headline', mode: 'crawl', speed: 160, sep: '   •   ', size: 44, color: '#ffffff' }, SHADOW),
    video: Object.assign({ src: '', fit: 'cover', loop: true }, SHADOW),
    text3d: Object.assign({ text: '3D TEXT', font: 'Oswald', weight: 700, size: 160, color: '#f2c200', sideColor: '#8a5a00', depth: 30, bevel: 3, metal: 0.4, rough: 0.35, lightAngle: 35, align: 'center' }, SHADOW, { shadowOn: true, shadowBlur: 18, shadowDist: 10 })
  };
  const CONTENT_KEYS = ['text', 'src', 'items'];

  /* ---------- keyframes ---------- */
  const PROPS = ['x', 'y', 'w', 'h', 'alpha', 'scale', 'rotation', 'rotX', 'rotY', 'clipL', 'clipR'];
  const PROP_LABEL = { x: 'Position X', y: 'Position Y', w: 'Width', h: 'Height', alpha: 'Alpha', scale: 'Scale %', rotation: 'Rotation Z°', rotX: 'Rotation X° (3D)', rotY: 'Rotation Y° (3D)', clipL: 'Crop left %', clipR: 'Crop right %' };
  const PDEF = { alpha: 100, scale: 100, rotation: 0, rotX: 0, rotY: 0, clipL: 0, clipR: 0 };
  const EASES = [['linear', 'Linear'], ['inout', 'Ease in-out'], ['in', 'Ease in'], ['out', 'Ease out'], ['hold', 'Hold']];
  const EASE = {
    linear: t => t,
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3),
    inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    hold: () => 0
  };
  const base = (o, p) => { const v = o[p]; return v == null ? (PDEF[p] ?? 0) : v; };
  function valueAt(o, p, f) {
    const k = o.keys && o.keys[p];
    if (!k || !k.length) return base(o, p);
    if (f <= k[0].f) return k[0].v;
    const last = k[k.length - 1];
    if (f >= last.f) return last.v;
    let i = 0;
    while (i < k.length - 1 && k[i + 1].f <= f) i++;
    const a = k[i], b = k[i + 1];
    const t = (f - a.f) / (b.f - a.f);
    return a.v + (b.v - a.v) * (EASE[a.e] || EASE.linear)(t);
  }
  const isAnimated = (o, p) => !!(o.keys && o.keys[p] && o.keys[p].length);
  const keyAt = (o, p, f) => isAnimated(o, p) ? o.keys[p].find(k => k.f === Math.round(f)) : null;
  function setKey(o, p, f, v, e) {
    o.keys = o.keys || {};
    const k = o.keys[p] = o.keys[p] || [];
    f = Math.max(0, Math.round(f));
    const ex = k.find(x => x.f === f);
    if (ex) { ex.v = v; if (e) ex.e = e; }
    else { k.push({ f, v, e: e || 'inout' }); k.sort((a, b) => a.f - b.f); }
  }
  function delKey(o, p, f) {
    if (!isAnimated(o, p)) return;
    const k = o.keys[p];
    const i = k.findIndex(x => x.f === Math.round(f));
    if (i < 0) return;
    const v = k[i].v;
    k.splice(i, 1);
    if (!k.length) { delete o.keys[p]; o[p] = v; }
  }
  function allKeyFrames(o) {
    const s = new Set();
    if (o.keys) for (const p of Object.keys(o.keys)) for (const k of o.keys[p]) s.add(k.f);
    return [...s].sort((a, b) => a - b);
  }
  const tlOf = sc => sc.tl || (sc.tl = { fps: 30, pause: 30, end: 45 });

  /* Preset animations generate ordinary keyframes, so they can be edited frame by frame afterwards. */
  const PRESETS = [['none', 'None (cut)'], ['fade', 'Fade'], ['slide-l', 'Slide from left'], ['slide-r', 'Slide from right'], ['slide-u', 'Rise up'], ['slide-d', 'Drop down'], ['wipe', 'Wipe left→right'], ['scale', 'Scale up'], ['flip', 'Flip in (3D)'], ['spin', 'Spin in (3D)']];
  function applyPreset(o, fps, pause, maxDelay) {
    const a = o.anim || { in: 'fade', delay: 0, dur: 450 };
    for (const p of ['x', 'y', 'alpha', 'scale', 'clipR', 'rotX', 'rotY']) if (o.keys && o.keys[p]) { o[p] = valueAt(o, p, pause); delete o.keys[p]; }
    if (a.in === 'none') return;
    const fs = Math.round(a.delay / 1000 * fps);
    const fe = Math.max(fs + 1, Math.round((a.delay + a.dur) / 1000 * fps));
    const os = Math.max(fe, Math.round(pause + ((maxDelay - a.delay) * 0.3) / 1000 * fps));
    const oe = Math.max(os + 1, Math.round(os + a.dur * 0.6 / 1000 * fps));
    const A = base(o, 'alpha'), dx = Math.round(Math.min(o.w, 700) * .6), dy = Math.round(Math.min(o.h, 300) * .8);
    const seg = (p, from, to) => { setKey(o, p, fs, from, 'out'); setKey(o, p, fe, to, 'linear'); setKey(o, p, os, to, 'in'); setKey(o, p, oe, from, 'linear'); };
    switch (a.in) {
      case 'fade': seg('alpha', 0, A); break;
      case 'slide-l': seg('x', o.x - dx, o.x); seg('alpha', 0, A); break;
      case 'slide-r': seg('x', o.x + dx, o.x); seg('alpha', 0, A); break;
      case 'slide-u': seg('y', o.y + dy, o.y); seg('alpha', 0, A); break;
      case 'slide-d': seg('y', o.y - dy, o.y); seg('alpha', 0, A); break;
      case 'wipe': seg('clipR', 100, 0); break;
      case 'scale': seg('scale', 60, 100); seg('alpha', 0, A); break;
      case 'flip': seg('rotX', -90, 0); seg('alpha', 0, A); break;
      case 'spin': seg('rotY', -180, 0); seg('alpha', 0, A); break;
    }
    return oe;
  }
  function presetTimeline(sc) {
    const tl = tlOf(sc), fps = tl.fps;
    const anim = sc.objects.filter(o => o.anim && o.anim.in !== 'none');
    const maxD = Math.max(0, ...anim.map(o => o.anim.delay));
    let pause = 1;
    anim.forEach(o => { pause = Math.max(pause, Math.round((o.anim.delay + o.anim.dur) / 1000 * fps)); });
    let end = pause;
    sc.objects.forEach(o => { const e = applyPreset(o, fps, pause, maxD); if (e) end = Math.max(end, e); });
    tl.pause = pause; tl.end = end;
  }
  function presetObject(sc, o) {
    const tl = tlOf(sc);
    const maxD = Math.max(0, ...sc.objects.filter(x => x.anim && x.anim.in !== 'none').map(x => x.anim.delay));
    const fe = Math.round((o.anim.delay + o.anim.dur) / 1000 * tl.fps);
    if (fe > tl.pause) { tl.end += fe - tl.pause; tl.pause = fe; }
    const e = applyPreset(o, tl.fps, tl.pause, maxD);
    if (e && e > tl.end) tl.end = e;
  }

  /* ---------- clocks and timers ---------- */
  const timers = {}; // name -> { dir:'down'|'up', ms, running, startedAt (epoch ms) }
  function timerValue(name) {
    const t = timers[String(name || '').toUpperCase()];
    if (!t) return 0;
    let v = t.ms;
    if (t.running) v += (t.dir === 'down' ? -1 : 1) * (Date.now() - t.startedAt);
    return Math.max(0, v);
  }
  function fmtTimer(ms, f) {
    const tenths = Math.floor(ms / 100) % 10, s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    const p = n => String(n).padStart(2, '0');
    if (f === 'H:MM:SS') return `${h}:${p(m % 60)}:${p(s % 60)}`;
    if (f === 'SS.t') return `${s}.${tenths}`;
    if (f === 'M:SS.t') return s < 60 ? `${s % 60}.${tenths}` : `${m}:${p(s % 60)}`; // under a minute shows tenths, like a game clock
    return `${m}:${p(s % 60)}`;
  }
  function fmtClock(d, f) {
    const p = n => String(n).padStart(2, '0'), Hh = d.getHours(), M = d.getMinutes(), S = d.getSeconds();
    if (f === 'HH:MM') return p(Hh) + ':' + p(M);
    if (f === 'h:MM AM') return ((Hh % 12) || 12) + ':' + p(M) + ' ' + (Hh < 12 ? 'AM' : 'PM');
    return p(Hh) + ':' + p(M) + ':' + p(S);
  }
  function clockText(p) { return p.mode === 'timer' ? fmtTimer(timerValue(p.timer), p.format) : fmtClock(new Date(), p.format); }

  /* ---------- custom fonts ---------- */
  const loadedFonts = new Set();
  function registerFonts(list) {
    for (const f of list || []) {
      const key = f.family + '|' + f.url;
      if (loadedFonts.has(key)) continue;
      loadedFonts.add(key);
      try { const ff = new FontFace(f.family, `url("${f.url}")`); document.fonts.add(ff); ff.load().catch(() => {}); } catch (e) { /* bad font */ }
    }
  }
  let customFonts = [];
  const fontUrl = fam => (customFonts.find(f => f.family === fam) || {}).url;

  /* ---------- elements ---------- */
  const JUST = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const SHAPES = {
    rect: null, pill: null, ellipse: null,
    triangle: 'polygon(50% 0,100% 100%,0 100%)',
    diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
    chevron: 'polygon(0 0,82% 0,100% 50%,82% 100%,0 100%,18% 50%)',
    arrow: 'polygon(0 30%,70% 30%,70% 0,100% 50%,70% 100%,70% 70%,0 70%)',
    parallelogram: 'polygon(15% 0,100% 0,85% 100%,0 100%)',
    tab: 'polygon(0 0,100% 0,100% 100%,12% 100%,0 70%)'
  };
  function hexA(c, op) {
    const m = String(c).match(/^#([0-9a-f]{6})$/i);
    if (!m) return c;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(100, op)) / 100})`;
  }
  function shadowCss(p) {
    if (!p.shadowOn) return '';
    const a = (p.shadowAngle ?? 45) * Math.PI / 180, d = +p.shadowDist || 0;
    return `drop-shadow(${(Math.cos(a) * d).toFixed(1)}px ${(Math.sin(a) * d).toFixed(1)}px ${Math.max(0, +p.shadowBlur || 0)}px ${hexA(p.shadowColor || '#000000', p.shadowOpacity ?? 60)})`;
  }
  function textStyle(s, p) {
    s.fontFamily = `"${p.font}","Arial Narrow",Arial,sans-serif`; s.fontSize = p.size + 'px'; s.fontWeight = p.weight; s.color = p.color;
    s.letterSpacing = (p.tracking || 0) + 'px'; s.fontStyle = p.italic ? 'italic' : 'normal'; s.textTransform = p.upper ? 'uppercase' : 'none';
    if (+p.strokeW) { s.webkitTextStroke = `${p.strokeW * 2}px ${p.strokeColor}`; s.paintOrder = 'stroke fill'; }
  }
  const tickers = new Set();
  const threeEls = new Set();
  function makeEl(o, ov, opts) {
    const p = Object.assign({}, o.p, ov || {});
    if (p.shadow === true && p.shadowOn == null) p.shadowOn = true; // v2 projects
    const d = document.createElement('div');
    d.className = 'go go-' + ({ image: 'img', clock: 'text', video: 'img' }[o.type] || o.type);
    d.dataset.id = o.id;
    d._p = p;
    if (p.hide) d.style.visibility = 'hidden'; // a DataLinq "show when" link switched this object off
    const sh = shadowCss(p);
    if (sh) d.style.filter = sh;
    if (o.type === 'rect') {
      const f = document.createElement('div'); f.className = 'f';
      f.style.background = p.fill2 ? `linear-gradient(${p.angle}deg,${p.fill},${p.fill2})` : p.fill;
      f.style.borderRadius = p.shape === 'ellipse' ? '50%' : p.shape === 'pill' ? '9999px' : (p.radius || 0) + 'px';
      if (+p.strokeW) f.style.border = `${p.strokeW}px solid ${p.stroke}`;
      if (+p.skew) f.style.transform = `skewX(${p.skew}deg)`;
      if (SHAPES[p.shape]) f.style.clipPath = SHAPES[p.shape];
      d.append(f);
    } else if (o.type === 'text' || o.type === 'clock') {
      textStyle(d.style, p); d.style.justifyContent = JUST[p.align] || 'flex-start';
      const sp = document.createElement('span');
      sp.textContent = o.type === 'clock' ? clockText(p) : String(p.text ?? '');
      sp.style.transformOrigin = { left: '0 50%', center: '50% 50%', right: '100% 50%' }[p.align] || '0 50%';
      d.append(sp);
      if (o.type === 'clock') { d.dataset.clock = p.format; d._clock = p; }
      d._sq = o.type === 'text' && p.squeeze !== false;
    } else if (o.type === 'image') {
      const im = document.createElement('img'); im.alt = ''; im.draggable = false;
      im.src = p.src || SIL(); im.style.objectFit = p.fit || 'cover';
      d.append(im);
    } else if (o.type === 'video') {
      if (p.src) {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.loop = p.loop !== false; v.src = p.src; v.style.objectFit = p.fit || 'cover';
        if (opts && opts.thumb) v.preload = 'metadata'; else { v.autoplay = true; v.play().catch(() => {}); }
        d.append(v);
      } else { d.classList.add('go-empty'); d.textContent = 'Video: choose a file'; }
    } else if (o.type === 'ticker') {
      textStyle(d.style, p); d.classList.add('go-ticker', p.mode === 'roll' ? 'roll' : 'crawl');
      const items = String(p.items || '').split('\n').map(s => s.trim()).filter(Boolean);
      const track = document.createElement('div'); track.className = 'tk';
      const fill = () => {
        if (p.mode === 'roll') { for (const it of items) { const r = document.createElement('div'); r.textContent = it; track.append(r); } }
        else { const s = document.createElement('span'); s.textContent = items.join(p.sep ?? '   •   ') + (p.sep ?? '   •   '); track.append(s); }
      };
      fill(); fill(); // two copies make the loop seamless
      d.append(track);
      d._tk = { track, speed: +p.speed || 120, roll: p.mode === 'roll', t0: performance.now(), cycle: 0 };
      if (items.length) tickers.add(d);
    } else if (o.type === 'text3d') {
      const c = document.createElement('canvas'); c.className = 'c3d';
      d.append(c); d._3d = { canvas: c, key: '' };
      threeEls.add(d);
    }
    return d;
  }
  function applyFrame(el, o, f, scene) {
    const g = p => valueAt(o, p, f);
    const x = g('x'), y = g('y'), w = Math.max(0, g('w')), h = Math.max(0, g('h'));
    const a = Math.max(0, Math.min(100, g('alpha'))), sc = g('scale'), r = g('rotation'), rx = g('rotX'), ry = g('rotY');
    const cl = Math.max(0, Math.min(100, g('clipL'))), cr = Math.max(0, Math.min(100, g('clipR')));
    const s = el.style;
    s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px'; s.opacity = a / 100;
    const is3d = o.type === 'text3d';
    const t = [];
    if (!is3d && (rx || ry)) t.push(`perspective(1600px) rotateX(${rx}deg) rotateY(${ry}deg)`);
    if (!is3d && r) t.push(`rotate(${r}deg)`);
    if (sc !== 100) t.push(`scale(${sc / 100})`);
    s.transform = t.join(' ');
    // crop (percent of own width) intersected with an optional mask object's box
    let L = cl / 100 * w, R = cr / 100 * w, T = 0, B = 0, clip = cl > 0 || cr > 0;
    if (o.mask && scene) {
      const m = scene.objects.find(z => z.id === o.mask);
      if (m) {
        const mx = valueAt(m, 'x', f), my = valueAt(m, 'y', f), mw = valueAt(m, 'w', f), mh = valueAt(m, 'h', f);
        L = Math.max(L, mx - x); T = Math.max(T, my - y); R = Math.max(R, (x + w) - (mx + mw)); B = Math.max(B, (y + h) - (my + mh));
        clip = true;
      }
    }
    if (clip) {
      const pad = o.mask ? 0 : 10000; // crops leave room above/below for text descenders and shadows
      s.clipPath = `inset(${o.mask ? T + 'px' : -pad + 'px'} ${Math.max(0, R)}px ${o.mask ? B + 'px' : -pad + 'px'} ${Math.max(0, L)}px)`;
    } else s.clipPath = '';
    if (el._sq) {
      const sp = el.firstElementChild;
      if (!el._nat) { const n = sp.offsetWidth; if (n) el._nat = n; }
      if (el._nat) sp.style.transform = w < el._nat ? `scaleX(${(w / el._nat).toFixed(4)})` : '';
    }
    if (el._3d) { el._3d.o = o; el._3d.state = { w, h, rx, ry, r }; draw3d(el); }
  }
  function draw3d(el) {
    const st = el._3d.state; if (!st || !window.KL3D) return;
    const p = el._p;
    const key = [st.w | 0, st.h | 0, st.rx.toFixed(2), st.ry.toFixed(2), st.r.toFixed(2), p.text, p.font, p.weight, p.size, p.color, p.sideColor, p.depth, p.bevel, p.metal, p.rough, p.lightAngle, p.align, KL3D.version].join('|');
    if (key === el._3d.key) return;
    el._3d.key = key;
    KL3D.draw(el._3d.canvas, p, st, fontUrl(p.font));
  }
  function redraw3d() { for (const el of threeEls) { if (!el.isConnected) { threeEls.delete(el); continue; } el._3d.key = ''; draw3d(el); } }

  class Player {
    constructor(container, scene, data, opts) { this.c = container; this.scene = scene; this.data = data || {}; this.opts = opts || {}; this.f = 0; this.raf = 0; this.playing = false; this.onFrame = null; this.build(); }
    build() {
      this.c.replaceChildren(); this.pairs = [];
      for (const o of this.scene.objects) { if (!o.visible) continue; const el = makeEl(o, this.data[o.id], this.opts); this.c.append(el); this.pairs.push([el, o]); }
      this.seek(this.f);
    }
    seek(f) { this.f = f; for (const [el, o] of this.pairs) applyFrame(el, o, f, this.scene); if (this.onFrame) this.onFrame(f); }
    remeasure() { for (const [el] of this.pairs) { el._nat = 0; if (el._tk) el._tk.cycle = 0; } this.seek(this.f); }
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.playing = false; }
    play(from, to, done) {
      this.stop();
      const fps = tlOf(this.scene).fps;
      if (to <= from) { this.seek(to); if (done) done(); return; }
      this.playing = true; let t0 = null;
      const step = now => {
        if (t0 == null) t0 = now;
        const f = Math.min(to, from + (now - t0) * fps / 1000);
        this.seek(f);
        if (f < to) this.raf = requestAnimationFrame(step); else { this.playing = false; if (done) done(); }
      };
      this.raf = requestAnimationFrame(step);
    }
    playIn(done) { this.play(0, tlOf(this.scene).pause, done); }
    playOut(done) { const tl = tlOf(this.scene); this.play(Math.max(this.f, tl.pause), tl.end, done); }
    update(scene, data) { this.scene = scene; this.data = data || {}; this.build(); }
    destroy() { this.stop(); this.c.replaceChildren(); }
  }

  /* Program bus: layered takes for one channel. Messages: take | out | clearAll | update | sync | reset | timers | fonts */
  class Program {
    constructor(container) { this.c = container; this.layers = {}; this.onChange = null; }
    handle(m) {
      switch (m.type) {
        case 'timers': setTimers(m.timers); return;
        case 'fonts': setFonts(m.fonts); return;
        case 'take': {
          const L = m.layer, old = this.layers[L];
          if (old) { delete this.layers[L]; this._out(old); }
          const el = document.createElement('div'); el.className = 'layer'; el.style.zIndex = String(L + 1);
          this.c.append(el);
          const p = new Player(el, m.scene, m.data);
          this.layers[L] = { el, p, msg: m };
          const pause = tlOf(m.scene).pause;
          if (m.transition === 'cut') p.seek(pause);
          else if (m.transition === 'fade') { p.seek(pause); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'backwards' }); }
          else p.playIn();
          break;
        }
        case 'out': { const e = this.layers[m.layer]; if (e) { delete this.layers[m.layer]; this._out(e, m.transition); } break; }
        case 'clearAll': for (const L of Object.keys(this.layers)) this.handle({ type: 'out', layer: +L, transition: m.transition }); break;
        case 'update': { const e = this.layers[m.layer]; if (e) { e.msg = Object.assign({}, e.msg, { scene: m.scene, data: m.data }); e.p.update(m.scene, m.data); } break; }
        case 'reset': for (const L of Object.keys(this.layers)) { const e = this.layers[L]; e.p.destroy(); e.el.remove(); delete this.layers[L]; } break;
        case 'sync':
          if (m.timers) setTimers(m.timers);
          if (m.fonts) setFonts(m.fonts);
          this.handle({ type: 'reset' });
          for (const lm of (m.layers || [])) this.handle(Object.assign({}, lm, { type: 'take', transition: 'cut' }));
          break;
      }
      if (this.onChange) this.onChange();
    }
    _out(e, trans) {
      const t = trans || e.msg.transition;
      const kill = () => { e.p.destroy(); e.el.remove(); };
      if (t === 'cut') return kill();
      if (t === 'fade') { const a = e.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); a.onfinish = kill; return; }
      e.p.playOut(kill);
    }
    snapshot() { return Object.keys(this.layers).map(L => this.layers[L].msg); }
    remeasure() { for (const L of Object.keys(this.layers)) this.layers[L].p.remeasure(); }
  }
  function setTimers(t) { for (const k of Object.keys(timers)) delete timers[k]; Object.assign(timers, t || {}); tickClocks(); }
  function setFonts(list) { customFonts = list || []; registerFonts(customFonts); if (document.fonts) document.fonts.ready.then(redraw3d); redraw3d(); }

  /* live clocks / timers / tickers everywhere */
  function tickClocks() {
    const d = new Date();
    document.querySelectorAll('[data-clock]').forEach(el => { const s = el.firstElementChild; if (s && el._clock) s.textContent = el._clock.mode === 'timer' ? fmtTimer(timerValue(el._clock.timer), el._clock.format) : fmtClock(d, el._clock.format); });
  }
  setInterval(tickClocks, 100);
  (function tick(now) {
    for (const el of tickers) {
      if (!el.isConnected) { tickers.delete(el); continue; }
      const k = el._tk;
      if (!k.cycle) k.cycle = (k.roll ? k.track.scrollHeight : k.track.scrollWidth) / 2;
      if (!k.cycle) continue;
      const off = ((now - k.t0) / 1000 * k.speed) % k.cycle;
      k.track.style.transform = k.roll ? `translateY(${-off}px)` : `translateX(${-off}px)`;
    }
    requestAnimationFrame(tick);
  })(performance.now());

  function fitStage(wrap, stage) {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    const s = Math.min(r.width / W, r.height / H);
    stage.style.transform = `translate(${(r.width - W * s) / 2}px,${(r.height - H * s) / 2}px) scale(${s})`;
    stage.style.setProperty('--k', (1 / s).toFixed(3));
    return s;
  }

  window.KL = { W, H, SIL, LOGO, DEF, CONTENT_KEYS, SHAPES, PROPS, PROP_LABEL, PDEF, EASES, PRESETS, valueAt, isAnimated, keyAt, setKey, delKey, allKeyFrames, tlOf, applyPreset, presetTimeline, presetObject,
    fmtClock, fmtTimer, timerValue, timers, setTimers, setFonts, registerFonts, makeEl, applyFrame, Player, Program, fitStage, base, redraw3d, shadowCss };
})();
