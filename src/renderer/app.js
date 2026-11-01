/* Keyline CG Studio — editor application */
(() => {
'use strict';
const { W, H } = KL;
const api = window.kl || null;
const KEY = 'keyline-cg-studio-v2', SKEY = 'keyline-cg-settings-v1';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const pad4 = n => String(n).padStart(4, '0');
const isMac = api ? api.platform === 'darwin' : /Mac/.test(navigator.platform);
const MOD = isMac ? 'Cmd' : 'Ctrl';
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}

/* ======================= model ======================= */
const BUILTIN_FONTS = ['Barlow Condensed', 'Oswald', 'Anton', 'Teko', 'Roboto Condensed', 'Archivo Narrow', 'Bebas Neue'];
const fontList = () => [...BUILTIN_FONTS, ...(P.fonts || []).map(f => f.family)];
const MATERIALS = [['White', '#ffffff'], ['Silver', '#e9ecf1'], ['Steel', '#9aa3b0'], ['Graphite', '#3a3f47'], ['Ink', '#111111'], ['Black', '#000000'], ['News Red', '#d4141c'], ['Oxblood', '#8f0d12'], ['Team Orange', '#fb4f14'], ['Amber', '#ffa21a'], ['Gold', '#f2c200'], ['Pitch Green', '#2bb24c'], ['Navy', '#0d3b66'], ['Sky', '#1b6fa8'], ['Royal', '#2b6be0'], ['Violet', '#6b3fd1'], ['Magenta', '#c2187a'], ['Teal', '#00a6a6']];
const TYPE_LETTER = { text: 'T', rect: 'Q', image: 'I', clock: 'C', ticker: 'K', video: 'V', text3d: '3' };
const TYPE_NAME = { text: 'Text', rect: 'Quad', image: 'Image', clock: 'Clock', ticker: 'Ticker', video: 'Video', text3d: '3D Text' };
function O(type, name, x, y, w, hh, p = {}, extra = {}) {
  const a = Object.assign({ in: 'fade', delay: 0, dur: 450 }, extra.anim || {});
  return { id: uid(), name, type, x, y, w, h: hh, alpha: 100, visible: true, published: !!extra.published, anim: a,
    p: Object.assign({}, KL.DEF[type], type === 'image' ? { src: KL.SIL() } : {}, p) };
}
const ROSTER_CSV = `Jersey,First,Last,Pos,Ht,Wt,Hometown,DOB,Headshot
21,Marcus,Delacroix,CB,"5' 11""",188,"Lakewood, Ohio","Mar 9, 1998",
7,Kenji,Nakamura,WR,"6' 1""",195,"Sacramento, California","Nov 22, 1999",
88,Tomas,Okonkwo,TE,"6' 5""",252,"Raleigh, North Carolina","Jan 30, 1997",
12,Elijah,Brandt,QB,"6' 3""",221,"Boise, Idaho","Aug 4, 1996",`;

function sample() {
  const scenes = [], A = (i, d, dur) => ({ anim: { in: i, delay: d || 0, dur: dur || 450 } }), PA = (i, d, dur) => Object.assign({ published: true }, A(i, d, dur));
  { const o = [];
    o.push(O('rect', 'Background', 0, 0, 1920, 1080, { fill: '#5e0a0d', fill2: '#c3262c', angle: 120 }, A('fade', 0, 500)));
    o.push(O('rect', 'Slash Orange', -140, -60, 560, 1200, { fill: '#ffa21a', fill2: '#e85d00', skew: -18 }, A('slide-l', 80, 650)));
    o.push(O('rect', 'Slash Dark', -300, -60, 420, 1200, { fill: '#141414', fill2: '#2c2c2c', skew: -18 }, A('slide-l', 0, 650)));
    o.push(O('rect', 'Frame', 200, 150, 1520, 780, { fill: 'rgba(0,0,0,0.14)', stroke: 'rgba(255,255,255,0.45)', strokeW: 3 }, A('fade', 200, 500)));
    o.push(O('rect', 'Header Bar', 240, 190, 1440, 96, { fill: '#ffffff', fill2: '#c9c9c9' }, A('wipe', 250, 550)));
    o.push(O('text', 'HEADER', 270, 190, 560, 96, { text: 'MAIN HEADER DATA', font: 'Oswald', size: 60, weight: 600, color: '#1d1d1d', upper: true }, PA('fade', 550, 400)));
    o.push(O('rect', 'Divider', 850, 214, 4, 48, { fill: '#555555' }, A('fade', 600, 300)));
    o.push(O('text', 'SUBHEADER', 880, 190, 770, 96, { text: 'Extra info about it can go in here', font: 'Roboto Condensed', size: 40, weight: 400, color: '#2a2a2a' }, PA('fade', 650, 400)));
    ['Line One of Text', 'Line Two of Text', 'Line Three of Text', 'Line Four of Text', 'Line Five of Text'].forEach((t, i) => {
      o.push(O('rect', 'Bullet ' + (i + 1), 300, 386 + i * 92, 22, 26, { fill: '#ffa21a', skew: -20 }, A('scale', 700 + i * 90, 350)));
      o.push(O('text', 'LINE ' + (i + 1), 345, 360 + i * 92, 780, 76, { text: t, size: 50, weight: 600 }, PA('slide-r', 720 + i * 90, 450)));
    });
    o.push(O('rect', 'Photo Frame', 1210, 330, 430, 540, { fill: '#ffffff' }, A('scale', 500, 500)));
    o.push(O('image', 'PHOTO', 1225, 345, 400, 440, { src: KL.SIL() }, PA('fade', 700, 500)));
    o.push(O('rect', 'Name Bar', 1225, 785, 400, 70, { fill: '#1a1a1a', fill2: '#3a3a3a' }, A('wipe', 800, 400)));
    o.push(O('text', 'NAME', 1235, 785, 380, 70, { text: 'NAME LONGSURNAME', font: 'Oswald', size: 36, weight: 500, align: 'center', upper: true }, PA('fade', 950, 300)));
    scenes.push({ id: uid(), name: 'FS BULLETS', category: 'FS', layer: 0, objects: o }); }
  { const o = [];
    o.push(O('rect', 'Flag Box', 120, 780, 250, 78, { fill: '#e0161e', fill2: '#a30d12' }, A('wipe', 0, 400)));
    o.push(O('text', 'FLAG', 120, 780, 250, 78, { text: 'BREAKING', font: 'Oswald', size: 44, weight: 600, align: 'center', upper: true, shadowOn: true, shadowBlur: 4, shadowDist: 2, shadowOpacity: 50 }, PA('fade', 250, 300)));
    o.push(O('rect', 'Main Bar', 370, 780, 1170, 78, { fill: '#ffffff', fill2: '#e2e4e8', shadowOn: true, shadowBlur: 22, shadowDist: 8, shadowOpacity: 45 }, A('wipe', 150, 500)));
    o.push(O('text', 'LINE 1', 396, 780, 1120, 78, { text: 'City council approves new transit plan', size: 54, weight: 700, color: '#101317' }, PA('slide-u', 400, 400)));
    o.push(O('rect', 'Sub Bar', 370, 858, 1170, 52, { fill: '#141920', fill2: '#252d38' }, A('wipe', 300, 500)));
    o.push(O('text', 'LINE 2', 396, 858, 1120, 52, { text: 'Vote passes 7-2 after four hours of debate', size: 34, weight: 500, color: '#e8edf4' }, PA('slide-u', 550, 400)));
    o.push(O('rect', 'Clock Box', 120, 858, 250, 52, { fill: '#0b0e12' }, A('wipe', 200, 400)));
    o.push(O('clock', 'Clock', 120, 858, 250, 52, { format: 'h:MM AM', size: 34, weight: 600 }, A('fade', 500, 300)));
    scenes.push({ id: uid(), name: 'L3 TOPIC BAR', category: 'L3', layer: 20, objects: o }); }
  { const o = [], OR = '#fb4f14';
    o.push(O('rect', 'Background', 0, 0, 1920, 1080, { fill: '#0e0e0e', fill2: '#2a2a2a', angle: 90 }, A('fade', 0, 400)));
    o.push(O('rect', 'Stripe L', -160, -40, 520, 1160, { fill: OR, fill2: '#b83806', skew: -14 }, A('slide-l', 50, 600)));
    o.push(O('rect', 'Stripe L2', 150, -40, 70, 1160, { fill: '#0e0e0e', skew: -14 }, A('slide-l', 120, 600)));
    o.push(O('rect', 'Stripe R', 1560, -40, 520, 1160, { fill: OR, fill2: '#b83806', skew: -14 }, A('slide-r', 50, 600)));
    o.push(O('rect', 'Stripe R2', 1700, -40, 70, 1160, { fill: '#0e0e0e', skew: -14 }, A('slide-r', 120, 600)));
    o.push(O('rect', 'Card', 380, 180, 1160, 700, { fill: '#000000', stroke: '#ffffff', strokeW: 4 }, A('scale', 250, 500)));
    o.push(O('image', 'HEADSHOT', 384, 184, 470, 692, { src: KL.SIL('#f2a46e', '#3a1d0d') }, PA('fade', 550, 500)));
    o.push(O('rect', 'Logo Box', 854, 184, 150, 150, { fill: OR }, A('wipe', 500, 400)));
    o.push(O('image', 'LOGO', 864, 194, 130, 130, { src: KL.LOGO, fit: 'contain' }, PA('scale', 700, 400)));
    o.push(O('text', 'FIRST NAME', 1020, 192, 500, 60, { text: 'Marcus', size: 56, weight: 600, align: 'right' }, PA('slide-l', 650, 400)));
    o.push(O('text', 'LAST NAME', 1020, 244, 500, 88, { text: 'Delacroix', size: 92, weight: 800, align: 'right', upper: true }, PA('slide-l', 720, 400)));
    [['Num', 894, 140, 'NUM', '21'], ['Pos', 1034, 140, 'POS', 'CB'], ['Ht', 1184, 180, 'HT', `5' 11"`], ['Wt', 1374, 140, 'WT', '188']].forEach(([l, x, w, k, v], i) => {
      o.push(O('text', l + ' Label', x, 352, w, 52, { text: l, size: 44, weight: 700 }, A('fade', 800 + i * 60, 300)));
      o.push(O('text', k, x, 402, w, 66, { text: v, size: 62, weight: 800 }, PA('slide-u', 850 + i * 60, 350)));
    });
    o.push(O('rect', 'Rule', 884, 488, 620, 4, { fill: OR }, A('wipe', 800, 400)));
    o.push(O('text', 'Hometown Label', 894, 508, 600, 54, { text: 'Hometown', size: 44, weight: 700 }, A('fade', 950, 300)));
    o.push(O('text', 'HOMETOWN', 894, 560, 620, 70, { text: 'Lakewood, Ohio', size: 62, weight: 800 }, PA('slide-u', 1000, 350)));
    o.push(O('text', 'DOB Label', 894, 664, 600, 54, { text: 'Date of Birth', size: 44, weight: 700 }, A('fade', 1050, 300)));
    o.push(O('text', 'DOB', 894, 716, 620, 70, { text: 'Mar 9, 1998', size: 62, weight: 800 }, PA('slide-u', 1100, 350)));
    scenes.push({ id: uid(), name: 'FS PLAYER BIO', category: 'FS', layer: 0, objects: o }); }
  { const o = [], days = [['MON', '☀', '24°', '13°', 'Sunny'], ['TUE', '⛅', '21°', '12°', 'Partly cloudy'], ['WED', '☂', '17°', '9°', 'Showers'], ['THU', '☁', '15°', '6°', 'Overcast'], ['FRI', '☀', '19°', '8°', 'Clearing']];
    o.push(O('rect', 'Background', 0, 0, 1920, 1080, { fill: '#0b2f52', fill2: '#1d74b0', angle: 160 }, A('fade', 0, 500)));
    o.push(O('rect', 'Header Bar', 160, 110, 1600, 110, { fill: '#ffffff', fill2: '#dde7f2' }, A('wipe', 150, 500)));
    o.push(O('text', 'TITLE', 200, 110, 900, 110, { text: '5-Day Forecast', font: 'Oswald', size: 72, weight: 600, color: '#0b2f52', upper: true }, PA('fade', 450, 350)));
    o.push(O('text', 'CITY', 1100, 110, 620, 110, { text: 'Ottawa, ON', size: 56, weight: 600, color: '#2d4a66', align: 'right' }, PA('fade', 500, 350)));
    days.forEach(([d, ic, hi, lo, c], i) => { const x = 160 + i * 328, dl = 450 + i * 90;
      o.push(O('rect', 'Day Panel ' + (i + 1), x, 270, 300, 640, { fill: 'rgba(255,255,255,0.12)', stroke: 'rgba(255,255,255,0.35)', strokeW: 2 }, A('slide-u', dl, 450)));
      o.push(O('text', 'DAY ' + (i + 1), x, 290, 300, 80, { text: d, font: 'Oswald', size: 54, weight: 600, align: 'center' }, PA('fade', dl + 150, 300)));
      o.push(O('text', 'ICON ' + (i + 1), x, 380, 300, 150, { text: ic, font: 'Roboto Condensed', size: 120, weight: 400, align: 'center', color: '#ffd35a', squeeze: false }, PA('scale', dl + 200, 400)));
      o.push(O('text', 'HIGH ' + (i + 1), x, 550, 300, 120, { text: hi, size: 116, weight: 800, align: 'center' }, PA('fade', dl + 250, 300)));
      o.push(O('text', 'LOW ' + (i + 1), x, 680, 300, 80, { text: lo, size: 64, weight: 600, align: 'center', color: '#a9d2f5' }, PA('fade', dl + 300, 300)));
      o.push(O('text', 'COND ' + (i + 1), x, 790, 300, 70, { text: c, size: 42, weight: 500, align: 'center' }, PA('fade', dl + 350, 300))); });
    scenes.push({ id: uid(), name: 'FS WEATHER 5DAY', category: 'FS', layer: 0, objects: o }); }
  { const o = [];
    o.push(O('rect', 'Bug Base', 80, 60, 660, 66, { fill: '#0f1319', fill2: '#232a35', radius: 4 }, A('wipe', 0, 450)));
    o.push(O('rect', 'Team 1 Chip', 80, 60, 12, 66, { fill: '#fb4f14' }, A('fade', 200, 300)));
    o.push(O('text', 'TEAM 1', 104, 60, 110, 66, { text: 'RDG', size: 42, weight: 700 }, PA('fade', 300, 300)));
    o.push(O('text', 'SCORE 1', 214, 60, 80, 66, { text: '17', size: 50, weight: 800, align: 'center' }, PA('slide-d', 350, 300)));
    o.push(O('rect', 'Team 2 Chip', 310, 60, 12, 66, { fill: '#2b6be0' }, A('fade', 250, 300)));
    o.push(O('text', 'TEAM 2', 334, 60, 110, 66, { text: 'HBR', size: 42, weight: 700 }, PA('fade', 350, 300)));
    o.push(O('text', 'SCORE 2', 444, 60, 80, 66, { text: '14', size: 50, weight: 800, align: 'center' }, PA('slide-d', 400, 300)));
    o.push(O('rect', 'Period Box', 540, 60, 200, 66, { fill: '#e9ecf1', fill2: '#c9ced8' }, A('wipe', 300, 400)));
    o.push(O('text', 'PERIOD', 548, 60, 72, 66, { text: '3RD', size: 34, weight: 700, color: '#111111', align: 'center' }, PA('fade', 500, 300)));
    o.push(O('clock', 'GAME CLOCK', 620, 60, 112, 66, { mode: 'timer', timer: 'GAME', format: 'M:SS.t', size: 42, weight: 800, color: '#111111', align: 'center' }, A('fade', 550, 300)));
    scenes.push({ id: uid(), name: 'BUG SCORE', category: 'BUG', layer: 30, objects: o }); }
  { const o = [];
    o.push(O('rect', 'Live Box', 1490, 60, 140, 58, { fill: '#e0161e', fill2: '#a30d12' }, A('wipe', 0, 350)));
    o.push(O('text', 'LIVE', 1490, 60, 140, 58, { text: 'LIVE', font: 'Oswald', size: 40, weight: 600, align: 'center', tracking: 3 }, A('fade', 200, 300)));
    o.push(O('rect', 'Location Box', 1630, 60, 230, 58, { fill: 'rgba(10,12,16,0.82)' }, A('wipe', 150, 400)));
    o.push(O('text', 'LOCATION', 1646, 60, 200, 58, { text: 'DOWNTOWN', size: 36, weight: 700, align: 'center', upper: true }, PA('fade', 350, 300)));
    o.push(O('rect', 'Clock Strip', 1630, 118, 230, 40, { fill: 'rgba(10,12,16,0.6)' }, A('wipe', 250, 400)));
    o.push(O('clock', 'Clock', 1630, 118, 230, 40, { format: 'h:MM AM', size: 28, weight: 600, color: '#dfe6ef' }, A('fade', 450, 300)));
    scenes.push({ id: uid(), name: 'BUG LIVE', category: 'BUG', layer: 31, objects: o }); }
  { const o = [];
    o.push(O('rect', 'Glow', 360, 330, 1200, 420, { fill: 'rgba(242,194,0,0.18)', shape: 'ellipse', shadowOn: true, shadowColor: '#f2c200', shadowOpacity: 70, shadowBlur: 80, shadowDist: 0 }, A('fade', 0, 600)));
    o.push(O('text3d', 'TITLE 3D', 260, 330, 1400, 300, { text: 'GAME DAY', font: 'Anton', weight: 400, size: 220, color: '#f2c200', sideColor: '#7a4d00', depth: 40, bevel: 4, metal: 0.55, rough: 0.3, lightAngle: 35 }, PA('spin', 100, 900)));
    o.push(O('text', 'SUBTITLE', 260, 650, 1400, 90, { text: 'Ridgeline vs Harbor City · Kickoff 7:30 PM', size: 58, weight: 600, align: 'center', upper: true, tracking: 2, strokeColor: '#000000', strokeW: 1, shadowOn: true, shadowBlur: 14, shadowDist: 6, shadowOpacity: 70 }, PA('slide-u', 700, 450)));
    scenes.push({ id: uid(), name: 'FS 3D TITLE', category: 'FS', layer: 10, objects: o }); }
  { const o = [];
    o.push(O('rect', 'Ticker Bar', 0, 990, 1920, 64, { fill: '#0f1319', fill2: '#1d2430', shadowOn: true, shadowBlur: 18, shadowDist: 4, shadowAngle: 270, shadowOpacity: 60 }, A('slide-u', 0, 400)));
    o.push(O('rect', 'Ticker Label Box', 0, 990, 230, 64, { fill: '#e0161e', fill2: '#a30d12', shape: 'tab' }, A('wipe', 200, 350)));
    o.push(O('text', 'TICKER LABEL', 20, 990, 190, 64, { text: 'HEADLINES', font: 'Oswald', size: 34, weight: 600, align: 'center' }, PA('fade', 400, 300)));
    o.push(O('ticker', 'TICKER', 250, 990, 1670, 64, { items: 'Council approves transit plan 7-2\nFreezing rain warning in effect overnight\nRidgeline Tigers host Harbor City at 7:30 PM\nMarkets close higher for a third straight day', speed: 170, size: 36, weight: 600 }, PA('fade', 450, 400)));
    scenes.push({ id: uid(), name: 'L3 TICKER', category: 'L3', layer: 40, objects: o }); }
  scenes.forEach(sc => { sc.tl = { fps: 30, pause: 30, end: 45 }; KL.presetTimeline(sc); });

  const S = n => scenes.find(s => s.name === n);
  const oid = (sc, name) => sc.objects.find(x => x.name === name).id;
  const D = (sc, m) => { const d = {}; for (const [k, v] of Object.entries(m)) { const ob = sc.objects.find(x => x.name === k); if (ob) d[ob.id] = String(v).startsWith('data:') ? { src: v } : { text: v }; } return d; };
  let n = 1001;
  const T = (sc, name, m = {}) => ({ id: uid(), num: n++, sceneId: sc.id, name, layer: sc.layer, transition: 'auto', dur: 0, data: D(sc, m) });
  const roster = { id: uid(), name: 'Team roster (sample)', type: 'inline', text: ROSTER_CSV, header: true, interval: 0, enabled: true };
  const bio = S('FS PLAYER BIO');
  const takes = [
    T(S('BUG LIVE'), 'Open: LIVE BUG', { LOCATION: 'City Hall' }),
    T(S('FS BULLETS'), 'Story 1: FS BULLETS'),
    T(S('FS BULLETS'), 'Story 2: ELECTION RECAP', { HEADER: 'Election Night', SUBHEADER: 'Ward 4 results as of 10:45 PM', 'LINE 1': 'Turnout reached 58 percent', 'LINE 2': 'Okafor leads by 1,204 votes', 'LINE 3': 'Three polls still to report', 'LINE 4': 'Recount threshold is 0.5 percent', 'LINE 5': 'Final count expected Thursday', NAME: 'Jane Okafor', PHOTO: KL.SIL('#d6dde8', '#26324a') }),
    T(S('L3 TOPIC BAR'), 'Story 2: L3 DECISION', { FLAG: 'Decision', 'LINE 1': 'Okafor projected to win Ward 4 seat', 'LINE 2': 'Incumbent concedes in brief statement downtown' }),
    T(S('L3 TOPIC BAR'), 'Story 3: L3 WEATHER ALERT', { FLAG: 'Alert', 'LINE 1': 'Freezing rain warning in effect overnight', 'LINE 2': 'Up to 10 mm of ice expected before the morning commute' }),
    T(S('FS WEATHER 5DAY'), 'Story 3: FS FORECAST'),
    T(S('BUG SCORE'), 'Story 4: SCORE BUG'),
    T(bio, 'Story 4: BIO DELACROIX'),
    T(bio, 'Story 4: BIO NAKAMURA', { 'FIRST NAME': 'Kenji', 'LAST NAME': 'Nakamura', NUM: '7', POS: 'WR', HT: `6' 1"`, WT: '195', HOMETOWN: 'Sacramento, California', DOB: 'Nov 22, 1999', HEADSHOT: KL.SIL('#9fc3f0', '#0f2340') })
  ];
  const linked = T(bio, 'Story 4: BIO #88 (DataLinq)', { HEADSHOT: KL.SIL('#cfe3c4', '#1f3b18') });
  const L = (col) => ({ link: { src: roster.id, row: 'Jersey=88', col } });
  Object.assign(linked.data, { [oid(bio, 'FIRST NAME')]: L('First'), [oid(bio, 'LAST NAME')]: L('Last'), [oid(bio, 'NUM')]: L('Jersey'), [oid(bio, 'POS')]: L('Pos'), [oid(bio, 'HT')]: L('Ht'), [oid(bio, 'WT')]: L('Wt'), [oid(bio, 'HOMETOWN')]: L('Hometown'), [oid(bio, 'DOB')]: L('DOB') });
  takes.push(linked);
  takes.push(T(S('FS 3D TITLE'), 'Open: 3D TITLE'));
  takes.push(T(S('L3 TICKER'), 'Ticker: HEADLINES'));
  const ch2 = T(S('BUG LIVE'), 'Ch 2: LIVE BUG (second output)', { LOCATION: 'Studio B' }); ch2.channel = 2; takes.push(ch2);
  return { app: 'keyline-cg', version: 3, name: 'Sample Project', categories: ['FS', 'L3', 'BUG', 'GT'], scenes, takes, dataSources: [roster], timers: [{ name: 'GAME', dir: 'down', start: '12:00' }, { name: 'SHOT', dir: 'down', start: '0:24' }], fonts: [], styles: [], materials: [] };
}
function emptyProject() {
  const sc = { id: uid(), name: 'NEW SCENE 1', category: 'FS', layer: 0, objects: [], tl: { fps: 30, pause: 30, end: 45 } };
  return { app: 'keyline-cg', version: 3, name: 'Untitled', categories: ['FS', 'L3', 'BUG', 'GT'], scenes: [sc], takes: [], dataSources: [], timers: [{ name: 'GAME', dir: 'down', start: '12:00' }], fonts: [], styles: [], materials: [] };
}
function migrate(p) {
  p.categories = p.categories || ['FS', 'L3', 'BUG'];
  if (!p.categories.includes('GT')) p.categories.push('GT');
  p.dataSources = p.dataSources || [];
  p.takes = p.takes || [];
  p.name = p.name || 'Untitled';
  for (const sc of p.scenes || []) {
    if (!sc.tl) { sc.tl = { fps: 30, pause: 30, end: 45 }; if (!sc.objects.some(o => o.keys)) KL.presetTimeline(sc); }
    for (const o of sc.objects) {
      o.anim = o.anim || { in: 'fade', delay: 0, dur: 450 }; if (o.alpha == null) o.alpha = 100;
      o.p = Object.assign({}, KL.DEF[o.type], o.p);
      if (o.p.shadow === true) { o.p.shadowOn = true; o.p.shadowBlur = 10; o.p.shadowDist = 4; }
      delete o.p.shadow;
    }
  }
  for (const t of p.takes) { t.data = t.data || {}; t.transition = t.transition || 'auto'; t.channel = t.channel || 1; }
  p.timers = p.timers || [{ name: 'GAME', dir: 'down', start: '12:00' }];
  p.fonts = p.fonts || []; p.styles = p.styles || []; p.materials = p.materials || [];
  p.version = 3; p.app = 'keyline-cg';
  return p;
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
function loadLocal() { try { const s = lsGet(KEY); if (s) { const p = JSON.parse(s); if (p && p.scenes && p.takes) return migrate(p); } } catch (e) { /* corrupt */ } return null; }

let P = loadLocal() || sample();
const S = Object.assign({ ndiName: 'Keyline CG', ndiName2: 'Keyline CG 2', ndiFps: '29.97', ndiUnpremul: true, ndiLib: '', ndiAuto: false, ndiKey: false, ndiCh2: false, ctlEnabled: true, ctlBind: 'all', ctlAllow: '', rosstalkPort: 7788, httpPort: 8088, dashHost: '127.0.0.1' }, (() => { try { return JSON.parse(lsGet(SKEY) || '{}'); } catch (e) { return {}; } })());
const saveSettings = () => lsSet(SKEY, JSON.stringify(S));
const ui = { mode: 'layout', sceneId: P.scenes[0] && P.scenes[0].id, selObj: null, selTake: P.takes[0] && P.takes[0].id, inspTab: 'object', tiTab: 'data', safe: true, plate: true, cat: 'All',
  frame: 0, autoKey: false, ppf: 8, pgmCh: 1, timerState: {}, expanded: new Set(), selKeys: [], focusArea: 'vp', filePath: lsGet(KEY + '-path') || null, dirty: false, timers: {}, ctlLog: [], ndi: { running: false }, dlOpen: null };
let saveT = 0;
function save() {
  ui.dirty = true; updateTitle();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const txt = JSON.stringify(P);
    const ok = lsSet(KEY, txt);
    if (api) api.autosave(txt); else if (!ok) toast('Autosave is full. Use File › Save to keep your work.');
  }, 600);
}
let undoStack = [], redoStack = [];
function snapshot() { undoStack.push(JSON.stringify(P)); if (undoStack.length > 100) undoStack.shift(); redoStack = []; }
function undo() { if (!undoStack.length) return toast('Nothing to undo'); redoStack.push(JSON.stringify(P)); P = JSON.parse(undoStack.pop()); fixUi(); renderAll(); save(); toast('Undone'); }
function redo() { if (!redoStack.length) return toast('Nothing to redo'); undoStack.push(JSON.stringify(P)); P = JSON.parse(redoStack.pop()); fixUi(); renderAll(); save(); toast('Redone'); }
function fixUi() {
  if (!P.scenes.find(s => s.id === ui.sceneId)) ui.sceneId = P.scenes[0] && P.scenes[0].id;
  const sc = curScene();
  if (!sc || !sc.objects.find(o => o.id === ui.selObj)) ui.selObj = null;
  if (!P.takes.find(t => t.id === ui.selTake)) ui.selTake = P.takes[0] && P.takes[0].id;
  ui.selKeys = [];
}
const curScene = () => P.scenes.find(s => s.id === ui.sceneId);
const sceneById = id => P.scenes.find(s => s.id === id);
const selObj = () => { const s = curScene(); return s && s.objects.find(o => o.id === ui.selObj); };
const curTake = () => P.takes.find(t => t.id === ui.selTake);
function updateTitle() {
  const t = `${P.name}${ui.dirty ? ' •' : ''} — Keyline CG Studio`;
  document.title = t; $('#winTitle').textContent = `Keyline CG Studio — ${P.name}${ui.dirty ? ' (unsaved)' : ''}${ui.filePath ? '  ·  ' + ui.filePath : ''}`;
  if (api) api.setTitle(t);
}

/* ======================= DataLinq ======================= */
const DL = {};
const dlTimers = {};
function dlValue(link) {
  const src = P.dataSources.find(s => s.id === link.src);
  if (!src) return { ok: false, error: 'Source deleted' };
  const c = DL[src.id];
  if (!c || !c.rows) return { ok: false, error: c && c.error ? c.error : 'Waiting for data' };
  return DataLinq.lookup(src, c.rows, link);
}
function sourceUrl(s) { return s.type === 'gsheet' ? DataLinq.sheetToCsvUrl(s.url, s.sheet) : s.type === 'file' ? s.path : s.url; }
async function fetchSource(s) {
  const c = DL[s.id] = DL[s.id] || {};
  c.loading = true;
  let res;
  try {
    if (s.type === 'inline') res = { ok: true, text: s.text || '' };
    else {
      const url = sourceUrl(s);
      if (!url) throw new Error('No address set');
      if (s.type === 'xlsx') {
        const b = api ? await api.fetchBinary(url) : { ok: false, error: 'Excel needs the desktop app' };
        if (!b.ok) res = b;
        else { const bin = Uint8Array.from(atob(b.base64), ch => ch.charCodeAt(0)); res = { ok: true, text: b.base64.slice(0, 64) + b.base64.length + b.base64.slice(-64), rows: await DataLinq.parseXLSX(bin, s.sheet) }; }
      } else res = api ? await api.fetchText(url) : await fetch(url).then(async r => ({ ok: r.ok, text: await r.text(), error: 'HTTP ' + r.status }));
      if (res.ok && s.type === 'json') res.rows = DataLinq.parseJSON(res.text, s.path);
    }
  } catch (e) { res = { ok: false, error: e.message }; }
  c.loading = false;
  if (res.ok) {
    const sig = (res.text || '') + '|' + s.path + '|' + s.sheet;
    const changed = sig !== c.sig;
    c.sig = sig; c.rows = res.rows || DataLinq.parseCSV(res.text); c.error = null; c.at = new Date();
    if (changed) onDataChanged(s.id);
  } else { c.error = res.error || 'Failed'; c.at = new Date(); }
  renderDlStatus();
  if (ui.dlOpen) refreshDlModal();
}
function scheduleSources() {
  for (const id of Object.keys(dlTimers)) { clearInterval(dlTimers[id]); delete dlTimers[id]; }
  for (const s of P.dataSources) {
    if (s.enabled === false) continue;
    fetchSource(s);
    if (s.type !== 'inline' && +s.interval > 0) dlTimers[s.id] = setInterval(() => fetchSource(s), Math.max(1, +s.interval) * 1000);
  }
  renderDlStatus();
}
function takeUsesSource(t, srcId) { return Object.values(t.data || {}).some(v => v && v.link && v.link.src === srcId); }
function onDataChanged(srcId) {
  const affected = P.takes.filter(t => takeUsesSource(t, srcId));
  affected.forEach(liveUpdate);
  if (!affected.length) return;
  renderRundown();
  const t = curTake();
  if (t && affected.includes(t)) { renderPreview(); refreshDlValues(); }
}
function renderDlStatus() {
  const el = $('#stDl'), n = P.dataSources.length;
  if (!n) { el.textContent = ''; return; }
  const errs = P.dataSources.filter(s => DL[s.id] && DL[s.id].error).length;
  const last = Math.max(0, ...P.dataSources.map(s => DL[s.id] && DL[s.id].at ? DL[s.id].at.getTime() : 0));
  el.textContent = `DataLinq ${n} src${errs ? ` · ${errs} error${errs > 1 ? 's' : ''}` : ''}${last ? ' · ' + new Date(last).toLocaleTimeString() : ''}`;
  el.className = 'm ' + (errs ? 'bad' : 'ok');
}
/* the data a take sends to air: static template values merged with live DataLinq values */
function resolvedData(t) {
  const sc = sceneById(t.sceneId), out = {};
  if (!sc) return out;
  const field = { image: 'src', video: 'src', ticker: 'items' };
  for (const [id, v] of Object.entries(t.data || {})) {
    const o = sc.objects.find(x => x.id === id);
    if (!o || !v) continue;
    const r = {};
    for (const k of ['text', 'src', 'items']) if (v[k] != null && v[k] !== '') r[k] = v[k];
    if (v.link) {
      const res = dlValue(v.link);
      if (res.ok) {
        const val = DataLinq.format(res.value, v.link.fmt);
        const f = field[o.type] || 'text';
        if (f === 'src') { if (val) r.src = val; } else r[f] = val;
        const c = DataLinq.ruleColor(res.value, v.link.rule);
        if (c) r.color = c;
      } else if (v.link.fmt && v.link.fmt.fallback) r[field[o.type] || 'text'] = v.link.fmt.fallback;
    }
    if (Object.keys(r).length) out[id] = r;
  }
  return out;
}

/* ======================= program / outputs (two channels) ======================= */
const programs = { 1: new KL.Program($('#pgmLayers1')), 2: new KL.Program($('#pgmLayers2')) };
for (const p of Object.values(programs)) p.onChange = () => renderOnAir();
const program = programs[1];
const chOf = t => (t && +t.channel === 2 ? 2 : 1);
function sendProgram(m) {
  if (m.type === 'timers' || m.type === 'fonts') { programs[1].handle(m); if (api) api.output(m); return; }
  const ch = m.ch || 1;
  m.ch = ch;
  programs[ch].handle(m);
  if (api) api.output(m);
}
if (api) api.onOutputHello(({ id, ch }) => api.outputTo(id, { type: 'sync', ch, layers: programs[ch].snapshot(), timers: ui.timerState, fonts: P.fonts }));
function airOf(t) {
  for (const ch of [1, 2]) { const L = Object.keys(programs[ch].layers).find(L => programs[ch].layers[L].msg.takeId === t.id); if (L != null) return { ch, L: +L }; }
  return null;
}
const onAirLayerOf = t => { const a = airOf(t); return a ? a.L : null; };
const timerKey = (ch, L) => ch + ':' + L;
function takeMsg(t, layer) {
  const sc = sceneById(t.sceneId);
  return { type: 'take', ch: chOf(t), layer: layer ?? t.layer, scene: clone(sc), data: resolvedData(t), transition: t.transition, takeId: t.id, num: t.num, name: t.name };
}
function doTake(t, opts = {}) {
  if (!t) return toast('Select a take first.');
  const sc = sceneById(t.sceneId);
  if (!sc) return toast('That take\'s scene no longer exists.');
  const m = takeMsg(t, opts.layer);
  const L = m.layer, ch = m.ch, tk = timerKey(ch, L);
  clearTimeout(ui.timers[tk]);
  sendProgram(m);
  if (t.dur > 0) ui.timers[tk] = setTimeout(() => { const e = programs[ch].layers[L]; if (e && e.msg.takeId === t.id) outLayer(L, ch); }, t.dur * 1000);
  if (opts.advance !== false && t.id === ui.selTake) { const i = P.takes.indexOf(t); if (i > -1 && i < P.takes.length - 1) ui.selTake = P.takes[i + 1].id; }
  if (ch !== ui.pgmCh && opts.follow !== false) showPgmCh(ch);
  if (ui.mode === 'seq') { renderRundown(); renderTakeInsp(); renderPreview(); scrollToSel(); }
  toast(`Took ${pad4(t.num)} ${t.name} to channel ${ch}, layer ${L}`);
}
function outLayer(L, ch = 1) { if (!programs[ch].layers[L]) return; clearTimeout(ui.timers[timerKey(ch, L)]); sendProgram({ type: 'out', ch, layer: L }); renderRundown(); toast(`Cleared channel ${ch} layer ${L}`); }
function clearAll(ch) {
  const chs = ch ? [ch] : [1, 2];
  if (!chs.some(c => Object.keys(programs[c].layers).length)) return toast('Nothing on air');
  Object.values(ui.timers).forEach(clearTimeout);
  chs.forEach(c => sendProgram({ type: 'clearAll', ch: c }));
  renderRundown(); toast(ch ? `Cleared channel ${ch}` : 'Cleared all channels');
}
function liveUpdate(t) { const a = airOf(t); if (!a) return; const sc = sceneById(t.sceneId); if (!sc) return; sendProgram({ type: 'update', ch: a.ch, layer: a.L, scene: clone(sc), data: resolvedData(t) }); }
function liveUpdateScene(sceneId) { P.takes.filter(t => t.sceneId === sceneId).forEach(liveUpdate); }
function showPgmCh(ch) { ui.pgmCh = ch; $('#pgmLayers1').hidden = ch !== 1; $('#pgmLayers2').hidden = ch !== 2; renderOnAir(); }
$$('.chtabs [data-ch]').forEach(b => b.addEventListener('click', () => showPgmCh(+b.dataset.ch)));

/* ======================= clocks & timers ======================= */
function parseDur(v) {
  v = String(v ?? '').trim();
  if (!v) return 0;
  const parts = v.split(':').map(x => parseFloat(x) || 0);
  let s = 0; for (const p of parts) s = s * 60 + p;
  return Math.round(s * 1000);
}
function timerState(name) {
  name = String(name).toUpperCase();
  if (!ui.timerState[name]) { const def = P.timers.find(t => t.name.toUpperCase() === name) || { dir: 'down', start: '0:00' }; ui.timerState[name] = { dir: def.dir, ms: parseDur(def.start), running: false, startedAt: 0 }; }
  return ui.timerState[name];
}
function timerCmd(name, action, value) {
  name = String(name || '').toUpperCase();
  if (!name) return { ok: false, error: 'Timer name missing' };
  const st = timerState(name), now = Date.now();
  const cur = () => KL.timerValue(name);
  KL.setTimers(ui.timerState);
  switch (String(action).toUpperCase()) {
    case 'START': if (!st.running) { st.running = true; st.startedAt = now; } break;
    case 'STOP': case 'PAUSE': if (st.running) { st.ms = cur(); st.running = false; } break;
    case 'TOGGLE': return timerCmd(name, st.running ? 'STOP' : 'START');
    case 'RESET': { const def = P.timers.find(t => t.name.toUpperCase() === name); st.ms = parseDur(def ? def.start : '0:00'); st.running = false; break; }
    case 'SET': st.ms = parseDur(value); if (st.running) st.startedAt = now; break;
    case 'ADD': { const v = cur() + parseDur(value); st.ms = Math.max(0, v); if (st.running) st.startedAt = now; break; }
    case 'SUB': { const v = cur() - parseDur(value); st.ms = Math.max(0, v); if (st.running) st.startedAt = now; break; }
    case 'DIR': st.ms = cur(); if (st.running) st.startedAt = now; st.dir = /up/i.test(value) ? 'up' : 'down'; break;
    default: return { ok: false, error: `Unknown timer action ${action}. Use START, STOP, RESET, SET, ADD, SUB.` };
  }
  sendProgram({ type: 'timers', timers: ui.timerState });
  return { ok: true, timer: name, value: KL.fmtTimer(KL.timerValue(name), 'M:SS.t'), running: st.running };
}
function initTimers() { for (const t of P.timers) timerState(t.name); KL.setTimers(ui.timerState); }

/* ======================= monitors ======================= */
function fitMon(wrap) { const s = KL.fitStage(wrap, wrap.querySelector('.stage')); if (s) wrap._s = s; }
const ro = new ResizeObserver(es => { for (const e of es) fitMon(e.target); });
['#vpWrap', '#pvwWrap', '#pgmWrap'].forEach(s => ro.observe($(s)));

/* ======================= scene lists ======================= */
function thumbFor(sc) {
  const t = h('div', { class: 'thumb' }), st = h('div', { class: 'stage', style: 'transform:scale(.1)' });
  t.append(st);
  const p = new KL.Player(st, sc, {}, { thumb: true }); p.seek(KL.tlOf(sc).pause);
  requestAnimationFrame(() => { const w = t.clientWidth; if (w) st.style.transform = `scale(${w / W})`; p.remeasure(); });
  return t;
}
function renderCats() {
  for (const id of ['#catsL', '#catsS']) {
    $(id).replaceChildren(...['All', ...P.categories].map(c => h('div', { class: 'cat' + (ui.cat === c ? ' on' : ''), onclick: () => { ui.cat = c; renderCats(); renderSceneLists(); } },
      c === 'All' ? 'All scenes' : c, h('span', { class: 'n' }, c === 'All' ? P.scenes.length : P.scenes.filter(s => s.category === c).length))));
  }
}
function renderSceneLists() {
  const list = P.scenes.filter(s => ui.cat === 'All' || s.category === ui.cat);
  if (ui.mode === 'layout') {
    $('#scenesL').replaceChildren(...list.map(sc => h('div', { class: 'scn' + (sc.id === ui.sceneId ? ' on' : ''), onclick: () => { if (ui.sceneId !== sc.id) { stopTl(); ui.sceneId = sc.id; ui.selObj = null; ui.selKeys = []; ui.frame = KL.tlOf(sc).pause; renderSceneLists(); renderLayoutSide(); } } },
      thumbFor(sc), h('div', { class: 'meta' }, h('b', {}, sc.name), h('span', { class: 'c' }, sc.category + ' · L' + sc.layer)))));
    if (!list.length) $('#scenesL').append(h('div', { class: 'empty' }, 'No scenes in this category. Use + New scene to make one.'));
  } else {
    $('#scenesS').replaceChildren(...list.map(sc => h('div', { class: 'scn', title: 'Double-click to add a take', ondblclick: () => addTake(sc) }, thumbFor(sc),
      h('div', { class: 'meta' }, h('b', {}, sc.name), h('span', { class: 'c' }, 'L' + sc.layer), h('button', { class: 'mini', title: 'Add a take of this scene to the rundown', onclick: e => { e.stopPropagation(); addTake(sc); } }, '+')))));
  }
}
let thumbT = 0; function scheduleThumbs() { clearTimeout(thumbT); thumbT = setTimeout(renderSceneLists, 400); }

/* ======================= layout: viewport ======================= */
let vpPlayer = null;
function renderViewport() {
  const st = $('#vpStage'); st.replaceChildren();
  const sc = curScene();
  $('#vpTitle').textContent = 'Main Viewport · ' + (sc ? sc.name : 'no scene');
  st.append(h('div', { class: 'vpbg' }));
  if (!sc) { vpPlayer = null; return; }
  const layer = h('div', { class: 'layer' }); st.append(layer);
  if (vpPlayer) vpPlayer.stop();
  vpPlayer = new KL.Player(layer, sc, {}); vpPlayer.seek(ui.frame);
  if (ui.safe) st.append(h('div', { class: 'safe a' }), h('div', { class: 'safe t' }), h('div', { class: 'cross' }));
  if (ui.autoKey) st.append(h('div', { class: 'recframe' }));
  renderSel();
}
function renderSel() {
  const st = $('#vpStage');
  let b = $('#selbox', st);
  if (!b) b = h('div', { id: 'selbox' }, ...['nw', 'ne', 'sw', 'se'].map(d => h('div', { class: 'hdl', 'data-d': d })));
  st.append(b);
  const o = selObj();
  if (!o || !o.visible) { b.hidden = true; return; }
  b.hidden = false;
  const f = ui.frame, v = p => KL.valueAt(o, p, f);
  Object.assign(b.style, { left: v('x') + 'px', top: v('y') + 'px', width: v('w') + 'px', height: v('h') + 'px' });
  const tf = [];
  if (o.type !== 'text3d' && (v('rotX') || v('rotY'))) tf.push(`perspective(1600px) rotateX(${v('rotX')}deg) rotateY(${v('rotY')}deg)`);
  if (o.type !== 'text3d' && v('rotation')) tf.push(`rotate(${v('rotation')}deg)`);
  if (v('scale') !== 100) tf.push(`scale(${v('scale') / 100})`);
  b.style.transform = tf.join(' ');
  b.classList.toggle('keyed', ['x', 'y', 'w', 'h'].some(p => KL.isAnimated(o, p)));
}
/* write a property: keys it when the property is animated or Auto-key is on, else changes the static value */
function setProp(o, p, v) {
  if (ui.autoKey || KL.isAnimated(o, p)) KL.setKey(o, p, Math.round(ui.frame), v);
  else o[p] = v;
}
function sceneChanged(opts = {}) {
  if (vpPlayer) { const sc = curScene(); if (sc) vpPlayer.update(sc, {}); vpPlayer.seek(ui.frame); }
  renderSel();
  if (!opts.noTl) renderTimeline();
  scheduleThumbs();
  if (ui.sceneId) liveUpdateScene(ui.sceneId);
  save();
}

let drag = null;
$('#vpWrap').addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  ui.focusArea = 'vp'; stopTl();
  const wrap = $('#vpWrap'), s = wrap._s || 1, sc = curScene();
  if (!sc) return;
  const hd = e.target.closest('.hdl'), go = e.target.closest('.go');
  const pick = o => ({ x: KL.valueAt(o, 'x', ui.frame), y: KL.valueAt(o, 'y', ui.frame), w: KL.valueAt(o, 'w', ui.frame), h: KL.valueAt(o, 'h', ui.frame) });
  if (hd && selObj()) { const o = selObj(); drag = { mode: 'resize', dir: hd.dataset.d, sx: e.clientX, sy: e.clientY, o0: pick(o), s, o }; }
  else if (go) {
    const o = sc.objects.find(x => x.id === go.dataset.id);
    if (ui.selObj !== o.id) { ui.selObj = o.id; renderInspector(); renderTimeline(); }
    drag = { mode: 'move', sx: e.clientX, sy: e.clientY, o0: pick(o), s, o };
    renderSel();
  } else { ui.selObj = null; renderSel(); renderInspector(); renderTimeline(); return; }
  wrap.setPointerCapture(e.pointerId); e.preventDefault();
});
$('#vpWrap').addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = (e.clientX - drag.sx) / drag.s, dy = (e.clientY - drag.sy) / drag.s;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
  if (!drag.moved) snapshot();
  drag.moved = true;
  const o = drag.o, o0 = drag.o0, sn = v => e.shiftKey ? Math.round(v / 10) * 10 : Math.round(v);
  const nv = Object.assign({}, o0);
  if (drag.mode === 'move') { nv.x = sn(o0.x + dx); nv.y = sn(o0.y + dy); }
  else {
    const d = drag.dir;
    if (d.includes('w')) { const nx = sn(o0.x + dx); nv.w = Math.max(4, o0.w + (o0.x - nx)); nv.x = o0.x + o0.w - nv.w; }
    if (d.includes('e')) nv.w = Math.max(4, sn(o0.w + dx));
    if (d.includes('n')) { const ny = sn(o0.y + dy); nv.h = Math.max(4, o0.h + (o0.y - ny)); nv.y = o0.y + o0.h - nv.h; }
    if (d.includes('s')) nv.h = Math.max(4, sn(o0.h + dy));
  }
  for (const p of (drag.mode === 'move' ? ['x', 'y'] : ['x', 'y', 'w', 'h'])) if (nv[p] !== o0[p] || KL.isAnimated(o, p) || ui.autoKey) setProp(o, p, nv[p]);
  const el = $(`#vpStage .go[data-id="${o.id}"]`);
  if (el) KL.applyFrame(el, o, ui.frame);
  renderSel();
});
const endDrag = () => { if (!drag) return; const moved = drag.moved; drag = null; if (moved) { renderInspector(); sceneChanged(); } };
$('#vpWrap').addEventListener('pointerup', endDrag);
$('#vpWrap').addEventListener('pointercancel', endDrag);

/* ======================= layout: inspector ======================= */
function toHex(c) {
  c = String(c || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map(x => x + x).join('');
  const m = c.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('');
  return '#000000';
}
function bindEdit(e, apply, after) {
  const single = e.type === 'checkbox' || e.tagName === 'SELECT';
  e.addEventListener('input', () => { if (!e._snap) { snapshot(); e._snap = !single; } apply(); after(); });
  e.addEventListener('blur', () => { e._snap = false; });
}
function mk(after) {
  return {
    num: (v, set, a = {}) => { const e = h('input', Object.assign({ type: 'number', class: 'in', value: v }, a)); bindEdit(e, () => { if (e.value !== '' && !isNaN(+e.value)) set(+e.value); }, after); return e; },
    txt: (v, set, area) => { const e = h(area ? 'textarea' : 'input', { class: 'in', value: v }); bindEdit(e, () => set(e.value), after); return e; },
    chk: (label, v, set) => { const e = h('input', { type: 'checkbox', checked: v }); bindEdit(e, () => set(e.checked), after); return h('label', {}, e, label); },
    sel: (opts, v, set) => { const e = h('select', { class: 'in' }, opts.map(x => { const [val, l] = Array.isArray(x) ? x : [x, x]; return h('option', { value: val }, l); })); e.value = v; bindEdit(e, () => set(e.value), after); return e; },
    col: (v, set) => { const t = h('input', { class: 'in ct', value: v }), c = h('input', { type: 'color', class: 'cc', value: toHex(v) }); bindEdit(t, () => { set(t.value); c.value = toHex(t.value); }, after); bindEdit(c, () => { t.value = c.value; set(c.value); }, after); return h('span', { class: 'colf' }, c, t); }
  };
}
function keyToggle(o, p) {
  const has = KL.keyAt(o, p, ui.frame), anim = KL.isAnimated(o, p);
  return h('button', { class: 'kbtn' + (has ? ' on' : anim ? ' anim' : ''), title: has ? `Remove the ${KL.PROP_LABEL[p]} key at frame ${Math.round(ui.frame)}` : `Add a ${KL.PROP_LABEL[p]} key at frame ${Math.round(ui.frame)}`,
    onclick: () => { snapshot(); toggleKey(o, p); renderInspector(); sceneChanged(); } }, '◆');
}
function toggleKey(o, p) { const f = Math.round(ui.frame); if (KL.keyAt(o, p, f)) KL.delKey(o, p, f); else KL.setKey(o, p, f, KL.valueAt(o, p, f)); }
function shadowFields(g, F, C, p) {
  g.append(h('div', { class: 'sect' }, 'Shadow / glow'));
  F('Shadow', h('span', { class: 'chkrow' }, C.chk('On', !!p.shadowOn, v => { p.shadowOn = v; renderInspector(); })));
  if (!p.shadowOn) return;
  F('Color', C.col(p.shadowColor || '#000000', v => { p.shadowColor = v; }));
  F('Opacity %', C.num(p.shadowOpacity ?? 60, v => { p.shadowOpacity = Math.max(0, Math.min(100, v)); }, { min: 0, max: 100 }));
  F('Softness', C.num(p.shadowBlur ?? 12, v => { p.shadowBlur = Math.max(0, v); }, { min: 0 }));
  F('Distance', C.num(p.shadowDist ?? 6, v => { p.shadowDist = v; }));
  F('Angle °', C.num(p.shadowAngle ?? 45, v => { p.shadowAngle = v; }, { step: 5 }));
  g.append(h('p', { class: 'note' }, 'Distance 0 with a bright color makes a glow. Angle 45° falls down-right, 90° straight down, 270° straight up.'));
}
function textFields(g, F, C, p, o) {
  F('Font', C.sel(fontList().includes(p.font) ? fontList() : [p.font, ...fontList()], p.font, v => { p.font = v; }));
  F('Size', C.num(p.size, v => { p.size = Math.max(1, v); }, { min: 1 }));
  F('Weight', C.sel(['300', '400', '500', '600', '700', '800', '900'], String(p.weight), v => { p.weight = +v; }));
  F('Color', C.col(p.color, v => { p.color = v; }));
  F('Justify', C.sel([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], p.align, v => { p.align = v; }));
  if (o.type !== 'text3d') {
    F('Tracking', C.num(p.tracking || 0, v => { p.tracking = v; }));
    F('Style', h('span', { class: 'chkrow' }, C.chk('Upper', !!p.upper, v => { p.upper = v; }), C.chk('Italic', !!p.italic, v => { p.italic = v; }), o.type === 'text' ? C.chk('Squeeze', p.squeeze !== false, v => { p.squeeze = v; }) : null));
    F('Outline', C.col(p.strokeColor || '#000000', v => { p.strokeColor = v; }));
    F('Outline width', C.num(p.strokeW || 0, v => { p.strokeW = Math.max(0, v); }, { min: 0, step: 0.5 }));
  }
}
function renderInspector() {
  const box = $('#inspBody'); box.replaceChildren();
  const sc = curScene(), o = selObj();
  const styleTab = o ? { text: 'Text', rect: 'Fill', image: 'Image', clock: 'Clock', ticker: 'Ticker', video: 'Video', text3d: '3D Text' }[o.type] : null;
  const tabs = o ? [['object', 'Transform'], ['style', styleTab], ['anim', 'Animation']] : [['scene', 'Scene']];
  if (!tabs.some(t => t[0] === ui.inspTab)) ui.inspTab = tabs[0][0];
  $('#inspTabs').replaceChildren(...tabs.map(([k, l]) => h('button', { class: 'tab' + (ui.inspTab === k ? ' on' : ''), onclick: () => { ui.inspTab = k; renderInspector(); } }, l)));
  $('#inspTitle').textContent = 'Object Inspector · ' + (o ? o.name : sc ? sc.name : '');
  if (!sc) { box.append(h('p', { class: 'note' }, 'No scene selected. Make one with + New scene.')); return; }
  const g = h('div', { class: 'fgrid' }); box.append(g);
  const F = (l, c) => g.append(h('span', { class: 'fl' }, l), c);
  const C = mk(() => sceneChanged());
  if (!o) {
    const tl = KL.tlOf(sc);
    const C2 = mk(() => { sceneChanged(); renderCats(); });
    F('Scene name', C2.txt(sc.name, v => { sc.name = v; }));
    F('Category', C2.sel(P.categories, sc.category, v => { sc.category = v; }));
    F('Default layer', C2.num(sc.layer, v => { sc.layer = Math.max(0, Math.round(v)); }, { min: 0, max: 99 }));
    g.append(h('div', { class: 'sect' }, 'Timeline'));
    F('Frame rate', C2.sel([['24', '24 fps'], ['25', '25 fps'], ['30', '30 fps (29.97)'], ['50', '50 fps'], ['60', '60 fps (59.94)']], String(tl.fps), v => retime(sc, +v)));
    F('Pause point', C2.num(tl.pause, v => { tl.pause = Math.max(0, Math.round(v)); if (tl.end < tl.pause) tl.end = tl.pause; }, { min: 0 }));
    F('End frame', C2.num(tl.end, v => { tl.end = Math.max(tl.pause, Math.round(v)); }, { min: 0 }));
    g.append(h('p', { class: 'note' }, 'Taking a scene plays frame 0 to the pause point and holds. Taking it off continues from the pause point to the end frame.'));
    g.append(h('div', { class: 'btnrow' },
      h('button', { class: 'tbtn', onclick: () => { addTake(sc); setMode('seq'); } }, 'Add to Sequencer'),
      h('button', { class: 'tbtn', onclick: () => act.dupScene() }, 'Duplicate scene'),
      h('button', { class: 'tbtn', title: 'Replace every keyframe in this scene with keys generated from each object\'s preset', onclick: () => { snapshot(); KL.presetTimeline(sc); ui.frame = KL.tlOf(sc).pause; sceneChanged(); renderInspector(); toast('Rebuilt all keyframes from presets'); } }, 'Rebuild keys from presets')));
    g.append(h('p', { class: 'note' }, `${sc.objects.length} objects, ${sc.objects.filter(x => x.published).length} published.` + (sc.source ? ` Imported from ${sc.source.kind === 'vmix' ? 'vMix' : sc.source.kind} title (${sc.source.design}).` : '')));
    return;
  }
  const p = o.p;
  if (ui.inspTab === 'object') {
    F('Name', mk(() => { sceneChanged(); $('#inspTitle').textContent = 'Object Inspector · ' + o.name; }).txt(o.name, v => { o.name = v; }));
    F('Flags', h('span', { class: 'chkrow' }, C.chk('Visible', o.visible, v => { o.visible = v; }), C.chk('Published', o.published, v => { o.published = v; })));
    const masks = sc.objects.filter(x => x !== o);
    F('Mask', C.sel([['', 'None'], ...masks.map(x => [x.id, x.name + (x.visible ? '' : ' (hidden)')])], o.mask || '', v => { if (v) o.mask = v; else delete o.mask; }));
    g.append(h('div', { class: 'sect' }, `At frame ${Math.round(ui.frame)}` + (ui.autoKey ? ' · auto-key on' : '')));
    const lim = { alpha: [0, 100], scale: [1, 1000], clipL: [0, 100], clipR: [0, 100] };
    for (const pr of KL.PROPS) {
      const v = Math.round(KL.valueAt(o, pr, ui.frame) * 100) / 100;
      const e = C.num(v, nv => { const L = lim[pr]; if (L) nv = Math.min(L[1], Math.max(L[0], nv)); if ((pr === 'w' || pr === 'h') && nv < 1) nv = 1; setProp(o, pr, nv); }, { step: /rot/.test(pr) ? 0.5 : 1 });
      F(KL.PROP_LABEL[pr], h('span', { class: 'krow' }, e, keyToggle(o, pr)));
    }
    g.append(h('p', { class: 'note' }, 'Mask: this object only shows inside the chosen object\'s box. Animate the mask object for reveals; it can be hidden.'));
    g.append(h('div', { class: 'btnrow' },
      h('button', { class: 'tbtn', onclick: () => { snapshot(); setProp(o, 'x', Math.round((W - KL.valueAt(o, 'w', ui.frame)) / 2)); sceneChanged(); renderInspector(); } }, 'Center H'),
      h('button', { class: 'tbtn', onclick: () => { snapshot(); setProp(o, 'y', Math.round((H - KL.valueAt(o, 'h', ui.frame)) / 2)); sceneChanged(); renderInspector(); } }, 'Center V'),
      h('button', { class: 'tbtn', onclick: () => { snapshot(); ['x', 'y', 'w', 'h'].forEach((pr, i) => setProp(o, pr, [0, 0, W, H][i])); sceneChanged(); renderInspector(); } }, 'Fill frame')));
  } else if (ui.inspTab === 'style') {
    if (o.type === 'text') { F('Text', C.txt(p.text, v => { p.text = v; }, true)); textFields(g, F, C, p, o); }
    else if (o.type === 'clock') {
      F('Mode', C.sel([['time', 'Time of day'], ['timer', 'Countdown / game clock']], p.mode || 'time', v => { p.mode = v; p.format = v === 'timer' ? 'M:SS.t' : 'HH:MM:SS'; renderInspector(); }));
      if (p.mode === 'timer') {
        F('Timer', C.sel(P.timers.map(t => t.name), p.timer || (P.timers[0] || {}).name, v => { p.timer = v; }));
        F('Format', C.sel([['M:SS.t', 'M:SS, tenths under 1 min'], ['M:SS', 'M:SS'], ['SS.t', 'SS.t'], ['H:MM:SS', 'H:MM:SS']], p.format, v => { p.format = v; }));
        g.append(h('p', { class: 'note' }, 'Run timers from the Clocks button, RossTalk (TIMER GAME:START) or DashBoard.'));
      } else F('Format', C.sel([['HH:MM:SS', '24h with seconds'], ['HH:MM', '24h'], ['h:MM AM', '12h AM/PM']], p.format, v => { p.format = v; }));
      textFields(g, F, C, p, o);
    } else if (o.type === 'ticker') {
      F('Items', C.txt(p.items, v => { p.items = v; }, true));
      F('Mode', C.sel([['crawl', 'Crawl (right to left)'], ['roll', 'Roll (bottom to top)']], p.mode, v => { p.mode = v; }));
      F('Speed px/s', C.num(p.speed, v => { p.speed = Math.max(5, v); }, { min: 5, step: 10 }));
      if (p.mode !== 'roll') F('Separator', C.txt(p.sep ?? '   •   ', v => { p.sep = v; }));
      g.append(h('p', { class: 'note' }, 'One item per line. Publish it to edit items per take, or link it to a DataLinq column with Row = * to crawl every row.'));
      textFields(g, F, C, p, o);
    } else if (o.type === 'text3d') {
      F('Text', C.txt(p.text, v => { p.text = v; }));
      textFields(g, F, C, p, o);
      g.append(h('div', { class: 'sect' }, 'Extrusion & material'));
      F('Side color', C.col(p.sideColor, v => { p.sideColor = v; }));
      F('Depth', C.num(p.depth, v => { p.depth = Math.max(0, v); }, { min: 0 }));
      F('Bevel', C.num(p.bevel, v => { p.bevel = Math.max(0, v); }, { min: 0, step: 0.5 }));
      F('Metalness', C.num(p.metal, v => { p.metal = Math.max(0, Math.min(1, v)); }, { min: 0, max: 1, step: 0.05 }));
      F('Roughness', C.num(p.rough, v => { p.rough = Math.max(0, Math.min(1, v)); }, { min: 0, max: 1, step: 0.05 }));
      F('Light angle °', C.num(p.lightAngle, v => { p.lightAngle = v; }, { step: 5 }));
      g.append(h('p', { class: 'note' }, 'Rotate in true 3D with Rotation X / Y / Z on the Transform tab; all three can be keyframed.'));
    } else if (o.type === 'rect') {
      F('Shape', C.sel([['rect', 'Rectangle'], ['pill', 'Pill'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['diamond', 'Diamond'], ['chevron', 'Chevron'], ['arrow', 'Arrow'], ['parallelogram', 'Parallelogram'], ['tab', 'Tab']], p.shape || 'rect', v => { p.shape = v; }));
      F('Fill', C.col(p.fill, v => { p.fill = v; }));
      F('Gradient', h('span', { class: 'colf' }, C.chk('', !!p.fill2, v => { p.fill2 = v ? '#000000' : ''; renderInspector(); }), p.fill2 ? C.col(p.fill2, v => { p.fill2 = v; }) : h('span', { class: 'fl', style: 'text-align:left' }, 'solid fill')));
      if (p.fill2) F('Angle', C.num(p.angle, v => { p.angle = v; }));
      F('Corner radius', C.num(p.radius || 0, v => { p.radius = Math.max(0, v); }, { min: 0 }));
      F('Skew', C.num(p.skew || 0, v => { p.skew = v; }, { min: -60, max: 60 }));
      F('Border', C.col(p.stroke, v => { p.stroke = v; }));
      F('Border width', C.num(p.strokeW || 0, v => { p.strokeW = Math.max(0, v); }, { min: 0 }));
    } else if (o.type === 'image' || o.type === 'video') {
      const kind = o.type;
      const prev = kind === 'image' ? h('img', { src: p.src || KL.SIL(), alt: '', style: 'width:64px;height:64px;object-fit:cover;border:1px solid var(--line);background:#ddd' }) : h('span', { class: 'note' }, p.src ? 'Video file set' : 'No video yet');
      F(kind === 'image' ? 'Image' : 'Video', h('span', { class: 'imgf' }, prev, mediaBtn(kind, url => { snapshot(); p.src = url; if (kind === 'image') prev.src = url; sceneChanged(); renderInspector(); }),
        kind === 'image' ? h('button', { class: 'mini', onclick: () => { snapshot(); p.src = KL.SIL(); prev.src = p.src; sceneChanged(); } }, 'Placeholder') : null));
      F('Fit', C.sel([['cover', 'Fill (crop)'], ['contain', 'Fit inside'], ['fill', 'Stretch']], p.fit, v => { p.fit = v; }));
      if (kind === 'video') { F('Playback', h('span', { class: 'chkrow' }, C.chk('Loop', p.loop !== false, v => { p.loop = v; }))); g.append(h('p', { class: 'note' }, 'Video plays from the start each time the take goes to air, without audio. For transparency use WebM (VP8/VP9) with alpha; ProRes 4444 is not supported, so convert it to WebM first.')); }
    }
    shadowFields(g, F, C, p);
  } else {
    const a = o.anim;
    g.append(h('div', { class: 'sect' }, 'Preset'));
    F('Effect', C.sel(KL.PRESETS, a.in, v => { a.in = v; }));
    F('Delay (ms)', C.num(a.delay, v => { a.delay = Math.max(0, v); }, { min: 0, step: 10 }));
    F('Duration (ms)', C.num(a.dur, v => { a.dur = Math.max(10, v); }, { min: 10, step: 10 }));
    g.append(h('div', { class: 'btnrow' },
      h('button', { class: 'tbtn', onclick: () => { snapshot(); KL.presetObject(curScene(), o); ui.expanded.add(o.id); sceneChanged(); renderInspector(); toast(`Generated in/out keyframes for ${o.name}`); } }, 'Apply preset as keyframes'),
      h('button', { class: 'tbtn', onclick: () => { snapshot(); for (const pr of Object.keys(o.keys || {})) { o[pr] = KL.valueAt(o, pr, KL.tlOf(curScene()).pause); } o.keys = {}; sceneChanged(); renderInspector(); toast('Removed all keyframes from ' + o.name); } }, 'Clear keyframes')));
    g.append(h('p', { class: 'note' }, 'Presets write ordinary keyframes: in from frame 0 to the pause point, out after it. Adjust them frame by frame in the timeline below.'));
    g.append(h('div', { class: 'sect' }, 'Keyframes'));
    const props = Object.keys(o.keys || {});
    g.append(h('p', { class: 'note' }, props.length ? props.map(pr => `${KL.PROP_LABEL[pr]}: ${o.keys[pr].length}`).join(' · ') : 'No keyframes. Turn on Auto-key, move to a frame, and change a value.'));
  }
}
function retime(sc, fps) {
  const tl = KL.tlOf(sc), k = fps / tl.fps;
  if (k === 1) return;
  for (const o of sc.objects) for (const p of Object.keys(o.keys || {})) { o.keys[p].forEach(x => { x.f = Math.round(x.f * k); }); o.keys[p] = o.keys[p].filter((x, i, a) => i === 0 || x.f !== a[i - 1].f); }
  tl.pause = Math.round(tl.pause * k); tl.end = Math.round(tl.end * k); tl.fps = fps; ui.frame = Math.round(ui.frame * k);
}
function mediaBtn(kind, onUrl) {
  if (!api) return kind === 'image' ? fileBtn(onUrl) : h('span', { class: 'note' }, 'Video needs the desktop app');
  return h('button', { class: 'mini', onclick: async () => { const r = await api.importMedia(kind); if (r) onUrl(r.url, r); } }, kind === 'video' ? 'Choose video…' : 'Choose…');
}
function fileBtn(onUrl) {
  const f = h('input', { type: 'file', accept: 'image/*', hidden: true });
  f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; readImage(file).then(onUrl).catch(() => toast('That file could not be read as an image.')); f.value = ''; });
  return h('span', {}, f, h('button', { class: 'mini', onclick: () => f.click() }, 'Upload…'));
}
function readImage(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => {
      const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(/png|svg/.test(file.type) ? 'image/png' : 'image/jpeg', .9)); }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
function renderLayoutSide() { renderViewport(); renderInspector(); renderTimeline(); }

function addObject(type, grad) {
  const sc = curScene(); if (!sc) return toast('Select or create a scene first.');
  snapshot();
  const sz = { text: [800, 90], rect: [600, 120], image: [400, 400], clock: [300, 80], ticker: [1600, 64], video: [960, 540], text3d: [1200, 300] }[type];
  const names = TYPE_NAME;
  const n = sc.objects.filter(o => o.type === type).length + 1;
  const o = O(type, names[type] + ' ' + n, Math.round((W - sz[0]) / 2), Math.round((H - sz[1]) / 2), sz[0], sz[1], grad ? { fill: '#1b6fa8', fill2: '#0b2f52' } : {});
  sc.objects.push(o); ui.selObj = o.id; ui.inspTab = 'style';
  sceneChanged(); renderInspector(); toast(`Added ${o.name}`);
}
function applyMaterial(c, shift) {
  const o = selObj(); if (!o) return toast('Select an object, then click a material.');
  snapshot();
  if (o.type === 'rect') { if (shift) o.p.fill2 = c; else o.p.fill = c; }
  else if (o.type === 'text' || o.type === 'clock') o.p.color = c;
  else return toast('Materials apply to quads, text and clocks.');
  sceneChanged(); renderInspector();
}

/* ======================= layout: keyframe timeline ======================= */
const LABW = 250;
const fmtV = v => (Math.round(v * 10) / 10).toString();
const isSelKey = (o, p, f) => ui.selKeys.some(k => k.o === o && k.p === p && k.f === f);
function setFrame(f, opts = {}) {
  const sc = curScene(); if (!sc) return;
  ui.frame = Math.max(0, Math.round(f));
  if (vpPlayer) vpPlayer.seek(ui.frame);
  renderSel(); updatePlayhead();
  if (!opts.light) { renderInspector(); renderTimeline(); }
}
function updatePlayhead() {
  const ph = $('#phead'); if (ph) ph.style.left = (LABW + ui.frame * ui.ppf) + 'px';
  const fi = $('#tlFrame'); if (document.activeElement !== fi) fi.value = Math.round(ui.frame);
  const sc = curScene(); const fps = sc ? KL.tlOf(sc).fps : 30;
  const fr = Math.round(ui.frame), secs = Math.floor(fr / fps);
  $('#tlTc').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}:${String(fr % fps).padStart(2, '0')}`;
}
function renderTimeline() {
  const body = $('#tlBody');
  const sl = body.scrollLeft, st = body.scrollTop;
  body.replaceChildren();
  $('#tlAuto').classList.toggle('on', ui.autoKey);
  const sc = curScene();
  if (!sc) { body.append(h('p', { class: 'empty' }, 'No scene.')); return; }
  const tl = KL.tlOf(sc), ppf = ui.ppf;
  const frames = Math.max(tl.end + tl.fps * 2, Math.ceil((body.clientWidth - LABW) / ppf) + 5, 60);
  const TW = frames * ppf;
  const grid = h('div', { class: 'tlgrid', style: `width:${LABW + TW}px` });
  const ruler = h('div', { class: 'tltrack ruler', style: `width:${TW}px` });
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(s => s * ppf >= 46) || 600;
  for (let f = 0; f <= frames; f += step) ruler.append(h('span', { class: 'tick', style: `left:${f * ppf}px` }, String(f)));
  const minor = ppf >= 5 ? ppf : ppf * 5;
  ruler.style.backgroundImage = `repeating-linear-gradient(90deg,var(--tick) 0 1px,transparent 1px ${minor}px)`;
  ruler.style.backgroundSize = '100% 5px'; ruler.style.backgroundPosition = '0 100%';
  ruler.append(h('div', { class: 'mk pause', 'data-mk': 'pause', style: `left:${tl.pause * ppf}px`, title: `Pause point · frame ${tl.pause}. Drag to move.` }, 'P'),
    h('div', { class: 'mk end', 'data-mk': 'end', style: `left:${tl.end * ppf}px`, title: `End · frame ${tl.end}. Drag to move.` }, 'E'));
  grid.append(h('div', { class: 'tlrow tlhead' }, h('div', { class: 'tllab' }, `${sc.name} · ${tl.fps} fps · in 0–${tl.pause} · out ${tl.pause}–${tl.end}`), ruler));
  grid.append(h('div', { class: 'zone zin', style: `left:${LABW}px;width:${tl.pause * ppf}px` }), h('div', { class: 'zone zout', style: `left:${LABW + tl.pause * ppf}px;width:${(tl.end - tl.pause) * ppf}px` }));
  for (const o of [...sc.objects].reverse()) {
    const exp = ui.expanded.has(o.id), sel = o.id === ui.selObj;
    const lab = h('div', { class: 'tllab' + (sel ? ' sel' : ''), 'data-obj': o.id },
      h('button', { class: 'exp', 'data-x': 'exp', title: exp ? 'Collapse properties' : 'Show animatable properties' }, exp ? '▾' : '▸'),
      h('span', { class: 'eye' + (o.visible ? '' : ' off'), 'data-x': 'eye', title: o.visible ? 'Hide' : 'Show' }),
      h('span', { class: 'pill ' + (o.published ? 'pub' : 'nopub'), 'data-x': 'pub', title: 'Published objects become editable fields in the Sequencer' }, 'P'),
      h('span', { class: 'ty ' + o.type }, TYPE_LETTER[o.type]), h('span', { class: 'nm' }, o.name));
    const tr = h('div', { class: 'tltrack', 'data-obj': o.id, 'data-prop': '*', style: `width:${TW}px` });
    for (const f of KL.allKeyFrames(o)) tr.append(h('i', { class: 'kf sum' + (isSelKey(o.id, '*', f) ? ' sel' : ''), style: `left:${f * ppf}px`, 'data-obj': o.id, 'data-prop': '*', 'data-f': f, title: `Frame ${f} · all properties` }));
    grid.append(h('div', { class: 'tlrow' + (sel ? ' sel' : '') }, lab, tr));
    if (!exp) continue;
    for (const p of KL.PROPS) {
      const has = KL.keyAt(o, p, ui.frame), anim = KL.isAnimated(o, p);
      const plab = h('div', { class: 'tllab sub', 'data-obj': o.id },
        h('button', { class: 'kbtn' + (has ? ' on' : anim ? ' anim' : ''), 'data-x': 'key', 'data-prop': p, title: has ? 'Remove key at the current frame' : 'Add key at the current frame' }, '◆'),
        h('span', { class: 'pn' }, KL.PROP_LABEL[p]), h('span', { class: 'pv' }, fmtV(KL.valueAt(o, p, ui.frame))));
      const ptr = h('div', { class: 'tltrack sub', 'data-obj': o.id, 'data-prop': p, style: `width:${TW}px`, title: 'Double-click to add a key' });
      if (anim) {
        const ks = o.keys[p];
        for (let i = 0; i < ks.length - 1; i++) if (ks[i].v !== ks[i + 1].v || ks[i].e === 'hold') ptr.append(h('b', { class: 'seg' + (ks[i].e === 'hold' ? ' hold' : ''), style: `left:${ks[i].f * ppf}px;width:${(ks[i + 1].f - ks[i].f) * ppf}px` }));
        ks.forEach(k => ptr.append(h('i', { class: `kf e-${k.e}` + (isSelKey(o.id, p, k.f) ? ' sel' : ''), style: `left:${k.f * ppf}px`, 'data-obj': o.id, 'data-prop': p, 'data-f': k.f, title: `Frame ${k.f}: ${fmtV(k.v)} · ${(KL.EASES.find(e => e[0] === k.e) || ['', 'Linear'])[1]}` })));
      }
      grid.append(h('div', { class: 'tlrow sub' }, plab, ptr));
    }
  }
  if (!sc.objects.length) grid.append(h('div', { class: 'empty', style: 'padding:8px' }, 'This scene is empty. Add a Text, Quad, Image or Clock from the Object Library.'));
  grid.append(h('div', { class: 'mline pause', style: `left:${LABW + tl.pause * ppf}px` }), h('div', { class: 'mline end', style: `left:${LABW + tl.end * ppf}px` }), h('div', { class: 'phead', id: 'phead' }));
  body.append(grid);
  body.scrollLeft = sl; body.scrollTop = st;
  updatePlayhead();
  const ease = $('#tlEase'), keys = selectedKeyObjects();
  ease.disabled = !keys.length;
  ease.value = keys.length ? keys[0].k.e : '';
}
function selectedKeyObjects() {
  const sc = curScene(), out = [];
  if (!sc) return out;
  for (const s of ui.selKeys) {
    const o = sc.objects.find(x => x.id === s.o); if (!o || !o.keys) continue;
    const props = s.p === '*' ? Object.keys(o.keys) : [s.p];
    for (const p of props) { const k = (o.keys[p] || []).find(x => x.f === s.f); if (k) out.push({ o, p, k }); }
  }
  return out;
}
function deleteSelectedKeys() {
  const ks = selectedKeyObjects(); if (!ks.length) return toast('Select keyframes in the timeline first.');
  snapshot();
  for (const { o, p, k } of ks) KL.delKey(o, p, k.f);
  ui.selKeys = []; sceneChanged(); renderInspector(); toast(`Deleted ${ks.length} keyframe${ks.length > 1 ? 's' : ''}`);
}
function keySelected() {
  const o = selObj(); if (!o) return toast('Select an object to key.');
  snapshot();
  for (const p of ['x', 'y', 'w', 'h', 'alpha', 'scale', 'rotation']) KL.setKey(o, p, Math.round(ui.frame), KL.valueAt(o, p, ui.frame));
  ui.expanded.add(o.id); sceneChanged(); renderInspector(); toast(`Keyed ${o.name} at frame ${Math.round(ui.frame)}`);
}
const tlFrameAt = (e, el) => (e.clientX - el.getBoundingClientRect().left) / ui.ppf;
let tdrag = null;
$('#tlBody').addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  ui.focusArea = 'tl';
  const sc = curScene(); if (!sc) return;
  const t = e.target, objOf = el => sc.objects.find(o => o.id === el.closest('[data-obj]').dataset.obj);
  const x = t.closest('[data-x]');
  if (x) {
    const o = objOf(x);
    if (x.dataset.x === 'exp') { ui.expanded.has(o.id) ? ui.expanded.delete(o.id) : ui.expanded.add(o.id); renderTimeline(); }
    else if (x.dataset.x === 'eye') { snapshot(); o.visible = !o.visible; sceneChanged(); }
    else if (x.dataset.x === 'pub') { snapshot(); o.published = !o.published; sceneChanged(); renderInspector(); }
    else if (x.dataset.x === 'key') { snapshot(); toggleKey(o, x.dataset.prop); sceneChanged(); renderInspector(); }
    return;
  }
  stopTl();
  const mkEl = t.closest('.mk');
  if (mkEl) { tdrag = { mode: 'marker', which: mkEl.dataset.mk, ruler: mkEl.parentNode, snap: false }; $('#tlBody').setPointerCapture(e.pointerId); return; }
  const kf = t.closest('.kf');
  if (kf) {
    const ref = { o: kf.dataset.obj, p: kf.dataset.prop, f: +kf.dataset.f };
    if (ui.selObj !== ref.o) { ui.selObj = ref.o; renderSel(); renderInspector(); }
    const already = isSelKey(ref.o, ref.p, ref.f);
    if (e.shiftKey || e.ctrlKey || e.metaKey) { if (already) ui.selKeys = ui.selKeys.filter(k => !(k.o === ref.o && k.p === ref.p && k.f === ref.f)); else ui.selKeys.push(ref); }
    else if (!already) ui.selKeys = [ref];
    const targets = selectedKeyObjects().map(x => ({ o: x.o, p: x.p, k: x.k, f0: x.k.f }));
    tdrag = { mode: 'keys', sx: e.clientX, targets, refs: ui.selKeys.map(k => Object.assign({}, k)), moved: false };
    renderTimeline(); $('#tlBody').setPointerCapture(e.pointerId); return;
  }
  const ruler = t.closest('.ruler');
  if (ruler) { tdrag = { mode: 'scrub', el: ruler }; setFrame(tlFrameAt(e, ruler), { light: true }); $('#tlBody').setPointerCapture(e.pointerId); return; }
  const row = t.closest('[data-obj]');
  if (row) {
    const id = row.dataset.obj;
    ui.selKeys = [];
    if (ui.selObj !== id) { ui.selObj = id; renderSel(); renderInspector(); }
    renderTimeline();
  }
});
$('#tlBody').addEventListener('pointermove', e => {
  if (!tdrag) return;
  const sc = curScene(), tl = KL.tlOf(sc);
  if (tdrag.mode === 'scrub') setFrame(tlFrameAt(e, tdrag.el), { light: true });
  else if (tdrag.mode === 'marker') {
    if (!tdrag.snap) { snapshot(); tdrag.snap = true; }
    const f = Math.max(0, Math.round(tlFrameAt(e, tdrag.ruler)));
    if (tdrag.which === 'pause') { tl.pause = f; if (tl.end < f) tl.end = f; } else tl.end = Math.max(tl.pause, f);
    renderTimeline();
  } else if (tdrag.mode === 'keys') {
    const df = Math.round((e.clientX - tdrag.sx) / ui.ppf);
    if (!tdrag.moved && df === 0) return;
    if (!tdrag.moved) { snapshot(); tdrag.moved = true; }
    const minF0 = Math.min(...tdrag.targets.map(x => x.f0));
    const d = Math.max(-minF0, df);
    const touched = new Set();
    for (const x of tdrag.targets) { x.k.f = x.f0 + d; touched.add(x.o.keys[x.p]); }
    touched.forEach(arr => arr.sort((a, b) => a.f - b.f));
    ui.selKeys = tdrag.refs.map(r => Object.assign({}, r, { f: r.f + d }));
    tdrag.d = d;
    if (vpPlayer) vpPlayer.seek(ui.frame);
    renderTimeline();
  }
});
const endTl = () => {
  if (!tdrag) return;
  const d = tdrag;
  tdrag = null;
  if (d.mode === 'scrub') { renderInspector(); renderTimeline(); }
  else if (d.mode === 'marker' && d.snap) { sceneChanged(); renderInspector(); }
  else if (d.mode === 'keys' && d.moved) {
    // a moved key replaces any key already sitting on its new frame
    const moved = new Set(d.targets.map(x => x.k));
    for (const x of d.targets) { const arr = x.o.keys[x.p]; x.o.keys[x.p] = arr.filter(k => moved.has(k) || !d.targets.some(m => m.o === x.o && m.p === x.p && m.k.f === k.f)); }
    sceneChanged(); renderInspector();
  }
};
$('#tlBody').addEventListener('pointerup', endTl);
$('#tlBody').addEventListener('pointercancel', endTl);
$('#tlBody').addEventListener('dblclick', e => {
  const tr = e.target.closest('.tltrack.sub');
  if (!tr || e.target.closest('.kf')) return;
  const o = curScene().objects.find(x => x.id === tr.dataset.obj), p = tr.dataset.prop;
  const f = Math.round(tlFrameAt(e, tr));
  snapshot(); KL.setKey(o, p, f, KL.valueAt(o, p, f));
  ui.selKeys = [{ o: o.id, p, f }]; setFrame(f, { light: true }); sceneChanged(); renderInspector();
});
$('#tlEase').append(...KL.EASES.map(([v, l]) => h('option', { value: v }, l)));
$('#tlEase').addEventListener('change', e => { const ks = selectedKeyObjects(); if (!ks.length) return; snapshot(); ks.forEach(x => { x.k.e = e.target.value; }); sceneChanged(); toast(`Easing set to ${e.target.selectedOptions[0].textContent}`); });
$('#tlFrame').addEventListener('change', e => setFrame(+e.target.value || 0));
$('#tlZoom').addEventListener('input', e => { ui.ppf = +e.target.value; renderTimeline(); });
function stopTl() { if (vpPlayer && vpPlayer.playing) { vpPlayer.stop(); vpPlayer.onFrame = null; ui.frame = Math.round(ui.frame); $('#tlPlay').textContent = '▶ Play'; renderInspector(); renderTimeline(); } }
function playTl(from, to) {
  const sc = curScene(); if (!sc || !vpPlayer) return;
  if (vpPlayer.playing) return stopTl();
  const tl = KL.tlOf(sc);
  from = from ?? (ui.frame >= tl.end ? 0 : ui.frame); to = to ?? tl.end;
  $('#tlPlay').textContent = '■ Stop';
  vpPlayer.onFrame = f => { ui.frame = f; updatePlayhead(); renderSel(); };
  const run = () => vpPlayer.play(from, to, () => { if ($('#tlLoop').checked && vpPlayer.onFrame) run(); else { vpPlayer.onFrame = null; ui.frame = to; $('#tlPlay').textContent = '▶ Play'; renderInspector(); renderTimeline(); } });
  run();
}

/* ======================= sequence mode ======================= */
function contentOf(t) {
  const sc = sceneById(t.sceneId); if (!sc) return '(scene missing)';
  const rd = resolvedData(t);
  return sc.objects.filter(o => o.published).map(o => { const v = rd[o.id] || {};
    if (o.type === 'image') return v.src ? '[image]' : '[default image]';
    if (o.type === 'video') return '[video]';
    if (o.type === 'ticker') { const it = String(v.items ?? o.p.items ?? '').split('\n').filter(Boolean); return `[ticker: ${it.length} items] ${it[0] || ''}`; }
    if (o.type === 'clock') return '[clock]';
    return String(v.text ?? o.p.text ?? '').replace(/\n/g, ' '); }).join(' | ');
}
function renderRundown() {
  const t = $('#rundown'); t.replaceChildren();
  t.append(h('colgroup', {}, ...[62, 64, 118, 190, null, 88, 48, 70, 62].map(w => h('col', w ? { style: `width:${w}px` } : {}))));
  t.append(h('thead', {}, h('tr', {}, ...['Take ID', 'State', 'Scene', 'Name', 'Content', 'Transition', 'Layer', 'Output', 'Auto out'].map(x => h('th', {}, x)))));
  const tb = h('tbody'); t.append(tb);
  P.takes.forEach(tk => {
    const sc = sceneById(tk.sceneId), air = airOf(tk) != null, sel = tk.id === ui.selTake, dl = Object.values(tk.data || {}).some(v => v && v.link);
    tb.append(h('tr', { class: (air ? 'air ' : '') + (sel ? 'sel' : ''), 'data-id': tk.id, onclick: () => selectTake(tk.id), ondblclick: () => doTake(tk) },
      h('td', { class: 'num' }, pad4(tk.num)), h('td', {}, air ? h('span', { class: 'pill air' }, 'ON AIR') : sel ? h('span', { class: 'pill pvw' }, 'PVW') : ''),
      h('td', {}, sc ? sc.name : '—'), h('td', {}, tk.name), h('td', { title: contentOf(tk) }, dl ? h('span', { class: 'pill dl', title: 'Uses live DataLinq values' }, 'DL') : null, dl ? ' ' : null, contentOf(tk)),
      h('td', {}, { auto: 'Auto / Auto', cut: 'Cut / Cut', fade: 'Fade / Fade' }[tk.transition]), h('td', { class: 'num' }, tk.layer), h('td', {}, 'Ch ' + chOf(tk)), h('td', { class: 'num' }, tk.dur ? tk.dur + 's' : '—')));
  });
  if (!P.takes.length) tb.append(h('tr', {}, h('td', { colspan: 9, class: 'empty' }, 'The rundown is empty. Click + on a scene to add a take.')));
}
function scrollToSel() { const r = $(`#rundown tr[data-id="${ui.selTake}"]`); if (r) r.scrollIntoView({ block: 'nearest' }); }
function selectTake(id) { ui.selTake = id; renderRundown(); renderTakeInsp(); renderPreview(); scrollToSel(); }
function renderTakeInsp() {
  const box = $('#tiBody'); box.replaceChildren();
  const t = curTake();
  $('#tiTabs').replaceChildren(...[['item', 'Take Item'], ['data', 'Template Data']].map(([k, l]) => h('button', { class: 'tab' + (ui.tiTab === k ? ' on' : ''), onclick: () => { ui.tiTab = k; renderTakeInsp(); } }, l)));
  $('#tiTitle').textContent = t ? pad4(t.num) + ' ' + t.name : 'nothing selected';
  if (!t) { box.append(h('p', { class: 'note' }, 'Select a take in the rundown, or add one from the Scene Manager.')); return; }
  const sc = sceneById(t.sceneId);
  const after = () => { renderRundown(); renderPreview(); liveUpdate(t); save(); };
  const C = mk(after);
  if (ui.tiTab === 'item') {
    const g = h('div', { class: 'fgrid', style: 'max-width:640px' }); box.append(g);
    const F = (l, c) => g.append(h('span', { class: 'fl' }, l), c);
    const idIn = h('input', { type: 'number', class: 'in', value: t.num, min: 1 });
    idIn.addEventListener('change', () => { const v = Math.round(+idIn.value); if (!v || P.takes.some(x => x !== t && x.num === v)) { toast(`Take ID ${v || ''} is already in use. Pick another number.`); idIn.value = t.num; return; } snapshot(); t.num = v; after(); $('#tiTitle').textContent = pad4(t.num) + ' ' + t.name; });
    F('Take ID', idIn);
    F('Name', C.txt(t.name, v => { t.name = v; $('#tiTitle').textContent = pad4(t.num) + ' ' + t.name; }));
    F('Scene', C.sel(P.scenes.map(s => [s.id, s.name]), t.sceneId, v => { t.sceneId = v; t.data = {}; }));
    F('Channel', C.sel([['1', 'Channel 1'], ['2', 'Channel 2']], String(chOf(t)), v => { t.channel = +v; }));
    F('Layer', C.num(t.layer, v => { t.layer = Math.max(0, Math.round(v)); }, { min: 0, max: 99 }));
    F('Transition', C.sel([['auto', 'Auto (scene keyframes)'], ['cut', 'Cut'], ['fade', 'Fade']], t.transition, v => { t.transition = v; }));
    F('Auto out (s)', C.num(t.dur || 0, v => { t.dur = Math.max(0, v); }, { min: 0, step: 1 }));
    g.append(h('p', { class: 'note' }, 'Takes on the same layer replace each other. Higher layers key over lower ones. RossTalk: SEQI ' + t.num + ' takes this item on channel ' + chOf(t) + ', SEQO ' + t.num + ' takes it off, CLFB ' + chOf(t) + ':' + t.layer + ' clears its layer.'));
    g.append(h('div', { class: 'btnrow' }, h('button', { class: 'tbtn take', onclick: () => doTake(t) }, 'TAKE'), h('button', { class: 'tbtn', onclick: () => { ui.sceneId = t.sceneId; ui.selObj = null; setMode('layout'); } }, 'Edit scene in Layout')));
    return;
  }
  if (!sc) { box.append(h('p', { class: 'note' }, 'This take\'s scene was deleted.')); return; }
  const pubs = sc.objects.filter(o => o.published);
  if (!pubs.length) { box.append(h('p', { class: 'note' }, `"${sc.name}" has no published objects. Open it in Layout mode and tick Published on the objects you want to edit per take.`)); return; }
  const g = h('div', { class: 'td' }); box.append(g);
  for (const o of pubs) {
    const v = t.data[o.id] || {};
    g.append(h('span', { class: 'k', title: o.name }, h('span', { class: 'ty ' + o.type }, TYPE_LETTER[o.type]), o.name));
    if (v.link) g.append(dlEditor(t, o, after));
    else if (o.type === 'image' || o.type === 'video') {
      const im = o.type === 'image' ? h('img', { src: v.src || o.p.src || KL.SIL(), alt: '' }) : h('span', { class: 'note' }, v.src ? 'custom video' : 'scene video');
      g.append(h('span', { class: 'imgf' }, im, mediaBtn(o.type, url => { snapshot(); t.data[o.id] = Object.assign({}, t.data[o.id], { src: url }); if (o.type === 'image') im.src = url; else im.textContent = 'custom video'; after(); }),
        h('button', { class: 'mini', onclick: () => { snapshot(); if (t.data[o.id]) delete t.data[o.id].src; if (o.type === 'image') im.src = o.p.src || KL.SIL(); after(); } }, 'Scene default')));
    } else if (o.type === 'ticker') {
      const e = h('textarea', { class: 'in', value: v.items ?? o.p.items, rows: 3, title: 'One item per line' });
      bindEdit(e, () => { t.data[o.id] = Object.assign({}, t.data[o.id], { items: e.value }); }, after);
      g.append(e);
    } else if (o.type === 'text' || o.type === 'text3d') {
      const e = h('input', { class: 'in', value: v.text ?? o.p.text, placeholder: o.p.text });
      bindEdit(e, () => { t.data[o.id] = Object.assign({}, t.data[o.id], { text: e.value }); }, after);
      g.append(e);
    } else g.append(h('span', { class: 'note' }, o.p.mode === 'timer' ? `timer ${o.p.timer}` : 'live clock'));
    g.append(o.type === 'clock' ? h('span') : h('button', { class: 'dlbtn' + (v.link ? ' on' : ''), title: v.link ? 'Unlink from DataLinq (keep a static value)' : 'Link this field to a DataLinq source', onclick: () => {
      snapshot();
      const cur = t.data[o.id] = Object.assign({}, t.data[o.id]);
      if (cur.link) { const r = dlValue(cur.link); if (r.ok) { if (o.type === 'image') cur.src = r.value; else cur.text = r.value; } delete cur.link; }
      else { if (!P.dataSources.length) { toast('Add a source first: DataLinq › + Google Sheet or CSV.'); act.dataLinq(); return; } cur.link = { src: P.dataSources[0].id, row: '1', col: 'A' }; }
      after(); renderTakeInsp();
    } }, 'DL'));
  }
}
function dlEditor(t, o, after) {
  const link = t.data[o.id].link;
  link.fmt = link.fmt || {}; link.rule = link.rule || {};
  const srcSel = h('select', { class: 'in' }, P.dataSources.map(s => h('option', { value: s.id }, s.name)));
  srcSel.value = link.src;
  const row = h('input', { class: 'in', value: link.row, title: 'Data row number (1 = first row under the header), Column=Value to find a row (e.g. Jersey=21), or * for every row (tickers)', placeholder: 'row, Col=Val or *' });
  const col = h('input', { class: 'in', value: link.col, title: 'Column header name, letter (A, B, C…) or number', placeholder: 'column' });
  const val = h('span', { class: 'v dlval', 'data-take': t.id, 'data-obj': o.id });
  const upd = () => { link.src = srcSel.value; link.row = row.value; link.col = col.value; paintDlVal(val, link); };
  [srcSel, row, col].forEach(e => bindEdit(e, upd, after));
  const f = link.fmt, r = link.rule, C = mk(() => { paintDlVal(val, link); after(); });
  const fb = C.txt(f.fallback || '', v => { f.fallback = v; }); fb.placeholder = 'if empty show…';
  const pre = C.txt(f.prefix || '', v => { f.prefix = v; }); pre.placeholder = 'prefix';
  const suf = C.txt(f.suffix || '', v => { f.suffix = v; }); suf.placeholder = 'suffix';
  const dec = C.num(f.decimals ?? '', v => { f.decimals = v; }, { min: 0, max: 6 }); dec.placeholder = '–';
  const rv = C.txt(r.value ?? '', v => { r.value = v; }); rv.placeholder = 'value';
  const fmt = h('div', { class: 'dlfmt' },
    C.sel([['', 'As is'], ['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title Case']], f.case || '', v => { f.case = v; }),
    h('label', { title: 'Decimal places for numbers' }, 'Dec', dec),
    C.chk('1,000s', !!f.thousands, v => { f.thousands = v; }),
    fb, pre, suf,
    C.sel([['', 'No color rule'], ['>', 'Color if >'], ['>=', 'Color if ≥'], ['<', 'Color if <'], ['<=', 'Color if ≤'], ['=', 'Color if ='], ['!=', 'Color if ≠'], ['contains', 'Color if contains'], ['empty', 'Color if empty']], r.op || '', v => { r.op = v; }),
    h('span', { class: 'krow' }, rv, C.col(r.color || '#ffd400', v => { r.color = v; })));
  paintDlVal(val, link);
  return h('div', { class: 'dlbox' }, srcSel, row, col, val, fmt);
}
function paintDlVal(el, link) { const r = dlValue(link); const v = r.ok ? DataLinq.format(r.value, link.fmt) : ''; const c = r.ok ? DataLinq.ruleColor(r.value, link.rule) : null; el.textContent = r.ok ? '= ' + (v === '' ? '(empty cell)' : v.replace(/\n/g, ' ⏎ ')) + (c ? '  · color ' + c : '') : '⚠ ' + r.error; el.classList.toggle('err', !r.ok); }
function refreshDlValues() { const t = curTake(); if (!t) return; $$('.dlval').forEach(el => { const v = t.data[el.dataset.obj]; if (v && v.link) paintDlVal(el, v.link); }); }
let pvwPlayer = null;
function renderPreview() {
  const st = $('#pvwStage'); st.replaceChildren();
  const t = curTake();
  $('#pvwTitle').textContent = t ? `Preview · ${pad4(t.num)} ${(sceneById(t.sceneId) || {}).name || ''}` : 'Preview';
  if (ui.plate) st.append(h('div', { class: 'plate' }));
  if (pvwPlayer) pvwPlayer.stop();
  pvwPlayer = null;
  if (!t) return;
  const sc = sceneById(t.sceneId); if (!sc) return;
  const L = h('div', { class: 'layer' }); st.append(L);
  pvwPlayer = new KL.Player(L, sc, resolvedData(t)); pvwPlayer.seek(KL.tlOf(sc).pause);
  renderNext();
}
function renderNext() {
  const box = $('#nextStrip'); box.replaceChildren();
  const i = P.takes.findIndex(x => x.id === ui.selTake), n = P.takes[i + 1];
  if (!n) { box.append(h('span', { class: 'empty' }, 'Next: end of rundown')); return; }
  const sc = sceneById(n.sceneId);
  const th = h('div', { class: 'nthumb' }), st = h('div', { class: 'stage', style: 'transform:scale(.03125)' });
  th.append(st);
  if (sc) { const p = new KL.Player(st, sc, resolvedData(n), { thumb: true }); p.seek(KL.tlOf(sc).pause); }
  box.append(h('span', { class: 'tl' }, 'Next'), th, h('span', { class: 'nm' }, h('b', {}, pad4(n.num)), ' ', n.name, h('span', { class: 'sub2' }, `${sc ? sc.name : '—'} · Ch ${chOf(n)} · L${n.layer}`)));
}
function renderOnAir() {
  const box = $('#onairList');
  box.replaceChildren();
  let total = 0;
  for (const ch of [1, 2]) {
    const ls = Object.keys(programs[ch].layers).map(Number).sort((a, b) => b - a);
    total += ls.length;
    $('#pgmCh' + ch).classList.toggle('on', ui.pgmCh === ch);
    $('#pgmCh' + ch).classList.toggle('air', ls.length > 0);
    for (const L of ls) {
      const m = programs[ch].layers[L].msg;
      box.append(h('span', { class: 'chip' }, h('b', {}, `CH${ch} L${L}`), `${pad4(m.num)} ${m.scene.name}`, h('button', { title: `Clear channel ${ch} layer ${L}`, 'aria-label': `Clear channel ${ch} layer ${L}`, onclick: () => outLayer(L, ch) }, '×')));
    }
  }
  if (!total) box.append(h('span', { class: 'empty' }, 'Nothing on air. Select a take and press TAKE or Space.'));
  const live = Object.keys(programs[ui.pgmCh].layers).length > 0;
  $('#pgmWrap').classList.toggle('live', live); $('#pgmTally').classList.toggle('live', live);
  $('#stAir').textContent = total + (total === 1 ? ' layer' : ' layers') + ' on air';
}
function addTake(sc) {
  snapshot();
  const num = Math.max(1000, ...P.takes.map(t => t.num)) + 1;
  const t = { id: uid(), num, sceneId: sc.id, name: 'Story: ' + sc.name, layer: sc.layer, channel: 1, transition: 'auto', dur: 0, data: {} };
  const cur = P.takes.findIndex(x => x.id === ui.selTake);
  P.takes.splice(cur < 0 ? P.takes.length : cur + 1, 0, t);
  ui.selTake = t.id; ui.tiTab = 'data'; save();
  renderRundown(); renderTakeInsp(); renderPreview(); toast(`Added take ${pad4(num)}`);
}

/* ======================= RossTalk / HTTP control ======================= */
function logControl(line) { ui.ctlLog.push(`${new Date().toLocaleTimeString()}  ${line}`); if (ui.ctlLog.length > 200) ui.ctlLog.shift(); const lg = $('#ctlLog'); if (lg) { lg.textContent = ui.ctlLog.join('\n'); lg.scrollTop = lg.scrollHeight; } }
function setData(num, fields) {
  const t = P.takes.find(x => x.num === +num);
  if (!t) return { ok: false, error: `No take ${num}` };
  const sc = sceneById(t.sceneId);
  const changed = [];
  for (const [k, v] of Object.entries(fields || {})) {
    const o = sc.objects.find(x => x.name.toLowerCase() === String(k).toLowerCase());
    if (!o) continue;
    t.data[o.id] = Object.assign({}, t.data[o.id], (o.type === 'image' || o.type === 'video') ? { src: String(v) } : o.type === 'ticker' ? { items: String(v).replace(/\|/g, '\n') } : { text: String(v) });
    delete t.data[o.id].link;
    changed.push(o.name);
  }
  if (!changed.length) return { ok: false, error: 'No matching field names. Use the published object names, e.g. LINE 1.' };
  save(); liveUpdate(t);
  if (t.id === ui.selTake) { renderTakeInsp(); renderPreview(); }
  renderRundown();
  return { ok: true, take: t.num, fields: changed };
}
function handleControl(cmd) {
  if (cmd && typeof cmd === 'object') { if (cmd.cmd === 'SETDATA') { logControl(`HTTP set ${cmd.take} ${JSON.stringify(cmd.fields)}`); return setData(cmd.take, cmd.fields); } return { ok: false, error: 'Unknown command' }; }
  const line = String(cmd).trim(), sp = line.search(/\s/);
  const verb = (sp < 0 ? line : line.slice(0, sp)).toUpperCase(), arg = sp < 0 ? '' : line.slice(sp + 1).trim();
  const parts = arg.split(':');
  const byNum = n => P.takes.find(t => t.num === parseInt(n, 10));
  if (!['LIST', 'STATE'].includes(verb)) { logControl(line); $('#stCtl').title = 'Last command: ' + line; }
  const ok = (extra) => Object.assign({ ok: true }, extra);
  const fbLayer = () => ({ ch: Math.min(2, Math.max(1, parseInt(parts[0], 10) || 1)), L: parts.length >= 2 && parts[1] !== '' ? +parts[1] : null });
  switch (verb) {
    case 'SEQI': case 'TAKE': { const t = byNum(parts[0]); if (!t) return { ok: false, error: `No take ${parts[0]}` }; doTake(t, { layer: parts[1] !== undefined && parts[1] !== '' ? +parts[1] : undefined, advance: false, follow: false }); return ok({ take: t.num, channel: chOf(t) }); }
    case 'SEQO': { const t = byNum(parts[0]); if (!t) return { ok: false, error: `No take ${parts[0]}` }; const a = airOf(t); if (a) outLayer(a.L, a.ch); return ok(); }
    case 'CLFB': case 'LAYEROFF': case 'RESUME': { const { ch, L } = fbLayer(); if (!arg) clearAll(); else if (L == null) clearAll(ch); else outLayer(L, ch); return ok(); }
    case 'CLRA': clearAll(); return ok();
    case 'READ': case 'CUE': case 'FOCUS': case 'UPNEXT': { const t = byNum(parts[0]); if (!t) return { ok: false, error: `No take ${parts[0]}` }; selectTake(t.id); return ok({ take: t.num }); }
    case 'UP': case 'DOWN': { const i = P.takes.findIndex(t => t.id === ui.selTake), j = Math.max(0, Math.min(P.takes.length - 1, i + (verb === 'DOWN' ? 1 : -1))); if (P.takes[j]) selectTake(P.takes[j].id); return ok(); }
    case 'NEXT': doTake(curTake()); return ok();
    case 'SETDATA': { const [num, field, ...rest] = parts; return setData(num, { [field]: rest.join(':') }); }
    case 'TIMER': { const [name, action, ...rest] = parts; const r = timerCmd(name, action || 'TOGGLE', rest.join(':')); if (ui.timersOpen) paintTimers(); return r; }
    case 'GPI': return ok({ note: 'GPI accepted; no action assigned' });
    case 'LIST': return ok({ takes: P.takes.map(t => ({ id: t.num, name: t.name, scene: (sceneById(t.sceneId) || {}).name, channel: chOf(t), layer: t.layer, onAir: airOf(t) != null })), selected: curTake() ? curTake().num : null });
    case 'STATE': return ok({ layers: [1, 2].flatMap(ch => Object.keys(programs[ch].layers).map(L => ({ channel: ch, layer: +L, take: programs[ch].layers[L].msg.num, scene: programs[ch].layers[L].msg.scene.name }))), selected: curTake() ? curTake().num : null, ndi: ui.ndi.running, timers: Object.fromEntries(Object.keys(ui.timerState).map(n => [n, { value: KL.fmtTimer(KL.timerValue(n), 'M:SS.t'), running: ui.timerState[n].running }])) });
    default: return { ok: false, error: `Unknown command ${verb}` };
  }
}
async function applyControl() {
  if (!api) return;
  const st = await api.controlConfig({ enabled: S.ctlEnabled, rosstalkPort: +S.rosstalkPort, httpPort: +S.httpPort, bind: S.ctlBind, allow: S.ctlAllow });
  ui.ctlStatus = st;
  const el = $('#stCtl');
  if (!st.enabled) { el.textContent = 'Control off'; el.className = 'm'; }
  else { el.textContent = `RossTalk ${st.rosstalk ? ':' + st.rosstalk : 'failed'} · HTTP ${st.http ? ':' + st.http : 'failed'}`; el.className = 'm ' + (st.errors.length ? 'bad' : 'ok'); }
  if (st.errors.length) toast(st.errors.join(' · ') + '. Another program may be using that port.');
  return st;
}

/* ======================= NDI + fullscreen output ======================= */
function ndiPlan() {
  const out = [{ ch: 1, mode: 'fill', name: S.ndiName }];
  if (S.ndiKey) out.push({ ch: 1, mode: 'key', name: S.ndiName + ' (Key)' });
  if (S.ndiCh2) { out.push({ ch: 2, mode: 'fill', name: S.ndiName2 }); if (S.ndiKey) out.push({ ch: 2, mode: 'key', name: S.ndiName2 + ' (Key)' }); }
  return out;
}
async function startNdi() {
  if (!api) return toast('NDI output needs the desktop app.');
  toast('Starting NDI…');
  await api.ndiStop();
  const errors = [], names = [];
  for (const o of ndiPlan()) {
    const r = await api.ndiStart({ ch: o.ch, mode: o.mode, name: o.name, fps: S.ndiFps, unpremultiply: S.ndiUnpremul, libPath: S.ndiLib || null });
    if (r.ok) { names.push(o.name); ui.ndi.lib = r.lib; } else errors.push(r.error);
  }
  ui.ndi = { running: names.length > 0, names, lib: ui.ndi.lib, error: errors[0] };
  renderNdi();
  if (errors.length && !names.length) { modal('NDI did not start', h('div', {}, h('p', {}, errors[0]), h('p', { class: 'note' }, 'Download NDI Tools from ndi.video (free). It installs the NDI runtime that Keyline uses. Then press Start again.')), [['Close']]); return; }
  toast(`NDI live: ${names.join(', ')}` + (errors.length ? ` · ${errors.length} failed` : ''));
}
async function stopNdi() { if (!api) return; await api.ndiStop(); ui.ndi = { running: false }; renderNdi(); toast('NDI stopped'); }
function renderNdi() { const b = $('#bNdi'); b.classList.toggle('live', ui.ndi.running); b.textContent = ui.ndi.running ? `NDI ● ${(ui.ndi.names || []).length} out` : 'NDI off'; $('#stNdi').textContent = ui.ndi.running ? `NDI ${S.ndiFps}` : ''; $('#stNdi').className = 'm ' + (ui.ndi.running ? 'ok' : ''); }

/* ======================= DashBoard panel export ======================= */
function dashboardXML(host, port) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const js = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const send = cmd => `rosstalk.sendMessage(params.getValue('keyline_host', 0), params.getValue('keyline_port', 0), '${js(cmd)}');`;
  const btn = (x, y, w, hh, label, cmd, bg) => `   <button buttontype="push" height="${hh}" left="${x}" name="${esc(label)}" style="${bg ? 'bg#' + bg + ';' : ''}txt-align:center;" top="${y}" width="${w}">\n      <task tasktype="ogscript">${esc(send(cmd))}</task>\n   </button>`;
  const out = [];
  out.push(btn(20, 90, 150, 60, 'TAKE NEXT', 'NEXT', 'dd2222'), btn(180, 90, 150, 60, 'CLEAR ALL', 'CLRA'), btn(340, 90, 90, 60, 'UP', 'UP'), btn(440, 90, 90, 60, 'DOWN', 'DOWN'));
  const layers = [...new Set(P.takes.map(t => chOf(t) + ':' + t.layer))].sort();
  layers.slice(0, 4).forEach((k, i) => { const [c, L] = k.split(':'); out.push(btn(540 + i * 120, 90, 110, 60, `CLEAR CH${c} L${L}`, 'CLFB ' + k)); });
  (P.timers || []).slice(0, 3).forEach((tm, i) => { const y = 160; const x = 20 + i * 340; out.push(btn(x, y, 100, 50, tm.name + ' START', `TIMER ${tm.name}:START`, '1d7a3a'), btn(x + 104, y, 100, 50, tm.name + ' STOP', `TIMER ${tm.name}:STOP`, '8a1c1c'), btn(x + 208, y, 100, 50, tm.name + ' RESET', `TIMER ${tm.name}:RESET`)); });
  P.takes.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 20 + col * 250, y = 230 + row * 80;
    out.push(btn(x, y, 180, 70, `${pad4(t.num)} ${t.name}`.slice(0, 40), `SEQI ${t.num}`, '1f3a66'), btn(x + 184, y, 52, 70, 'OUT', `SEQO ${t.num}`));
  });
  const rows = Math.ceil(P.takes.length / 4);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Keyline CG Studio control panel for Ross DashBoard (CustomPanel). Generated ${new Date().toISOString()} for project "${esc(P.name)}".
     Open in DashBoard: File > Open, or drop into a CustomPanel folder. Sends RossTalk to Keyline (default TCP ${port}). -->
<abs contexttype="opengear" id="_top" keepalive="false" style="bg#2b2f36;" width="1040" height="${270 + rows * 80}">
   <meta>
      <params>
         <param access="1" maxlength="0" name="Keyline Host" oid="keyline_host" type="STRING" value="${esc(host)}" widget="text"/>
         <param access="1" constrainttype="INT_NULL" name="Keyline RossTalk Port" oid="keyline_port" precision="0" type="INT32" value="${port}" widget="default"/>
      </params>
   </meta>
   <label height="30" left="20" name="KEYLINE CG STUDIO · ${esc(P.name)}" style="txt-align:west;font:bold;size:Bigger;fg#ffffff;" top="10" width="600"/>
   <label height="24" left="20" name="Host" style="txt-align:west;fg#cccccc;" top="48" width="40"/>
   <param expand="true" height="26" left="64" oid="keyline_host" top="46" width="200"/>
   <label height="24" left="280" name="Port" style="txt-align:west;fg#cccccc;" top="48" width="40"/>
   <param expand="true" height="26" left="320" oid="keyline_port" top="46" width="90"/>
${out.join('\n')}
</abs>
`;
}

/* ======================= vMix GT import ======================= */
async function importGT() {
  if (!api) return toast('Importing vMix titles needs the desktop app.');
  const pkgs = await api.importGT();
  if (!pkgs || !pkgs.length) return;
  snapshot();
  const msgs = [];
  let last = null;
  for (const pkg of pkgs) {
    try {
      const { scene, warnings } = GTImport.convert(pkg);
      P.scenes.push(scene); last = scene;
      msgs.push(`✔ ${pkg.name}: ${scene.objects.length} objects, ${scene.objects.filter(o => o.published).length} published fields (design ${scene.source.design}).`);
      warnings.forEach(w => msgs.push('   ' + w));
    } catch (e) { msgs.push(`✘ ${pkg.name}: ${e.message}`); }
  }
  if (!last) { undoStack.pop(); }
  else { ui.sceneId = last.id; ui.selObj = null; ui.cat = 'GT'; ui.frame = KL.tlOf(last).pause; save(); setMode('layout'); }
  modal('vMix title import', h('div', {}, h('pre', { class: 'stat' + (last ? ' ok' : ' bad') }, msgs.join('\n')),
    h('p', { class: 'note' }, 'Text and image elements become published fields you can fill per take or link to DataLinq. vMix animations are not carried over; each object gets a fade you can replace with keyframes.')), [['Close']]);
}

/* ======================= project files ======================= */
function projectText() { return JSON.stringify(Object.assign({}, P, { app: 'keyline-cg', version: 2 })); }
async function saveProject(saveAs) {
  if (!api) { lsSet(KEY, JSON.stringify(P)); ui.dirty = false; updateTitle(); return toast('Saved in this browser'); }
  const p = await api.saveProject(projectText(), ui.filePath, saveAs, P.name);
  if (!p) return false;
  ui.filePath = p; lsSet(KEY + '-path', p);
  const base = p.split(/[\\/]/).pop().replace(/\.(klcg|json)$/i, '');
  if (P.name === 'Untitled' || P.name === 'Sample Project' || saveAs) P.name = base;
  lsSet(KEY, JSON.stringify(P));
  ui.dirty = false; updateTitle(); toast('Saved ' + p);
  return true;
}
function loadProject(p, path) {
  clearAllNow();
  P = migrate(p); ui.filePath = path || null; lsSet(KEY + '-path', path || '');
  undoStack = []; redoStack = [];
  ui.sceneId = null; ui.selTake = null; fixUi(); ui.frame = curScene() ? KL.tlOf(curScene()).pause : 0;
  lsSet(KEY, JSON.stringify(P)); ui.dirty = false;
  ui.timerState = {}; initTimers(); applyFonts();
  renderAll(); scheduleSources(); updateTitle(); externalizeMedia();
}
function applyFonts() { KL.setFonts(P.fonts); if (api) api.output({ type: 'fonts', fonts: P.fonts }); }
/* Older projects embedded images as data: URIs; move big ones into the media store so saves/undo stay fast. */
async function externalizeMedia() {
  if (!api) return;
  const big = new Set();
  const walk = v => { if (typeof v === 'string') { if (v.startsWith('data:') && v.length > 8192) big.add(v); } else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k]); };
  walk(P);
  if (!big.size) return;
  const map = new Map();
  for (const u of big) { const url = await api.storeDataUri(u); if (url) map.set(u, url); }
  const fix = v => { if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (typeof v[k] === 'string' && map.has(v[k])) v[k] = map.get(v[k]); else fix(v[k]); } };
  fix(P); undoStack = []; redoStack = []; save(); renderAll();
  toast(`Moved ${map.size} embedded image${map.size > 1 ? 's' : ''} into the media library`);
}
async function openProject() {
  if (!api) return toast('Opening files needs the desktop app.');
  const r = await api.openProject(); if (!r) return;
  try { const p = JSON.parse(r.text); if (!p.scenes || !p.takes) throw new Error('not a project'); loadProject(p, r.path); toast('Opened ' + r.path); }
  catch (e) { modal('Could not open project', h('p', {}, 'That file is not a Keyline project. It should be a .klcg file saved from Keyline CG Studio.'), [['Close']]); }
}
function confirmDiscard(then) {
  if (!ui.dirty) return then();
  modal('Unsaved changes', h('p', {}, `Save changes to "${P.name}" first?`), [['Cancel'], ['Don\'t save', () => { then(); }], ['Save', () => { saveProject(false).then(ok => { if (ok !== false) then(); }); }, true]]);
}
function clearAllNow() { Object.values(ui.timers).forEach(clearTimeout); sendProgram({ type: 'reset' }); }

/* ======================= actions ======================= */
function moveIn(arr, item, d) { const i = arr.indexOf(item), j = i + d; if (i < 0 || j < 0 || j >= arr.length) return false; arr.splice(i, 1); arr.splice(j, 0, item); return true; }
const isTyping = () => { const a = document.activeElement; return a && (/^(TEXTAREA|SELECT)$/.test(a.tagName) || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|color)$/.test(a.type))); };
const act = {
  undo, redo, take: () => doTake(curTake()), clearAll, save: () => saveProject(false), saveAs: () => saveProject(true), open: () => confirmDiscard(openProject),
  newProject: () => confirmDiscard(() => { loadProject(emptyProject(), null); toast('New project'); }),
  importGT, exportDashboard: () => act.outputSettings('dash'),
  clearSel: () => { const t = curTake(); if (!t) return; const a = airOf(t); if (a) outLayer(a.L, a.ch); else if (programs[chOf(t)].layers[t.layer]) outLayer(t.layer, chOf(t)); else toast(`Channel ${chOf(t)} layer ${t.layer} is already clear`); },
  toggleSafe: () => { ui.safe = !ui.safe; renderViewport(); syncToggles(); },
  togglePlate: () => { ui.plate = !ui.plate; $('#pgmPlate').hidden = !ui.plate; renderPreview(); syncToggles(); },
  toggleNdi: () => ui.ndi.running ? stopNdi() : startNdi(),
  newScene: () => { snapshot(); const n = P.scenes.length + 1, cat = ui.cat === 'All' ? 'FS' : ui.cat; const sc = { id: uid(), name: 'NEW SCENE ' + n, category: cat, layer: cat === 'L3' ? 20 : cat === 'BUG' ? 30 : 0, objects: [], tl: { fps: 30, pause: 30, end: 45 } }; P.scenes.push(sc); ui.sceneId = sc.id; ui.selObj = null; ui.frame = 0; if (ui.mode !== 'layout') setMode('layout'); save(); renderCats(); renderSceneLists(); renderLayoutSide(); toast('Created ' + sc.name); },
  dupScene: () => { const sc = curScene(); if (!sc) return; snapshot(); const c = clone(sc); c.id = uid(); c.name = sc.name + ' COPY'; c.objects.forEach(o => { o.id = uid(); }); P.scenes.splice(P.scenes.indexOf(sc) + 1, 0, c); ui.sceneId = c.id; ui.selObj = null; save(); renderCats(); renderSceneLists(); renderLayoutSide(); toast('Duplicated scene'); },
  delScene: () => { const sc = curScene(); if (!sc) return; const n = P.takes.filter(t => t.sceneId === sc.id).length;
    modal('Delete scene', h('p', {}, `Delete "${sc.name}"` + (n ? ` and the ${n} take${n > 1 ? 's' : ''} that use it?` : '?') + ` You can undo this with ${MOD}+Z.`), [['Cancel'], ['Delete scene', () => { snapshot(); P.takes = P.takes.filter(t => t.sceneId !== sc.id); P.scenes = P.scenes.filter(s => s !== sc); fixUi(); save(); renderAll(); toast('Deleted ' + sc.name); }, true]]); },
  objUp: () => { const o = selObj(); if (!o) return toast('Select an object first'); snapshot(); moveIn(curScene().objects, o, 1); sceneChanged(); },
  objDown: () => { const o = selObj(); if (!o) return toast('Select an object first'); snapshot(); moveIn(curScene().objects, o, -1); sceneChanged(); },
  objDup: () => { const o = selObj(); if (!o) return toast('Select an object first'); snapshot(); const c = clone(o); c.id = uid(); c.name = o.name + ' copy'; c.x += 20; c.y += 20; if (c.keys) { for (const p of ['x', 'y']) if (c.keys[p]) c.keys[p].forEach(k => { k.v += 20; }); } const a = curScene().objects; a.splice(a.indexOf(o) + 1, 0, c); ui.selObj = c.id; sceneChanged(); renderInspector(); },
  objDel: () => { const o = selObj(); if (!o) return toast('Select an object first'); snapshot(); const a = curScene().objects; a.splice(a.indexOf(o), 1); ui.selObj = null; sceneChanged(); renderInspector(); toast('Deleted ' + o.name); },
  playPvw: () => { if (pvwPlayer) { pvwPlayer.seek(0); pvwPlayer.playIn(); } },
  takeUp: () => { const t = curTake(); if (t) { snapshot(); moveIn(P.takes, t, -1); save(); renderRundown(); } },
  takeDown: () => { const t = curTake(); if (t) { snapshot(); moveIn(P.takes, t, 1); save(); renderRundown(); } },
  takeDup: () => { const t = curTake(); if (!t) return; snapshot(); const c = clone(t); c.id = uid(); c.num = Math.max(...P.takes.map(x => x.num)) + 1; c.name = t.name + ' copy'; P.takes.splice(P.takes.indexOf(t) + 1, 0, c); ui.selTake = c.id; save(); renderRundown(); renderTakeInsp(); renderPreview(); toast('Duplicated as ' + pad4(c.num)); },
  takeDel: () => { const t = curTake(); if (!t) return; snapshot(); const i = P.takes.indexOf(t); P.takes.splice(i, 1); ui.selTake = (P.takes[i] || P.takes[i - 1] || {}).id; save(); renderRundown(); renderTakeInsp(); renderPreview(); toast(`Deleted take ${pad4(t.num)}`); },
  addTakeCur: () => { const sc = curScene(); if (sc) { addTake(sc); setMode('seq'); } },
  tlPlay: () => playTl(), tlPlayIn: () => { stopTl(); playTl(0, KL.tlOf(curScene()).pause); }, tlPlayOut: () => { stopTl(); const tl = KL.tlOf(curScene()); playTl(tl.pause, tl.end); },
  tlHome: () => { stopTl(); setFrame(0); }, tlEnd: () => { stopTl(); setFrame(KL.tlOf(curScene()).end); },
  tlPrev: () => { stopTl(); setFrame(ui.frame - 1); }, tlNext: () => { stopTl(); setFrame(ui.frame + 1); },
  tlAuto: () => { ui.autoKey = !ui.autoKey; renderViewport(); renderTimeline(); renderInspector(); toast(ui.autoKey ? 'Auto-key on: changes write keyframes at the current frame' : 'Auto-key off'); },
  tlKey: keySelected, tlDelKeys: deleteSelectedKeys,
  tlSetPause: () => { const sc = curScene(); if (!sc) return; snapshot(); const tl = KL.tlOf(sc); tl.pause = Math.round(ui.frame); if (tl.end < tl.pause) tl.end = tl.pause; sceneChanged(); renderInspector(); },
  tlSetEnd: () => { const sc = curScene(); if (!sc) return; snapshot(); const tl = KL.tlOf(sc); tl.end = Math.max(tl.pause, Math.round(ui.frame)); sceneChanged(); renderInspector(); },
  reset: () => modal('Load sample project', h('p', {}, 'Replace the current project with the sample scenes and rundown?'), [['Cancel'], ['Load sample', () => { loadProject(sample(), null); ui.dirty = true; updateTitle(); toast('Sample project loaded'); }, true]]),
  dataLinq: () => openDlModal(),
  timers: () => openTimers(),
  importFont: async () => {
    if (!api) return toast('Importing fonts needs the desktop app.');
    const r = await api.importMedia('font'); if (!r) return;
    snapshot();
    const family = r.base.replace(/[-_](regular|bold|italic|medium|semibold|black|light)$/i, '').replace(/[-_]+/g, ' ').trim() || r.base;
    P.fonts = P.fonts.filter(f => f.family !== family); P.fonts.push({ family, url: r.url, file: r.name });
    applyFonts(); save(); renderInspector(); toast(`Font "${family}" added. Pick it in the Font list.`);
  },
  smartUndo: () => { if (isTyping()) document.execCommand('undo'); else undo(); },
  smartRedo: () => { if (isTyping()) document.execCommand('redo'); else redo(); },
  outputSettings: (focus) => openOutputModal(focus),
  help: () => modal('Keyboard shortcuts', h('div', { class: 'keys' }, ...[['F3 / F4', 'Layout / Sequence mode'], ['Space', 'Sequence: take selected · Layout: play/stop timeline'], ['Esc', 'Sequence: clear all · Layout: deselect'], ['↑ ↓', 'Move the rundown selection'], [', and .', 'Previous / next frame (Shift: 10 frames)'], ['Home / End', 'First / last frame'], ['K', 'Key the selected object at the current frame'], ['A', 'Toggle Auto-key'], ['Delete', 'Delete selected keyframes (timeline) or object (viewport)'], ['Arrows', 'Nudge object 1px (Shift: 10px)'], [MOD + '+D', 'Duplicate object'], [MOD + '+Z / ' + MOD + '+Y', 'Undo / redo'], [MOD + '+S', 'Save project'], ['Take ID + Enter', 'Jump to a take (Shift+Enter takes it)']].flatMap(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])), [['Close']]),
  controlRef: () => openOutputModal('control'),
  about: () => modal('About Keyline CG Studio', h('div', {}, h('p', {}, 'Keyline CG Studio 2.0: broadcast character generator with keyframe animation, layered program output, NDI, DataLinq and RossTalk control.'), h('p', { class: 'note' }, 'Fonts: Barlow Condensed, Oswald, Anton, Teko, Roboto Condensed, Archivo Narrow and Bebas Neue (SIL Open Font License). NDI® is a registered trademark of Vizrt NDI AB.')), [['Close']])
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && act[b.dataset.act]) act[b.dataset.act](); });
if (api) api.onMenu(a => { if (act[a]) act[a](); });

/* ======================= DataLinq manager ======================= */
function openDlModal() {
  ui.dlOpen = ui.dlOpen && P.dataSources.find(s => s.id === ui.dlOpen.sel) ? ui.dlOpen : { sel: P.dataSources[0] ? P.dataSources[0].id : null };
  modal('DataLinq · live data sources', h('div', { id: 'dlRoot', style: 'height:100%' }), [['Close', () => { ui.dlOpen = null; }]], 'wide');
  refreshDlModal();
}
function addSource(type) {
  snapshot();
  const n = P.dataSources.length + 1;
  const s = { id: uid(), name: { gsheet: 'Google Sheet ', url: 'CSV link ', file: 'CSV file ', inline: 'Pasted CSV ', json: 'JSON feed ', xlsx: 'Excel ' }[type] + n, type, url: '', sheet: '', path: '', text: type === 'inline' ? 'Name,Value\nExample,42' : '', header: true, interval: type === 'inline' ? 0 : 10, enabled: true };
  P.dataSources.push(s); ui.dlOpen.sel = s.id; save(); scheduleSources(); refreshDlModal();
}
function refreshDlModal() {
  const root = $('#dlRoot'); if (!root || !ui.dlOpen) return;
  const active = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
  const s = P.dataSources.find(x => x.id === ui.dlOpen.sel);
  const list = h('div', { class: 'srclist' },
    ...P.dataSources.map(x => { const c = DL[x.id] || {}; return h('div', { class: 'src' + (x.id === ui.dlOpen.sel ? ' on' : ''), onclick: () => { ui.dlOpen.sel = x.id; refreshDlModal(); } }, h('b', {}, x.name),
      h('small', { class: c.error ? 'bad' : c.rows ? 'ok' : '' }, c.error ? '⚠ ' + c.error : c.rows ? `${c.rows.length} rows · ${c.at ? c.at.toLocaleTimeString() : ''}` : (x.enabled === false ? 'paused' : 'loading…'))); }),
    !P.dataSources.length ? h('p', { class: 'empty' }, 'No sources yet.') : null,
    h('div', { class: 'btnrow', style: 'margin-top:auto;padding-top:6px' }, h('button', { class: 'mini', onclick: () => addSource('gsheet') }, '+ Google Sheet'), h('button', { class: 'mini', onclick: () => addSource('url') }, '+ CSV link'), h('button', { class: 'mini', onclick: () => addSource('file') }, '+ CSV file'), h('button', { class: 'mini', onclick: () => addSource('inline') }, '+ Paste CSV'), h('button', { class: 'mini', onclick: () => addSource('json') }, '+ JSON feed'), h('button', { class: 'mini', onclick: () => addSource('xlsx') }, '+ Excel')));
  const ed = h('div', { class: 'srced' });
  if (s) {
    const after = () => { save(); refreshDlTitles(); };
    const C = mk(after);
    const g = h('div', { class: 'fgrid', style: 'grid-template-columns:110px minmax(0,1fr)' });
    const F = (l, c) => g.append(h('span', { class: 'fl' }, l), c);
    const nameIn = C.txt(s.name, v => { s.name = v; }); nameIn.id = 'dlName'; F('Name', nameIn);
    F('Type', h('span', {}, { gsheet: 'Google Sheet', url: 'CSV from a web link', file: 'CSV file on this computer (re-read on each refresh)', inline: 'Pasted CSV (stored in the project)', json: 'JSON from a web API or file', xlsx: 'Excel workbook (.xlsx), file or link' }[s.type]));
    if (s.type === 'gsheet') {
      const u = C.txt(s.url, v => { s.url = v; }); u.id = 'dlUrl'; u.placeholder = 'https://docs.google.com/spreadsheets/d/…'; F('Sheet link', u);
      const sh = C.txt(s.sheet || '', v => { s.sheet = v; }); sh.id = 'dlSheet'; sh.placeholder = 'optional, e.g. Roster'; F('Tab name', sh);
      g.append(h('p', { class: 'note' }, 'In Google Sheets choose Share › "Anyone with the link: Viewer", then paste the link from your browser. A specific tab can be picked by name, or by opening that tab before copying the link. "File › Share › Publish to web" links work too.'));
      g.append(h('p', { class: 'note' }, h('span', {}, 'Fetching: '), h('code', {}, s.url ? DataLinq.sheetToCsvUrl(s.url, s.sheet) : '—')));
    } else if (s.type === 'url') {
      const u = C.txt(s.url, v => { s.url = v; }); u.id = 'dlUrl'; u.placeholder = 'https://example.com/stats.csv'; F('CSV link', u);
    } else if (s.type === 'json' || s.type === 'xlsx') {
      const u = C.txt(s.url, v => { s.url = v; }); u.id = 'dlUrl'; u.placeholder = s.type === 'json' ? 'https://api.example.com/scores.json or a file path' : 'C:\\Stats\\game.xlsx or https://…/book.xlsx';
      F(s.type === 'json' ? 'Address' : 'Workbook', h('span', { class: 'krow' }, u, h('button', { class: 'mini', onclick: async () => { if (!api) return toast('Needs the desktop app'); const f = await api.pickDataFile(s.type); if (f) { snapshot(); s.url = f; save(); fetchSource(s); refreshDlModal(); } } }, 'Browse…')));
      if (s.type === 'json') { const pth = C.txt(s.path || '', v => { s.path = v; clearTimeout(pth._t); pth._t = setTimeout(() => fetchSource(s), 500); }); pth.id = 'dlPath'; pth.placeholder = 'e.g. data.players or games[0].teams'; F('Path to list', pth); g.append(h('p', { class: 'note' }, 'Point the path at a list of records; each record becomes a row and its fields become columns (nested fields as team.name).')); }
      else { const sh = C.txt(s.sheet || '', v => { s.sheet = v; clearTimeout(sh._t); sh._t = setTimeout(() => fetchSource(s), 500); }); sh.id = 'dlSheet'; sh.placeholder = 'first sheet'; F('Sheet', sh); g.append(h('p', { class: 'note' }, 'Reads the values Excel last saved (formulas show their last result). Dates appear as Excel serial numbers unless the cell is text.')); }
    } else if (s.type === 'file') {
      const pth = C.txt(s.path || '', v => { s.path = v; }); pth.id = 'dlPath';
      F('File', h('span', { class: 'krow' }, pth, h('button', { class: 'mini', onclick: async () => { if (!api) return toast('Needs the desktop app'); const f = await api.pickDataFile('csv'); if (f) { snapshot(); s.path = f; save(); fetchSource(s); refreshDlModal(); } } }, 'Browse…')));
    } else {
      const ta = h('textarea', { class: 'in big', id: 'dlText', style: 'min-height:120px;font:11px var(--mono)', value: s.text || '' });
      bindEdit(ta, () => { s.text = ta.value; }, () => { save(); clearTimeout(ta._t); ta._t = setTimeout(() => fetchSource(s), 400); });
      F('CSV text', ta);
    }
    F('Options', h('span', { class: 'chkrow' }, C.chk('First row is headers', s.header !== false, v => { s.header = v; fetchSource(s); }), C.chk('Enabled', s.enabled !== false, v => { s.enabled = v; scheduleSources(); })));
    if (s.type !== 'inline') { const iv = C.num(s.interval, v => { s.interval = Math.max(0, v); clearTimeout(iv._t); iv._t = setTimeout(scheduleSources, 600); }, { min: 0, step: 1 }); iv.id = 'dlInt'; F('Refresh every', h('span', { class: 'krow' }, iv, h('span', { class: 'tl' }, 'seconds (0 = manual)'))); }
    const c = DL[s.id] || {};
    g.append(h('div', { class: 'btnrow' },
      h('button', { class: 'tbtn on', onclick: () => fetchSource(s) }, 'Refresh now'),
      h('button', { class: 'tbtn', onclick: () => { const used = P.takes.filter(t => takeUsesSource(t, s.id)).length; snapshot(); P.dataSources = P.dataSources.filter(x => x !== s); ui.dlOpen.sel = P.dataSources[0] ? P.dataSources[0].id : null; save(); scheduleSources(); refreshDlModal(); toast(`Deleted source${used ? `; ${used} take${used > 1 ? 's' : ''} lost their link values` : ''}`); } }, 'Delete source'),
      h('span', { class: 'tl', style: 'align-self:center' }, c.loading ? 'Loading…' : c.error ? '' : c.at ? `Updated ${c.at.toLocaleTimeString()}` : '')));
    if (c.error) g.append(h('div', { class: 'stat bad', style: 'grid-column:1/-1' }, c.error));
    ed.append(g);
    ed.append(h('div', { class: 'note' }, 'Link a field in Sequence › Template Data with the DL button. Row: a number (1 = first data row) or Column=Value, e.g. ', h('code', {}, 'Jersey=21'), '. Column: header name, letter or number. Hover a cell for its reference.'));
    const prev = h('div', { class: 'prev' });
    if (c.rows && c.rows.length) {
      const header = s.header !== false ? c.rows[0] : null, body = header ? c.rows.slice(1) : c.rows;
      const ncol = Math.max(...c.rows.map(r => r.length));
      const tbl = h('table', {}, h('thead', {}, h('tr', {}, h('th', { class: 'rn' }, '#'), ...Array.from({ length: ncol }, (_, i) => h('th', {}, DataLinq.colLetter(i) + (header && header[i] ? ' · ' + header[i] : ''))))),
        h('tbody', {}, ...body.slice(0, 200).map((r, ri) => h('tr', {}, h('td', { class: 'rn' }, ri + 1), ...Array.from({ length: ncol }, (_, i) => h('td', { title: `Row ${ri + 1}, column ${header && header[i] ? header[i] : DataLinq.colLetter(i)}` }, r[i] ?? ''))))));
      prev.append(tbl);
    } else prev.append(h('p', { class: 'empty', style: 'padding:8px' }, c.loading ? 'Loading…' : 'No rows yet.'));
    ed.append(prev);
  } else ed.append(h('p', { class: 'note' }, 'Add a Google Sheet, a CSV link, a CSV file, or paste CSV. Values refresh on a timer and update on-air graphics live.'));
  root.replaceChildren(h('div', { class: 'split' }, list, ed));
  if (active && $('#' + active)) { const el = $('#' + active); el.focus(); if (el.setSelectionRange && el.type !== 'number') { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* ignore */ } } }
}
function refreshDlTitles() { const on = $('#dlRoot .src.on b'); const s = P.dataSources.find(x => x.id === (ui.dlOpen || {}).sel); if (on && s) on.textContent = s.name; }

/* ======================= Clocks & timers panel ======================= */
function openTimers() {
  ui.timersOpen = true;
  modal('Clocks & timers', h('div', { id: 'timersRoot' }), [['Close', () => { ui.timersOpen = false; }]]);
  renderTimers();
  clearInterval(ui.timerPoll); ui.timerPoll = setInterval(() => { if ($('#modal').hidden) { clearInterval(ui.timerPoll); ui.timersOpen = false; } else paintTimers(); }, 100);
}
function paintTimers() { $$('#timersRoot .disp').forEach(d => { const n = d.dataset.t; d.textContent = KL.fmtTimer(KL.timerValue(n), 'M:SS.t'); d.classList.toggle('run', !!(ui.timerState[n] && ui.timerState[n].running)); }); }
function renderTimers() {
  const root = $('#timersRoot'); if (!root) return;
  const list = h('div', { class: 'timers' });
  for (const t of P.timers) {
    const n = t.name.toUpperCase(); timerState(n);
    const setIn = h('input', { class: 'in', placeholder: 'm:ss', value: t.start });
    const C = mk(() => { save(); });
    list.append(h('div', { class: 'timer' },
      h('div', {}, h('b', {}, n), h('span', { class: 'sub2' }, t.dir === 'up' ? 'counts up' : 'counts down')),
      h('div', { class: 'disp', 'data-t': n }),
      h('div', { class: 'ctl' },
        h('button', { class: 'tbtn take', onclick: () => { timerCmd(n, 'TOGGLE'); paintTimers(); } }, 'Start / Stop'),
        h('button', { class: 'tbtn', onclick: () => { timerCmd(n, 'RESET'); paintTimers(); } }, 'Reset'),
        setIn, h('button', { class: 'mini', onclick: () => { timerCmd(n, 'SET', setIn.value); paintTimers(); } }, 'Set'),
        h('button', { class: 'mini', onclick: () => { timerCmd(n, 'ADD', '1'); paintTimers(); } }, '+1s'), h('button', { class: 'mini', onclick: () => { timerCmd(n, 'SUB', '1'); paintTimers(); } }, '−1s'),
        C.sel([['down', 'Down'], ['up', 'Up']], t.dir, v => { t.dir = v; timerCmd(n, 'DIR', v); renderTimers(); }),
        h('label', { class: 'tl', title: 'Reset value' }, 'Reset to', (() => { const e = C.txt(t.start, v => { t.start = v; }); e.style.width = '70px'; return e; })()),
        h('button', { class: 'mini danger', onclick: () => { snapshot(); P.timers = P.timers.filter(x => x !== t); delete ui.timerState[n]; save(); renderTimers(); } }, 'Delete'))));
  }
  const nameIn = h('input', { class: 'in', placeholder: 'NAME, e.g. PLAY', style: 'width:160px' });
  root.replaceChildren(list, h('div', { class: 'krow', style: 'margin-top:10px' }, nameIn, h('button', { class: 'tbtn', onclick: () => {
    const n = nameIn.value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (!n) return toast('Give the timer a name (letters and numbers).');
    if (P.timers.some(t => t.name.toUpperCase() === n)) return toast('A timer called ' + n + ' already exists.');
    snapshot(); P.timers.push({ name: n, dir: 'down', start: '5:00' }); save(); renderTimers();
  } }, '+ Add timer')),
  h('p', { class: 'note', style: 'margin-top:10px' }, 'Show a timer with a Clock object set to "Countdown / game clock". RossTalk: ', h('code', {}, 'TIMER GAME:START'), ' ', h('code', {}, 'TIMER GAME:STOP'), ' ', h('code', {}, 'TIMER GAME:RESET'), ' ', h('code', {}, 'TIMER GAME:SET:12:00'), ' ', h('code', {}, 'TIMER GAME:ADD:10'), '. HTTP: ', h('code', {}, '/api/timer/GAME/start'), '.'));
  paintTimers();
}

/* ======================= Output & Control modal ======================= */
async function openOutputModal(focus) {
  const root = h('div', { class: 'cols2' });
  modal('Output & Control', root, [['Close', () => { clearInterval(ui.outPoll); }]], 'wide');
  const left = h('div'), right = h('div'); root.append(left, right);
  const C = mk(() => saveSettings());
  // NDI
  const ndiStat = h('div', { class: 'stat' });
  const g1 = h('div', { class: 'fgrid', style: 'grid-template-columns:120px minmax(0,1fr)' });
  const F1 = (l, c) => g1.append(h('span', { class: 'fl' }, l), c);
  F1('Channel 1 name', C.txt(S.ndiName, v => { S.ndiName = v; }));
  F1('Channel 2', h('span', { class: 'krow' }, C.chk('Send', S.ndiCh2, v => { S.ndiCh2 = v; }), C.txt(S.ndiName2, v => { S.ndiName2 = v; })));
  F1('Key output', h('span', { class: 'chkrow' }, C.chk('Also send a separate key source per channel', S.ndiKey, v => { S.ndiKey = v; })));
  F1('Frame rate', C.sel(['23.98', '24', '25', '29.97', '30', '50', '59.94', '60'], S.ndiFps, v => { S.ndiFps = v; }));
  F1('Alpha', h('span', { class: 'chkrow' }, C.chk('Straight alpha (clean key edges)', S.ndiUnpremul, v => { S.ndiUnpremul = v; })));
  F1('Start on launch', h('span', { class: 'chkrow' }, C.chk('Start NDI when Keyline opens', S.ndiAuto, v => { S.ndiAuto = v; })));
  const lib = C.txt(S.ndiLib, v => { S.ndiLib = v; }); lib.placeholder = 'automatic';
  F1('NDI library', lib);
  g1.append(h('div', { class: 'btnrow' }, h('button', { class: 'tbtn on', onclick: async () => { await startNdi(); poll(); } }, 'Start / restart NDI'), h('button', { class: 'tbtn', onclick: async () => { await stopNdi(); poll(); } }, 'Stop NDI')));
  g1.append(h('div', { style: 'grid-column:1/-1' }, ndiStat));
  left.append(h('fieldset', {}, h('legend', {}, 'NDI output'), h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Sends each channel as a 1920×1080 NDI source with alpha. "Key" adds a second source carrying the alpha as a white-on-black picture, for NDI-to-SDI converters that output fill and key on two SDI ports. Needs the free NDI Tools from ndi.video.'), g1));
  // fullscreen
  const disp = h('select', { class: 'in' }), scCh = h('select', { class: 'in', style: 'width:110px' }, h('option', { value: '1' }, 'Channel 1'), h('option', { value: '2' }, 'Channel 2')), scMode = h('select', { class: 'in', style: 'width:90px' }, h('option', { value: 'fill' }, 'Fill'), h('option', { value: 'key' }, 'Key'));
  if (api) (await api.listDisplays()).forEach(d => disp.append(h('option', { value: d.id }, d.label)));
  left.append(h('fieldset', {}, h('legend', {}, 'Fullscreen output'), h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Shows a channel full screen on another display. Use two displays (Fill + Key) into HDMI-to-SDI converters for a fill/key pair. Press Esc on that screen to close it.'),
    h('div', { class: 'krow' }, disp, scCh, scMode, h('button', { class: 'tbtn', onclick: () => api ? api.openScreen(+disp.value, +scCh.value, scMode.value).then(() => toast('Fullscreen output opened')) : toast('Needs the desktop app') }, 'Open'), h('button', { class: 'tbtn', onclick: () => api && api.closeScreen() }, 'Close'))));
  // control
  const ctlStat = h('div', { class: 'stat' });
  const g2 = h('div', { class: 'fgrid', style: 'grid-template-columns:120px minmax(0,1fr)' });
  const F2 = (l, c) => g2.append(h('span', { class: 'fl' }, l), c);
  F2('Remote control', h('span', { class: 'chkrow' }, C.chk('Listen for RossTalk and HTTP', S.ctlEnabled, v => { S.ctlEnabled = v; })));
  F2('Accept from', C.sel([['all', 'Any computer on the network'], ['local', 'This computer only']], S.ctlBind, v => { S.ctlBind = v; }));
  const allow = C.txt(S.ctlAllow, v => { S.ctlAllow = v; }); allow.placeholder = 'optional, e.g. 10.0.0.25, 10.0.1.*';
  F2('Allowed IPs', allow);
  F2('RossTalk TCP port', C.num(S.rosstalkPort, v => { S.rosstalkPort = v; }, { min: 1, max: 65535 }));
  F2('HTTP port', C.num(S.httpPort, v => { S.httpPort = v; }, { min: 1, max: 65535 }));
  g2.append(h('div', { class: 'btnrow' }, h('button', { class: 'tbtn on', onclick: async () => { await applyControl(); paintCtl(); } }, 'Apply')));
  g2.append(h('div', { style: 'grid-column:1/-1' }, ctlStat));
  const log = h('div', { class: 'log', id: 'ctlLog' }, ui.ctlLog.join('\n') || 'No commands received yet.');
  right.append(h('fieldset', { id: 'fsControl' }, h('legend', {}, 'RossTalk & HTTP control'), g2,
    h('p', { class: 'note', style: 'margin:8px 0 4px' }, 'RossTalk commands (TCP, one per line): ', ...['SEQI 1001', 'SEQO 1001', 'CLFB 1:20', 'CLFB 2', 'CLRA', 'READ 1001', 'NEXT', 'UP', 'DOWN', 'RESUME 1:20', 'SETDATA 1001:LINE 1:New text', 'TIMER GAME:START', 'TIMER GAME:SET:12:00'].flatMap(c => [h('code', {}, c), ' '])),
    h('p', { class: 'note', style: 'margin:4px 0' }, 'HTTP: ', ...['/api/take/1001', '/api/takeout/1001', '/api/clear/20', '/api/clearall', '/api/next', '/api/takes', '/api/set/1001?LINE%201=Text', '/api/rosstalk?cmd=CLRA'].flatMap(c => [h('code', {}, c), ' ']), ' Open the HTTP port in a browser for a touch remote.'),
    log));
  // DashBoard
  const hostIn = C.txt(S.dashHost, v => { S.dashHost = v; });
  right.append(h('fieldset', { id: 'fsDash' }, h('legend', {}, 'Ross DashBoard panel'),
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Exports a DashBoard CustomPanel (.grid) with TAKE NEXT, CLEAR, per-layer clear and a button for every take in this rundown. Each button sends RossTalk to Keyline. Set the address of this computer as DashBoard will see it.'),
    h('div', { class: 'krow' }, h('span', { class: 'tl' }, 'Keyline address'), hostIn, h('button', { class: 'tbtn on', onclick: async () => {
      const xml = dashboardXML(S.dashHost || '127.0.0.1', +S.rosstalkPort || 7788);
      if (api) { const p = await api.saveText(xml, `Keyline - ${P.name}.grid`, [{ name: 'DashBoard CustomPanel', extensions: ['grid'] }]); if (p) toast('Saved ' + p); }
      else modal('DashBoard panel', h('textarea', { class: 'in big', value: xml }), [['Close']]);
    } }, 'Export .grid…'))));
  const paintCtl = () => { const st = ui.ctlStatus; if (!api) { ctlStat.textContent = 'Remote control needs the desktop app.'; return; } if (!st) { ctlStat.textContent = '—'; return; } ctlStat.className = 'stat ' + (st.errors.length ? 'bad' : st.enabled ? 'ok' : ''); ctlStat.textContent = !st.enabled ? 'Off' : `RossTalk listening on TCP ${st.rosstalk || '—'}\nHTTP listening on ${st.http ? 'http://<this-computer>:' + st.http + '/' : '—'}\nAccepting: ${st.bind === 'local' ? 'this computer only' : st.allow ? 'this computer + ' + st.allow : 'any computer on the network'}` + (st.errors.length ? '\n' + st.errors.join('\n') : ''); };
  const poll = async () => {
    if (!api) { ndiStat.textContent = 'NDI needs the desktop app.'; return; }
    const list = await api.ndiStatus();
    ndiStat.className = 'stat ' + (list.length ? 'ok' : ui.ndi.error ? 'bad' : '');
    ndiStat.textContent = list.length ? list.map(st => `CH${st.ch} ${st.mode.toUpperCase()}  "${st.name}" · ${st.fps} fps · ${st.size || 'waiting for first frame'} · ${st.frames} frames · ${st.connections} receiver${st.connections === 1 ? '' : 's'}`).join('\n') + (ui.ndi.lib ? `\nRuntime: ${ui.ndi.lib}` : '') : (ui.ndi.error ? 'Stopped: ' + ui.ndi.error : 'Stopped');
  };
  paintCtl(); poll();
  clearInterval(ui.outPoll); ui.outPoll = setInterval(() => { if ($('#modal').hidden) clearInterval(ui.outPoll); else poll(); }, 1000);
  const target = focus === 'dash' ? $('#fsDash') : focus === 'control' ? $('#fsControl') : null;
  if (target) target.scrollIntoView();
}

/* ======================= menus ======================= */
const MENUS = {
  File: [['New Project', MOD + '+N', 'newProject'], ['Open…', MOD + '+O', 'open'], ['Save', MOD + '+S', 'save'], ['Save As…', '', 'saveAs'], 0, ['New Scene', '', 'newScene'], ['Duplicate Scene', '', 'dupScene'], ['Delete Scene…', '', 'delScene'], 0, ['Import vMix GT Title…', '', 'importGT'], ['Import Font…', '', 'importFont'], ['Export DashBoard Panel…', '', 'exportDashboard'], 0, ['Load Sample Project…', '', 'reset']],
  Edit: [['Undo', MOD + '+Z', 'smartUndo'], ['Redo', isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', 'smartRedo'], 0, ['Duplicate Object', MOD + '+D', 'objDup'], ['Delete Object', 'Del', 'objDel'], ['Bring Forward', '', 'objUp'], ['Send Backward', '', 'objDown']],
  Animation: [['Play / Stop', 'Space', 'tlPlay'], ['Play In', '', 'tlPlayIn'], ['Play Out', '', 'tlPlayOut'], 0, ['Toggle Auto-key', 'A', 'tlAuto'], ['Key Selected Object', 'K', 'tlKey'], ['Delete Selected Keys', 'Del', 'tlDelKeys'], 0, ['Set Pause Point Here', '', 'tlSetPause'], ['Set End Here', '', 'tlSetEnd']],
  View: [['Layout Mode', 'F3', () => setMode('layout')], ['Sequence Mode', 'F4', () => setMode('seq')], 0, ['Toggle Safe Areas', '', 'toggleSafe'], ['Toggle Camera Plate', '', 'togglePlate']],
  Sequence: [['Take Selected', 'Space', 'take'], ['Clear Selected Layer', '', 'clearSel'], ['Clear All Layers', 'Esc', 'clearAll'], ['Clear Channel 1', '', () => clearAll(1)], ['Clear Channel 2', '', () => clearAll(2)], 0, ['Add Take From Current Scene', '', 'addTakeCur'], ['Duplicate Take', '', 'takeDup'], ['Delete Take', '', 'takeDel']],
  Data: [['DataLinq Sources…', '', 'dataLinq'], ['Clocks & Timers…', '', 'timers'], ['Refresh All Sources', '', () => { P.dataSources.forEach(fetchSource); toast('Refreshing all sources'); }]],
  Output: [['Start / Stop NDI', '', 'toggleNdi'], ['Output & Control Settings…', '', 'outputSettings'], ['Export DashBoard Panel…', '', 'exportDashboard']],
  Help: [['Keyboard Shortcuts', '', 'help'], ['RossTalk & HTTP Reference', '', 'controlRef'], ['About', '', 'about']]
};
let openMenu = null;
function showMenu(name, btn) {
  const pop = $('#menuPop');
  $$('.mb').forEach(b => b.classList.toggle('open', b === btn)); openMenu = name;
  pop.replaceChildren(...MENUS[name].map(it => it ? h('button', { class: 'mi', onclick: () => { closeMenu(); typeof it[2] === 'function' ? it[2]() : act[it[2]](); } }, h('span', {}, it[0]), h('span', { class: 'k' }, it[1])) : h('div', { class: 'msep' })));
  const r = btn.getBoundingClientRect(); pop.hidden = false;
  pop.style.left = Math.min(r.left, innerWidth - pop.offsetWidth - 8) + 'px'; pop.style.top = r.bottom + 'px';
}
function closeMenu() { openMenu = null; $('#menuPop').hidden = true; $$('.mb').forEach(b => b.classList.remove('open')); }
$('#menubar').append(...Object.keys(MENUS).map(n => h('button', { class: 'mb', onclick: e => { e.stopPropagation(); openMenu === n ? closeMenu() : showMenu(n, e.currentTarget); }, onmouseenter: e => { if (openMenu && openMenu !== n) showMenu(n, e.currentTarget); } }, n)));
document.addEventListener('pointerdown', e => { if (openMenu && !e.target.closest('#menuPop,.mb')) closeMenu(); });

/* ======================= modal + toast ======================= */
function modal(title, body, buttons, size) {
  const m = $('#modal');
  m.replaceChildren(h('div', { class: 'dlg' + (size ? ' ' + size : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'ph' }, title), h('div', { class: 'bd' }, body),
    h('div', { class: 'ft' }, ...buttons.map(([l, fn, pri]) => h('button', { class: 'tbtn' + (pri ? ' on' : ''), onclick: () => { if (fn && fn() === false) return; closeModal(); } }, l)))));
  m.hidden = false;
  const f = m.querySelector('.ft .tbtn:last-child'); if (f && !size) f.focus();
}
function closeModal() { $('#modal').hidden = true; ui.dlOpen = null; clearInterval(ui.outPoll); }
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
let toastT = 0;
function toast(msg) { const s = $('#stMsg'); s.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => { s.textContent = 'Ready'; }, 4000); }

/* ======================= mode + global ======================= */
function syncToggles() { $('#mLayout').classList.toggle('on', ui.mode === 'layout'); $('#mSeq').classList.toggle('on', ui.mode === 'seq'); $('#bSafe').classList.toggle('on', ui.safe); $('#bPlate').classList.toggle('on', ui.plate); renderNdi(); }
function setMode(m) {
  if (m !== ui.mode) stopTl();
  ui.mode = m; $('#layoutMode').hidden = m !== 'layout'; $('#seqMode').hidden = m !== 'seq';
  lsSet(KEY + '-mode', m);
  renderAll();
  requestAnimationFrame(() => { $$('.mon').forEach(fitMon); remeasureAll(); });
}
$('#mLayout').onclick = () => setMode('layout');
$('#mSeq').onclick = () => setMode('seq');
function renderAll() {
  renderCats(); renderSceneLists();
  if (ui.mode === 'layout') renderLayoutSide();
  else { renderRundown(); renderTakeInsp(); renderPreview(); }
  renderOnAir(); syncToggles(); updateTitle(); renderDlStatus();
}
function remeasureAll() { if (vpPlayer) vpPlayer.remeasure(); if (pvwPlayer) pvwPlayer.remeasure(); programs[1].remeasure(); programs[2].remeasure(); }
$('#takeEntry').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const v = parseInt(e.target.value, 10), t = P.takes.find(x => x.num === v);
  if (!t) return toast(`No take with ID ${e.target.value}`);
  if (ui.mode !== 'seq') setMode('seq');
  selectTake(t.id); if (e.shiftKey) doTake(t); e.target.select();
});
let nudgeT = 0;
document.addEventListener('keydown', e => {
  if (e.key === 'F3') { e.preventDefault(); setMode('layout'); return; }
  if (e.key === 'F4') { e.preventDefault(); setMode('seq'); return; }
  if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (openMenu && e.key === 'Escape') { closeMenu(); return; }
  const k = e.key.toLowerCase();
  // in the desktop app the native menu owns Ctrl/Cmd + S, O, N, Z, Y (one handler, same on Windows and macOS)
  if (!api && (e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
  if (!api && (e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); act.open(); return; }
  if (!api && (e.ctrlKey || e.metaKey) && k === 'n') { e.preventDefault(); act.newProject(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !(e.target.type === 'checkbox' || e.target.type === 'range');
  if (typing) return;
  if (e.ctrlKey || e.metaKey) {
    if (!api && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (!api && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (k === 'd' && ui.mode === 'layout') { e.preventDefault(); act.objDup(); }
    return;
  }
  if (ui.mode === 'layout') {
    const o = selObj();
    if (e.key === ' ') { e.preventDefault(); playTl(); }
    else if (e.key === ',' || e.key === '<') { e.preventDefault(); stopTl(); setFrame(ui.frame - (e.shiftKey ? 10 : 1)); }
    else if (e.key === '.' || e.key === '>') { e.preventDefault(); stopTl(); setFrame(ui.frame + (e.shiftKey ? 10 : 1)); }
    else if (e.key === 'Home') { e.preventDefault(); act.tlHome(); }
    else if (e.key === 'End') { e.preventDefault(); act.tlEnd(); }
    else if (k === 'k') { e.preventDefault(); keySelected(); }
    else if (k === 'a') { e.preventDefault(); act.tlAuto(); }
    else if (o && e.key.startsWith('Arrow')) {
      e.preventDefault(); if (!e.repeat) snapshot();
      const s = e.shiftKey ? 10 : 1, f = ui.frame;
      if (e.key === 'ArrowLeft') setProp(o, 'x', KL.valueAt(o, 'x', f) - s);
      if (e.key === 'ArrowRight') setProp(o, 'x', KL.valueAt(o, 'x', f) + s);
      if (e.key === 'ArrowUp') setProp(o, 'y', KL.valueAt(o, 'y', f) - s);
      if (e.key === 'ArrowDown') setProp(o, 'y', KL.valueAt(o, 'y', f) + s);
      const el = $(`#vpStage .go[data-id="${o.id}"]`); if (el) KL.applyFrame(el, o, f); renderSel();
      clearTimeout(nudgeT); nudgeT = setTimeout(() => { renderInspector(); sceneChanged(); }, 250);
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (ui.focusArea === 'tl' && ui.selKeys.length) deleteSelectedKeys(); else if (o) act.objDel(); }
    else if (e.key === 'Escape') { ui.selObj = null; ui.selKeys = []; renderSel(); renderInspector(); renderTimeline(); }
  } else {
    if (e.key === ' ') { e.preventDefault(); act.take(); }
    else if (e.key === 'Escape') clearAll();
    else if (e.key === '1' || e.key === '2') showPgmCh(+e.key);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const i = P.takes.findIndex(t => t.id === ui.selTake), j = Math.max(0, Math.min(P.takes.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); if (P.takes[j]) selectTake(P.takes[j].id); }
  }
});

/* library + swatches */
$('#lib').append(...[['text', 'Text', 'linear-gradient(#3f6fd1,#2a52a8)'], ['rect', 'Quad', '#c0392b'], ['grad', 'Gradient', 'linear-gradient(135deg,#1b6fa8,#0b2f52)'], ['image', 'Image', 'linear-gradient(#1f9a6e,#15674a)'], ['clock', 'Clock', 'linear-gradient(#c07a12,#8a5408)'], ['text3d', '3D Text', 'linear-gradient(135deg,#f2c200,#7a4d00)'], ['ticker', 'Ticker', 'repeating-linear-gradient(90deg,#0e7c86 0 6px,#0a5a61 6px 9px)'], ['video', 'Video', 'linear-gradient(#7b4fd0,#4d2c91)']]
  .map(([t, l, bg]) => h('button', { class: 'libb', onclick: () => t === 'grad' ? addObject('rect', true) : addObject(t) }, h('i', { style: 'background:' + bg }), l)));
function renderMaterials() {
  const all = [...MATERIALS, ...(P.materials || []).map(m => [m.name, m.color, true])];
  $('#swatches').replaceChildren(...all.map(([n, c, custom]) => h('button', { title: `${n} ${c} · click: fill/color · Shift-click: gradient end` + (custom ? ' · Alt-click: remove' : ''), 'aria-label': n, style: 'background:' + c, onclick: e => {
    if (custom && e.altKey) { snapshot(); P.materials = P.materials.filter(m => m.color !== c); save(); renderMaterials(); return; }
    applyMaterial(c, e.shiftKey); } })),
    h('button', { title: 'Save the selected object\'s color as a material', style: 'background:#fff;font-weight:700', onclick: () => {
      const o = selObj(); if (!o) return toast('Select an object to take its color from.');
      const c = o.type === 'rect' ? o.p.fill : o.p.color; if (!c) return;
      snapshot(); P.materials.push({ name: 'Custom ' + (P.materials.length + 1), color: c }); save(); renderMaterials(); toast('Saved material ' + c);
    } }, '+'));
  const box = $('#styleList');
  const STYLE_SKIP = new Set(['text', 'src', 'items', 'format', 'mode', 'timer']);
  box.replaceChildren(...(P.styles || []).map(st => h('span', { class: 'stylechip', title: `Apply "${st.name}" to the selected ${st.kind === 'rect' ? 'quad' : 'text-type'} object`, onclick: () => {
      const o = selObj(); if (!o) return toast('Select an object, then click a style.');
      const kind = o.type === 'rect' ? 'rect' : ['text', 'clock', 'ticker', 'text3d'].includes(o.type) ? 'text' : o.type;
      if (kind !== st.kind && !(st.kind === 'any')) return toast(`"${st.name}" is a ${st.kind} style.`);
      snapshot(); for (const [k, v] of Object.entries(st.p)) if (!STYLE_SKIP.has(k) && (k in KL.DEF[o.type] || /^shadow/.test(k))) o.p[k] = v; sceneChanged(); renderInspector(); toast(`Applied style ${st.name}`);
    } }, h('i', { style: 'background:' + (st.p.fill || st.p.color || '#888') }), st.name, h('button', { title: 'Delete style', onclick: e => { e.stopPropagation(); snapshot(); P.styles = P.styles.filter(x => x !== st); save(); renderMaterials(); } }, '×'))),
    h('button', { class: 'mini', onclick: () => {
      const o = selObj(); if (!o) return toast('Select an object whose look you want to save.');
      const kind = o.type === 'rect' ? 'rect' : ['text', 'clock', 'ticker', 'text3d'].includes(o.type) ? 'text' : o.type;
      const p = {}; for (const [k, v] of Object.entries(o.p)) if (!STYLE_SKIP.has(k)) p[k] = v;
      snapshot(); P.styles.push({ id: uid(), name: `${o.name} style`, kind, p }); save(); renderMaterials(); toast('Saved style from ' + o.name);
    } }, '+ Save style'));
}
renderMaterials();

/* status clock + fps */
let frames = 0, last = performance.now();
setInterval(() => { $('#stClock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, 500);
(function loop(t) { frames++; if (t - last >= 1000) { $('#stFps').textContent = Math.round(frames * 1000 / (t - last)) + ' fps'; frames = 0; last = t; } requestAnimationFrame(loop); })(performance.now());
if (document.fonts) { document.fonts.ready.then(remeasureAll); document.fonts.addEventListener('loadingdone', () => { remeasureAll(); scheduleThumbs(); }); }

/* desktop wiring */
if (api) {
  api.onControl(handleControl);
  api.onControlLog(() => {});
  api.onBeforeClose(() => { if (!ui.dirty) return api.closeNow(); modal('Quit Keyline CG Studio', h('p', {}, `Save changes to "${P.name}" before quitting?`), [['Cancel'], ['Quit without saving', () => api.closeNow()], ['Save and quit', () => { saveProject(false).then(ok => { if (ok !== false) api.closeNow(); }); }, true]]); });
  applyControl();
  if (S.ndiAuto) startNdi();
}

/* boot */
initTimers(); KL.setFonts(P.fonts);
ui.frame = curScene() ? KL.tlOf(curScene()).pause : 0;
ui.dirty = false;
setMode(lsGet(KEY + '-mode') === 'seq' ? 'seq' : 'layout');
scheduleSources();
updateTitle();
if (api) {
  externalizeMedia();
  // localStorage can be cleared or full; the file autosave is the crash-recovery copy
  if (!lsGet(KEY)) api.loadAutosave().then(t => { try { const p = t && JSON.parse(t); if (p && p.scenes && p.takes) { loadProject(p, null); ui.dirty = true; updateTitle(); toast('Recovered your last autosaved project'); } } catch (e) { /* no autosave */ } });
}
window.__kl = { get P() { return P; }, ui, program, programs, timerCmd, handleControl, act, setFrame, DL, fetchSource, dashboardXML, setProp, sceneChanged, contentOf, loadProject };
})();
