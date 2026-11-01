/* vMix title import (GT Title Designer .gtzip/.gtxml and legacy WPF .xaml titles).
   The parser is tolerant: it walks the XML, accumulates container offsets, and maps
   text / image / shape elements onto Keyline objects. Named fields become published fields. */
(function () {
  'use strict';
  const W = 1920, H = 1080;

  const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080', transparent: 'rgba(0,0,0,0)' };
  function color(v) {
    if (!v) return null;
    v = String(v).trim();
    if (/^#[0-9a-f]{8}$/i.test(v)) { // XAML #AARRGGBB
      const a = parseInt(v.slice(1, 3), 16) / 255;
      const r = parseInt(v.slice(3, 5), 16), g = parseInt(v.slice(5, 7), 16), b = parseInt(v.slice(7, 9), 16);
      return a >= 0.999 ? '#' + v.slice(3) : `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) return v;
    if (/^\d+\s*,\s*\d+\s*,\s*\d+/.test(v)) { const p = v.split(',').map(s => +s.trim()); return p.length > 3 ? `rgba(${p[0]},${p[1]},${p[2]},${(p[3] > 1 ? p[3] / 255 : p[3])})` : `rgb(${p[0]},${p[1]},${p[2]})`; }
    return NAMED[v.toLowerCase()] || null;
  }
  const num = v => { if (v == null || v === '' || v === 'Auto' || v === 'NaN') return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const attr = (el, ...names) => {
    for (const n of names) {
      if (el.hasAttribute(n)) return el.getAttribute(n);
      const ln = n.toLowerCase();
      for (const a of el.attributes) if (a.name.toLowerCase() === ln || a.localName.toLowerCase() === ln) return a.value;
    }
    // property-element syntax: <TextBlock.Foreground>…</TextBlock.Foreground>
    for (const c of el.children) {
      const ln = c.localName.toLowerCase();
      for (const n of names) if (ln.endsWith('.' + n.toLowerCase())) {
        const brush = c.firstElementChild;
        if (brush) return brush.getAttribute('Color') || brush.getAttribute('ImageSource') || brush.textContent;
        return c.textContent;
      }
    }
    return null;
  };

  const TEXT_TAGS = /text|label|title|caption/;
  const IMAGE_TAGS = /image|picture|logo|media|video/;
  const SHAPE_TAGS = /^(rectangle|rect|border|shape|ellipse|colour|color|fill|solid|box|quad|background|path|polygon)$/;
  const SKIP_TAGS = /^(resources|storyboard|triggers|eventtrigger|beginstoryboard|animation|keyframe|doubleanimation|coloranimation|transform|rendertransform|layouttransform|effect|dropshadoweffect|gradientstop|lineargradientbrush|solidcolorbrush|imagebrush|style|setter|template|columndefinitions|rowdefinitions|columndefinition|rowdefinition|meta|metadata|settings|transitions)$/;

  function parseDoc(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('The title XML could not be read: ' + err.textContent.split('\n')[0]);
    return doc;
  }

  function convert(pkg) {
    const xmlEntries = pkg.entries.filter(e => e.text != null && /\.(gtxml|xaml|xml)$/i.test(e.path));
    if (!xmlEntries.length) throw new Error(`"${pkg.name}" contains no title XML (.gtxml / .xaml / .xml).`);
    xmlEntries.sort((a, b) => score(b) - score(a));
    const main = xmlEntries[0];
    const doc = parseDoc(main.text);
    const root = doc.documentElement;
    const images = pkg.entries.filter(e => e.dataUri);
    const findImage = src => {
      if (!src) return null;
      const base = String(src).split(/[\\/]/).pop().toLowerCase();
      const hit = images.find(i => i.path.split(/[\\/]/).pop().toLowerCase() === base);
      return hit ? hit.dataUri : null;
    };

    // design size
    let dw = num(attr(root, 'Width', 'CanvasWidth', 'ResolutionX', 'SizeX')), dh = num(attr(root, 'Height', 'CanvasHeight', 'ResolutionY', 'SizeY'));
    if (!dw || !dh) {
      const sized = [...root.querySelectorAll('*')].find(e => num(attr(e, 'Width')) >= 640 && num(attr(e, 'Height')) >= 360);
      dw = dw || (sized ? num(attr(sized, 'Width')) : W); dh = dh || (sized ? num(attr(sized, 'Height')) : H);
    }
    const k = Math.min(W / dw, H / dh);

    const objects = [], warnings = [];
    const used = new Set();
    const uniq = n => { let s = n, i = 2; while (used.has(s)) s = n + ' ' + i++; used.add(s); return s; };
    const uid = () => Math.random().toString(36).slice(2, 10);

    function walk(el, ox, oy, pw, ph, inheritedOpacity) {
      const tag = el.localName.toLowerCase();
      if (SKIP_TAGS.test(tag) || tag.includes('.')) return;
      const vis = attr(el, 'Visibility', 'Visible');
      if (vis && /^(hidden|collapsed|false)$/i.test(vis)) return;
      let x = num(attr(el, 'Canvas.Left', 'Left', 'X', 'PositionX', 'PosX')) || 0;
      let y = num(attr(el, 'Canvas.Top', 'Top', 'Y', 'PositionY', 'PosY')) || 0;
      const margin = attr(el, 'Margin');
      if (margin) { const m = margin.split(/[ ,]+/).map(num); if (m.length === 1) { x += m[0] || 0; y += m[0] || 0; } else { x += m[0] || 0; y += m[1] || 0; } }
      let w = num(attr(el, 'Width', 'SizeX', 'W')), h = num(attr(el, 'Height', 'SizeY', 'H'));
      const op = num(attr(el, 'Opacity', 'Alpha'));
      const opacity = (inheritedOpacity ?? 1) * (op == null ? 1 : (op > 1 ? op / 100 : op));
      const ax = ox + x, ay = oy + y;
      const name = (attr(el, 'Name', 'x:Name', 'Id', 'ID') || '').replace(/\.(Text|Source|Fill)$/i, '');
      const textVal = attr(el, 'Text', 'Content', 'Value', 'Caption');
      const srcVal = attr(el, 'Source', 'ImageSource', 'File', 'Path', 'Filename', 'Image');
      const fillVal = attr(el, 'Fill', 'Background', 'Color', 'Colour', 'FillColor');
      const isText = TEXT_TAGS.test(tag) || (textVal != null && !IMAGE_TAGS.test(tag) && el.children.length === 0);
      const isImage = !isText && (IMAGE_TAGS.test(tag) || (srcVal && /\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(srcVal)));
      const isShape = !isText && !isImage && SHAPE_TAGS.test(tag) && el.children.length === 0;

      const box = (dfw, dfh) => ({ x: Math.round(ax * k), y: Math.round(ay * k), w: Math.max(4, Math.round((w ?? dfw) * k)), h: Math.max(4, Math.round((h ?? dfh) * k)) });
      if (isText) {
        const txt = textVal != null ? textVal : el.textContent.trim();
        const size = num(attr(el, 'FontSize', 'Size', 'TextSize')) || 48;
        const weightRaw = String(attr(el, 'FontWeight', 'Weight', 'Bold') || '');
        const weight = /bold|black|heavy|true/i.test(weightRaw) ? 700 : /semi|demi|medium/i.test(weightRaw) ? 600 : (num(weightRaw) || 400);
        const align = String(attr(el, 'TextAlignment', 'HorizontalAlignment', 'Alignment', 'Align') || 'left').toLowerCase();
        const fam = String(attr(el, 'FontFamily', 'Font') || 'Barlow Condensed').split(',')[0].replace(/#.*$/, '').trim();
        const b = box(Math.max(200, (pw ?? dw) - x), Math.max(size * 1.3, 20));
        objects.push({ id: uid(), name: uniq(name || 'Text'), type: 'text', ...b, alpha: Math.round(opacity * 100), visible: true, published: true,
          anim: { in: 'fade', delay: 0, dur: 400 },
          p: { text: txt, font: fam || 'Barlow Condensed', size: Math.round(size * k), weight, color: color(attr(el, 'Foreground', 'TextColor', 'Color', 'Fill')) || '#ffffff',
            align: align.includes('center') ? 'center' : align.includes('right') ? 'right' : 'left', upper: false, italic: /italic/i.test(attr(el, 'FontStyle') || ''), tracking: 0,
            shadow: /shadow/i.test(el.outerHTML), squeeze: true } });
        return;
      }
      if (isImage) {
        const data = findImage(srcVal);
        if (srcVal && !data) warnings.push(`Image "${srcVal}" was not inside the package; a placeholder was used.`);
        objects.push({ id: uid(), name: uniq(name || 'Image'), type: 'image', ...box(400, 300), alpha: Math.round(opacity * 100), visible: true, published: true,
          anim: { in: 'fade', delay: 0, dur: 400 }, p: { src: data || KL.SIL(), fit: /uniformtofill|fill|crop/i.test(attr(el, 'Stretch') || 'UniformToFill') ? 'cover' : 'contain' } });
        return;
      }
      if (isShape || (fillVal && color(fillVal) && w && h && !el.children.length)) {
        const c = color(fillVal) || '#444444';
        const radius = num(attr(el, 'RadiusX', 'CornerRadius', 'Radius')) || 0;
        objects.push({ id: uid(), name: uniq(name || (tag.charAt(0).toUpperCase() + tag.slice(1))), type: 'rect', ...box(pw ?? dw, ph ?? 40), alpha: Math.round(opacity * 100), visible: true, published: false,
          anim: { in: 'wipe', delay: 0, dur: 400 },
          p: { fill: c, fill2: '', angle: 180, radius: Math.round(radius * k), skew: 0, stroke: color(attr(el, 'Stroke', 'BorderBrush')) || '#ffffff', strokeW: Math.round((num(attr(el, 'StrokeThickness', 'BorderThickness')) || 0) * k) } });
        return;
      }
      // container: a Border/Grid with a background becomes a quad behind its children
      if (fillVal && color(fillVal) && w && h) {
        objects.push({ id: uid(), name: uniq((name || tag) + ' bg'), type: 'rect', ...box(w, h), alpha: Math.round(opacity * 100), visible: true, published: false,
          anim: { in: 'wipe', delay: 0, dur: 400 }, p: { fill: color(fillVal), fill2: '', angle: 180, radius: 0, skew: 0, stroke: '#ffffff', strokeW: 0 } });
      }
      for (const c of el.children) walk(c, ax, ay, w ?? pw, h ?? ph, opacity);
    }
    for (const c of root.children) walk(c, 0, 0, dw, dh, 1);
    if (!objects.length) throw new Error(`No text, image or shape elements were recognised in "${main.path}".`);
    // stagger the default fade so the result has a usable in/out right away
    objects.forEach((o, i) => { o.anim.delay = Math.min(600, i * 40); });
    const scene = { id: uid(), name: pkg.name.toUpperCase().slice(0, 40), category: 'GT', layer: 10, objects, tl: { fps: 30, pause: 30, end: 45 }, source: { kind: 'vmix', file: pkg.file, xml: main.path, design: `${dw}×${dh}` } };
    KL.presetTimeline(scene);
    return { scene, warnings };
  }
  function score(e) { const p = e.path.toLowerCase(); return (/\.gtxml$/.test(p) ? 30 : 0) + (/\.xaml$/.test(p) ? 20 : 0) + (/document|title|main/.test(p) ? 10 : 0) + Math.min(9, e.text.length / 5000); }

  window.GTImport = { convert, color };
})();
