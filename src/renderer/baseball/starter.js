/* Starter baseball graphics: ordinary Keyline scenes whose fields are linked to the
   live Baseball data source. Everything here can be redesigned in Layout mode. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fields.js'));
  else root.BBStarter = factory(root.BBFields);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';
  const PANEL = '#0d1520', STRIP = '#1b2430', ACC = '#f3b61f', DIM = '#b4bfcc';
  const FONT = 'Barlow Condensed';

  /* O: the editor's object factory, O(type, name, x, y, w, h, props, extra) */
  function build(O) {
    const scenes = [], links = {};
    const A = (i, d, dur) => ({ published: true, anim: { in: i, delay: d || 0, dur: dur || 450 } });
    const R = (name, x, y, w, h, fill, extra, p) => O('rect', name, x, y, w, h, Object.assign({ fill }, p || {}), extra || A('wipe', 0, 450));
    const T = (name, x, y, w, h, text, p, extra) => O('text', name, x, y, w, h, Object.assign({ text, font: FONT, size: 30, weight: 700, color: '#ffffff' }, p || {}), extra || A('fade', 150, 350));
    const BLANK = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>");
    // images get a real default picture so the scene looks right in Layout mode and in thumbnails
    const I = (name, x, y, w, h, src, extra) => O('image', name, x, y, w, h, { src: src || BLANK, fit: 'contain' }, extra || A('fade', 150, 350));
    const scene = (name, category, layer, objects, map) => {
      const sc = { name, category, layer, objects };
      scenes.push(sc); links[name] = map; return sc;
    };

    /* ---- scorebug ---- */
    {
      const o = [], m = {};
      o.push(R('BUG PANEL', 60, 44, 496, 92, PANEL, A('wipe', 0, 450), { radius: 6, shadowOn: true, shadowOpacity: 45, shadowBlur: 18, shadowDist: 6 }));
      for (const [k, y] of [['away', 44], ['home', 90]]) {
        const K = k.toUpperCase();
        o.push(R(`${K} BAR`, 60, y, 232, 46, k === 'away' ? '#0e3b6e' : '#b8461b', A('wipe', 60, 450))); m[`${K} BAR`] = k + '.color';
        o.push(R(`${K} CHIP`, 72, y + 7, 10, 32, '#f3b61f', A('fade', 200, 300))); m[`${K} CHIP`] = k + '.color2';
        o.push(T(`${K} ABBR`, 94, y, 110, 46, K.slice(0, 3), { size: 32 })); m[`${K} ABBR`] = k + '.abbr';
        o.push(T(`${K} AT BAT`, 204, y, 22, 46, '◀', { size: 16, align: 'center' })); m[`${K} AT BAT`] = { f: k + '.batting', use: 'show' };
        o.push(R(`${K} SCORE BOX`, 228, y, 64, 46, 'rgba(0,0,0,0.45)', A('wipe', 80, 450)));
        o.push(T(`${K} SCORE`, 228, y, 64, 46, '0', { size: 40, weight: 800, align: 'center' })); m[`${K} SCORE`] = k + '.runs';
      }
      o.push(T('INNING', 294, 48, 90, 44, '▲ 1', { size: 30, align: 'center' })); m.INNING = 'inning.label';
      o.push(I('OUTS', 304, 98, 70, 22, F.outsImg(1, ACC))); m.OUTS = 'outs.img';
      o.push(I('BASES', 388, 55, 84, 68, F.basesImg([true, false, true], ACC))); m.BASES = 'bases.img';
      o.push(T('COUNT', 474, 48, 80, 50, '0-0', { size: 38, weight: 800, align: 'center' })); m.COUNT = 'count';
      o.push(T('PITCH COUNT', 474, 96, 80, 32, 'P: 0', { size: 19, weight: 600, color: DIM, align: 'center' })); m['PITCH COUNT'] = 'pit.pc';
      scene('BB SCOREBUG', 'BUG', 30, o, m);
    }

    /* ---- batter / pitcher lower thirds ---- */
    for (const who of ['bat', 'pit']) {
      const o = [], m = {}, W = who.toUpperCase();
      o.push(R('BADGE', 150, 852, 132, 136, '#0e3b6e', A('wipe', 0, 500))); m.BADGE = who + '.color';
      o.push(R('BADGE STRIPE', 150, 980, 132, 8, ACC, A('wipe', 100, 400))); m['BADGE STRIPE'] = who + '.color2';
      o.push(T('NUMBER', 150, 860, 132, 82, '#24', { size: 70, weight: 800, align: 'center' })); m.NUMBER = { f: who + '.num', fmt: { prefix: '#' } };
      o.push(T('TEAM', 150, 938, 132, 34, 'HCG', { size: 22, align: 'center', tracking: 1 })); m.TEAM = who + '.abbr';
      o.push(R('NAME PANEL', 282, 852, 860, 82, PANEL, A('wipe', 80, 500)));
      o.push(T('NAME', 310, 852, 560, 82, 'PLAYER NAME', { size: 56, weight: 800, upper: true }, A('slide-r', 250, 400))); m.NAME = who + '.name';
      o.push(T('TAG', 860, 852, 260, 82, 'POS', { size: 26, weight: 600, color: DIM, align: 'right', upper: true }, A('fade', 350, 350))); m.TAG = who + '.tag';
      o.push(R('STAT STRIP', 282, 934, 860, 54, STRIP, A('wipe', 160, 500)));
      o.push(R('TODAY BOX', 282, 934, 340, 54, '#0e3b6e', A('wipe', 200, 450))); m['TODAY BOX'] = who + '.color';
      o.push(T('TODAY', 298, 934, 316, 54, "Today's line", { size: 27 }, A('fade', 400, 350))); m.TODAY = { f: who + '.today', fmt: { prefix: 'TODAY  ' } };
      o.push(T('SEASON', 644, 934, 480, 54, 'Season stats', { size: 28 }, A('fade', 450, 350))); m.SEASON = who === 'bat' ? 'bat.stats' : 'pit.season';
      scene(`BB ${W === 'BAT' ? 'BATTER' : 'PITCHER'} L3`, 'L3', 20, o, m);
    }

    /* ---- due up ---- */
    {
      const o = [], m = {};
      o.push(R('HEADER', 150, 868, 200, 120, '#b8461b', A('wipe', 0, 450))); m.HEADER = 'due.color';
      o.push(R('HEADER STRIPE', 342, 868, 8, 120, ACC, A('wipe', 80, 400))); m['HEADER STRIPE'] = 'due.color2';
      o.push(T('DUE UP LABEL', 172, 880, 170, 34, 'DUE UP', { size: 24, tracking: 2 }));
      o.push(T('DUE TEAM', 172, 912, 166, 60, 'TEAM', { size: 44, weight: 800, upper: true })); m['DUE TEAM'] = 'due.team';
      o.push(R('LIST PANEL', 350, 868, 990, 120, PANEL, A('wipe', 60, 500)));
      for (let i = 1; i <= 3; i++) {
        const x = 350 + (i - 1) * 330 + 22;
        o.push(T(`ORDER ${i}`, x, 880, 290, 28, '1ST · CF', { size: 22, color: ACC, tracking: 1 }, A('fade', 250 + i * 80, 300))); m[`ORDER ${i}`] = `due${i}.order`;
        o.push(T(`NAME ${i}`, x, 906, 290, 46, 'NAME', { size: 36, weight: 800, upper: true }, A('fade', 280 + i * 80, 300))); m[`NAME ${i}`] = `due${i}.last`;
        o.push(T(`LINE ${i}`, x, 950, 290, 28, 'line', { size: 22, weight: 600, color: DIM }, A('fade', 300 + i * 80, 300))); m[`LINE ${i}`] = `due${i}.line`;
      }
      scene('BB DUE UP', 'L3', 20, o, m);
    }

    /* ---- linescore ---- */
    {
      const o = [], m = {}, x0 = 585, top = 872, cw = 50, rw = 62;
      o.push(R('PANEL', 560, top, 800, 116, PANEL, A('wipe', 0, 500), { radius: 6 }));
      o.push(R('HEADER ROW', 560, top, 800, 32, STRIP, A('wipe', 40, 500)));
      const cols = x0 + 120;
      for (let i = 1; i <= 9; i++) o.push(T(`H${i}`, cols + (i - 1) * cw, top, cw, 32, String(i), { size: 20, color: DIM, align: 'center' }));
      ['R', 'H', 'E'].forEach((l, j) => o.push(T(`H ${l}`, cols + 9 * cw + j * rw, top, rw, 32, l, { size: 20, color: DIM, align: 'center' })));
      for (const [k, y] of [['away', top + 34], ['home', top + 76]]) {
        const K = k.toUpperCase();
        o.push(R(`${K} CHIP`, 560, y, 12, 40, '#0e3b6e', A('wipe', 120, 400))); m[`${K} CHIP`] = k + '.color';
        o.push(T(`${K} NAME`, x0, y, 116, 40, K, { size: 30 })); m[`${K} NAME`] = k + '.abbr';
        for (let i = 1; i <= 9; i++) { o.push(T(`${K} ${i}`, cols + (i - 1) * cw, y, cw, 40, '', { size: 30, align: 'center' })); m[`${K} ${i}`] = `${k}.inn${i}`; }
        [['R', 'runs', ACC], ['H', 'hits'], ['E', 'errors']].forEach(([l, f, c], j) => { o.push(T(`${K} ${l}`, cols + 9 * cw + j * rw, y, rw, 40, '0', { size: 32, weight: 800, align: 'center', color: c || '#ffffff' })); m[`${K} ${l}`] = `${k}.${f}`; });
      }
      scene('BB LINESCORE', 'L3', 20, o, m);
    }

    /* ---- pitch speed flash under the bug ---- */
    {
      const o = [], m = {};
      o.push(R('TAG BOX', 60, 144, 96, 52, ACC, A('wipe', 0, 350), { radius: 4 }));
      o.push(T('TAG', 60, 144, 96, 52, 'PITCH', { size: 24, weight: 800, color: '#000000', align: 'center' }, A('fade', 120, 250)));
      o.push(R('PANEL', 156, 144, 260, 52, PANEL, A('wipe', 60, 350)));
      o.push(T('MPH', 172, 144, 120, 52, '97 MPH', { size: 34, weight: 800 }, A('fade', 200, 250))); m.MPH = { f: 'pitch.mph', fmt: { suffix: ' MPH' } };
      o.push(T('TYPE', 292, 144, 116, 52, 'SLIDER', { size: 22, weight: 600, color: DIM, align: 'right' }, A('fade', 240, 250))); m.TYPE = 'pitch.type';
      scene('BB PITCH SPEED', 'BUG', 31, o, m);
    }

    /* ---- starting lineup (one scene, a take per team) ---- */
    {
      const o = [], m = { away: {}, home: {} };
      const set = (name, f) => { m.away[name] = f('away'); m.home[name] = f('home'); };
      o.push(R('CARD', 420, 140, 1080, 800, PANEL, A('fade', 0, 450), { radius: 8, shadowOn: true, shadowOpacity: 55, shadowBlur: 40, shadowDist: 12 }));
      o.push(R('HEADER', 420, 140, 1080, 128, '#0e3b6e', A('wipe', 80, 500))); set('HEADER', k => k + '.color');
      o.push(R('HEADER STRIPE', 420, 260, 1080, 8, ACC, A('wipe', 160, 450))); set('HEADER STRIPE', k => k + '.color2');
      o.push(I('LOGO', 452, 158, 92, 92)); set('LOGO', k => k + '.logo');
      o.push(T('LABEL', 560, 158, 600, 36, 'STARTING LINEUP', { size: 26, tracking: 3 }));
      o.push(T('TEAM', 560, 190, 760, 66, 'TEAM NAME', { size: 60, weight: 800, upper: true })); set('TEAM', k => k + '.full');
      o.push(T('RECORD', 1300, 158, 170, 92, '0-0', { size: 30, align: 'right' })); set('RECORD', k => k + '.record');
      for (let i = 1; i <= 9; i++) {
        const y = 280 + (i - 1) * 62;
        if (i % 2) o.push(R(`ROW ${i}`, 420, y, 1080, 62, 'rgba(255,255,255,0.04)', A('fade', 200 + i * 40, 300)));
        o.push(T(`NUM ${i}`, 456, y, 40, 62, String(i), { size: 34, weight: 800, color: ACC }, A('fade', 220 + i * 40, 300)));
        o.push(T(`PLAYER ${i}`, 510, y, 520, 62, 'PLAYER', { size: 34, upper: true }, A('slide-r', 230 + i * 40, 350))); set(`PLAYER ${i}`, k => `${k}.lu${i}.short`);
        o.push(T(`POS ${i}`, 1040, y, 80, 62, 'POS', { size: 32, color: DIM }, A('fade', 240 + i * 40, 300))); set(`POS ${i}`, k => `${k}.lu${i}.pos`);
        o.push(T(`STATS ${i}`, 1130, y, 340, 62, 'stats', { size: 28, weight: 600, color: DIM, align: 'right' }, A('fade', 250 + i * 40, 300))); set(`STATS ${i}`, k => `${k}.lu${i}.stats`);
      }
      o.push(T('SP LABEL', 456, 870, 50, 56, 'SP', { size: 30, weight: 800, color: ACC }));
      o.push(T('SP', 510, 870, 900, 56, 'Pitcher', { size: 30, upper: true })); set('SP', k => `${k}.pitcher`);
      scene('BB LINEUP', 'FS', 0, o, m);
    }

    /* Takes: [scene name, take name, link map, role] */
    const takes = [
      ['BB SCOREBUG', 'Baseball: SCOREBUG', links['BB SCOREBUG']],
      ['BB BATTER L3', 'Baseball: BATTER', links['BB BATTER L3'], 'batter'],
      ['BB PITCHER L3', 'Baseball: PITCHER', links['BB PITCHER L3']],
      ['BB DUE UP', 'Baseball: DUE UP', links['BB DUE UP']],
      ['BB LINESCORE', 'Baseball: LINESCORE', links['BB LINESCORE']],
      ['BB PITCH SPEED', 'Baseball: PITCH SPEED', links['BB PITCH SPEED'], 'pitch'],
      ['BB LINEUP', 'Baseball: AWAY LINEUP', links['BB LINEUP'].away],
      ['BB LINEUP', 'Baseball: HOME LINEUP', links['BB LINEUP'].home]
    ];
    return { scenes, takes };
  }

  /* take.data entry for one object: a link to a baseball field, with options */
  function dataFor(spec) {
    const s = typeof spec === 'string' ? { f: spec } : spec;
    return { link: Object.assign(F.link(s.f), { fmt: s.fmt || {}, rule: {}, use: s.use || '' }) };
  }

  return { build, dataFor };
});
