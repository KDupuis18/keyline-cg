/* Extruded 3D text: one shared WebGL renderer draws each 3D text object into its own 2D canvas.
   Fonts come from the bundled Fontsource WOFF files (or imported custom fonts) via opentype.js. */
import * as THREE from 'three';
import { TTFLoader } from './vendor/three-jsm/loaders/TTFLoader.js';
import { Font } from './vendor/three-jsm/loaders/FontLoader.js';
import { TextGeometry } from './vendor/three-jsm/geometries/TextGeometry.js';

const SLUG = { 'Barlow Condensed': 'barlow-condensed', 'Oswald': 'oswald', 'Anton': 'anton', 'Teko': 'teko', 'Roboto Condensed': 'roboto-condensed', 'Archivo Narrow': 'archivo-narrow', 'Bebas Neue': 'bebas-neue' };
const WEIGHTS = { 'barlow-condensed': [400, 500, 600, 700, 800], oswald: [400, 500, 600, 700], anton: [400], teko: [400, 500, 600, 700], 'roboto-condensed': [400, 500, 700, 800], 'archivo-narrow': [400, 600, 700], 'bebas-neue': [400] };
const fonts = new Map();   // url -> Promise<Font>
const geoms = new Map();   // key -> { geo, box }
let renderer = null, version = 0;
const ready = {};       // url -> Font, once parsed

function fontFileUrl(family, weight, custom) {
  if (custom) return custom;
  const slug = SLUG[family] || 'oswald';
  const ws = WEIGHTS[slug];
  const w = ws.reduce((a, b) => Math.abs(b - weight) < Math.abs(a - weight) ? b : a, ws[0]);
  return new URL(`../../node_modules/@fontsource/${slug}/files/${slug}-latin-${w}-normal.woff`, import.meta.url).href;
}
function loadFont(url) {
  if (!fonts.has(url)) {
    fonts.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('font ' + r.status); return r.arrayBuffer(); })
      .then(buf => { const f = new Font(new TTFLoader().parse(buf)); ready[url] = f; version++; window.KL3D.version = version; if (window.KL) window.KL.redraw3d(); return f; }));
  }
  return fonts.get(url);
}
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}
function geometry(font, p) {
  const key = [p.text, p.font, p.weight, p.size, p.depth, p.bevel].join('|');
  let g = geoms.get(key);
  if (!g) {
    const bevel = Math.max(0, +p.bevel || 0);
    const geo = new TextGeometry(String(p.text || ' '), { font, size: +p.size || 100, height: Math.max(0.1, +p.depth || 0), curveSegments: 6, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 3 });
    geo.computeBoundingBox();
    g = { geo, box: geo.boundingBox.clone() };
    geoms.set(key, g);
    if (geoms.size > 200) { const first = geoms.keys().next().value; geoms.get(first).geo.dispose(); geoms.delete(first); }
  }
  return g;
}

function draw(canvas, p, st, customUrl) {
  const w = Math.max(2, Math.round(st.w)), h = Math.max(2, Math.round(st.h));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const url = fontFileUrl(p.font, +p.weight || 700, customUrl);
  const font = ready[url];
  if (!font) { loadFont(url).catch(e => console.warn('3D font failed', url, e.message)); return; }
  const r = getRenderer();
  r.setSize(w, h, false);
  const scene = new THREE.Scene();
  const fov = 30, dist = (h / 2) / Math.tan(fov / 2 * Math.PI / 180);
  const cam = new THREE.PerspectiveCamera(fov, w / h, 1, dist * 4);
  cam.position.set(0, 0, dist);
  const { geo, box } = geometry(font, p);
  const front = new THREE.MeshStandardMaterial({ color: p.color || '#ffffff', metalness: +p.metal || 0, roughness: p.rough == null ? 0.4 : +p.rough });
  const side = new THREE.MeshStandardMaterial({ color: p.sideColor || p.color || '#888888', metalness: +p.metal || 0, roughness: p.rough == null ? 0.4 : +p.rough });
  const mesh = new THREE.Mesh(geo, [front, side]);
  const tw = box.max.x - box.min.x, th = box.max.y - box.min.y, td = box.max.z - box.min.z;
  const ax = p.align === 'left' ? -w / 2 - box.min.x : p.align === 'right' ? w / 2 - box.max.x : -box.min.x - tw / 2;
  mesh.position.set(ax, -box.min.y - th / 2, -box.min.z - td / 2);
  const pivot = new THREE.Group();
  pivot.add(mesh);
  pivot.rotation.set(THREE.MathUtils.degToRad(st.rx || 0), THREE.MathUtils.degToRad(st.ry || 0), THREE.MathUtils.degToRad(-(st.r || 0)));
  scene.add(pivot);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const la = THREE.MathUtils.degToRad(p.lightAngle ?? 35);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(Math.sin(la) * dist, Math.cos(la) * dist * 0.8, dist);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-dist, -dist * 0.3, dist * 0.5);
  scene.add(fill);
  r.render(scene, cam);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(r.domElement, 0, 0, w, h);
  front.dispose(); side.dispose();
}

window.KL3D = { draw, version };
if (window.KL) window.KL.redraw3d();
