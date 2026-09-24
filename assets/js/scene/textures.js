/**
 * Textures de la scène.
 * - Surfaces PBR (couleur + normal + rugosité) : calculées EN PARALLÈLE dans des Web Workers
 *   (tex-worker.js → texgen.js), sans bloquer la page. Secours : calcul dans la page si les workers
 *   ne sont pas disponibles.
 * - Sprites de feuillage : dessinés en canvas 2D (quelques millisecondes).
 */
import * as THREE from 'three';
import { rng } from './texgen.js';

// ---------- Pool de workers ----------
const POOL_SIZE = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
let pool = null; // null = pas encore créé, false = indisponible (calcul dans la page)
let nextId = 0;
const pending = new Map();
const queue = [];

function createPool() {
  try {
    const url = new URL('./tex-worker.js', import.meta.url);
    const workers = Array.from({ length: POOL_SIZE }, () => {
      const w = new Worker(url, { type: 'module' });
      w.busy = false;
      w.onmessage = ({ data }) => {
        const job = pending.get(data.id); pending.delete(data.id);
        w.busy = false; pump();
        if (data.error) job.reject(new Error(data.error)); else job.resolve(data.r);
      };
      w.onerror = (e) => { e.preventDefault?.(); failAll(); };
      return w;
    });
    return workers;
  } catch { return false; }
}
function failAll() {
  // un worker a échoué (navigateur ancien, contexte particulier) → on bascule tout sur le calcul local
  if (pool) pool.forEach((w) => w.terminate());
  pool = false;
  const jobs = [...pending.values(), ...queue.splice(0)]; pending.clear();
  jobs.forEach((j) => runLocal(j.name, j.args).then(j.resolve, j.reject));
}
function pump() {
  if (!pool) return;
  for (const w of pool) {
    if (!queue.length) return;
    if (w.busy) continue;
    const job = queue.shift(); const id = nextId++;
    pending.set(id, job); w.busy = true;
    w.postMessage({ id, name: job.name, args: job.args });
  }
}
async function runLocal(name, args) {
  const G = await import('./texgen.js');
  await new Promise((r) => setTimeout(r, 0)); // laisse la page respirer entre deux textures
  return G[name](...args);
}
function run(name, args) {
  if (pool === null) pool = createPool();
  if (pool === false) return runLocal(name, args);
  return new Promise((resolve, reject) => { queue.push({ name, args, resolve, reject }); pump(); });
}
/** Libère les workers une fois toutes les textures générées. */
export function releaseWorkers() {
  if (pool) pool.forEach((w) => w.terminate());
  pool = null;
}

// ---------- Conversion en textures Three.js ----------
function dataTex(data, size, srgb) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
const pbr = (name) => (...args) => run(name, args).then((r) => ({
  map: dataTex(r.col, r.size, true), normalMap: dataTex(r.nrm, r.size, false), roughnessMap: dataTex(r.rough, r.size, false),
}));

export const travertine = pbr('travertine');
export const mosaic = pbr('mosaic');
export const plaster = pbr('plaster');
export const concrete = pbr('concrete');
export const woodSlats = pbr('woodSlats');
export const stoneWall = pbr('stoneWall');
export const grass = pbr('grass');
export const gravel = pbr('gravel');
export const bark = pbr('bark');
export const fabric = pbr('fabric');
export const waterNormal = (...args) => run('waterNormal', args).then((r) => dataTex(r.nrm, r.size, false));

/** Textures provisoires (4 px, mêmes réglages) : les matériaux et shaders se préparent pendant que les vraies
 *  textures sont calculées ; leurs images sont ensuite remplacées sur place. */
export function pbrPlaceholder() {
  const px = (r, g, b) => { const a = new Uint8Array(16 * 4); for (let i = 0; i < 16; i++) a.set([r, g, b, 255], i * 4); return a; };
  return { map: dataTex(px(200, 200, 200), 4, true), normalMap: dataTex(px(128, 128, 255), 4, false), roughnessMap: dataTex(px(220, 220, 220), 4, false) };
}

// ---------- Sprites de feuillage (canvas 2D, alpha) ----------
function spriteCanvas(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.premultiplyAlpha = false;
  return t;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

/** Rameau d'olivier : feuilles fines argentées. */
export function oliveLeaves(size = 256, seed = 43) {
  const R = rng(seed);
  return spriteCanvas(size, (g, s) => {
    g.lineCap = 'round';
    for (let k = 0; k < 7; k++) { // petites tiges
      const x0 = s * (0.2 + R() * 0.6), y0 = s * (0.2 + R() * 0.6), a0 = R() * Math.PI * 2, len = s * (0.25 + R() * 0.2);
      g.strokeStyle = rgb(95, 90, 70); g.lineWidth = s * 0.006;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a0) * len, y0 + Math.sin(a0) * len); g.stroke();
      for (let i = 0; i < 16; i++) {
        const t = R(); const px = x0 + Math.cos(a0) * len * t, py = y0 + Math.sin(a0) * len * t;
        const a = a0 + (R() > 0.5 ? 1 : -1) * (0.4 + R() * 0.7);
        const L = s * (0.07 + R() * 0.05), W = s * (0.012 + R() * 0.008);
        const silver = R();
        g.save(); g.translate(px, py); g.rotate(a);
        g.fillStyle = silver > 0.55 ? rgb(150 + R() * 25, 160 + R() * 20, 135 + R() * 15) : rgb(78 + R() * 25, 96 + R() * 22, 62 + R() * 15);
        g.beginPath(); g.ellipse(L / 2, 0, L / 2, W, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  });
}

/** Feuillage dense (cyprès, arbustes) : écailles / petites feuilles. */
export function denseFoliage(size = 256, seed = 47, dark = [36, 58, 34], light = [74, 98, 52]) {
  const R = rng(seed);
  return spriteCanvas(size, (g, s) => {
    const cx = s / 2, cy = s / 2;
    for (let i = 0; i < 900; i++) {
      const r = Math.sqrt(R()) * s * 0.46, a = R() * Math.PI * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const shade = 1 - r / (s * 0.5);
      const t = R() * 0.6 + shade * 0.4;
      g.fillStyle = rgb(dark[0] + (light[0] - dark[0]) * t, dark[1] + (light[1] - dark[1]) * t, dark[2] + (light[2] - dark[2]) * t);
      g.beginPath(); g.ellipse(x, y, s * (0.012 + R() * 0.012), s * (0.006 + R() * 0.006), R() * Math.PI, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Touffe de lavande (tiges + épis violets). */
export function lavender(size = 256, seed = 53) {
  const R = rng(seed);
  return spriteCanvas(size, (g, s) => {
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x0 = s * (0.35 + R() * 0.3), x1 = x0 + (R() - 0.5) * s * 0.55, y1 = s * (0.05 + R() * 0.35);
      g.strokeStyle = rgb(90 + R() * 20, 110 + R() * 20, 80); g.lineWidth = s * 0.006;
      g.beginPath(); g.moveTo(x0, s); g.quadraticCurveTo((x0 + x1) / 2, s * 0.6, x1, y1); g.stroke();
      for (let k = 0; k < 9; k++) {
        const tt = k / 9; const px = x1 + (x0 - x1) * tt * 0.12, py = y1 + tt * s * 0.1;
        g.fillStyle = rgb(110 + R() * 30, 90 + R() * 25, 160 + R() * 30);
        g.beginPath(); g.ellipse(px, py, s * 0.008, s * 0.012, 0, 0, Math.PI * 2); g.fill();
      }
    }
  });
}

/** Touffe de graminées ornementales. */
export function grassTuft(size = 256, seed = 59) {
  const R = rng(seed);
  return spriteCanvas(size, (g, s) => {
    g.lineCap = 'round';
    for (let i = 0; i < 120; i++) {
      const x0 = s * (0.4 + R() * 0.2), x1 = x0 + (R() - 0.5) * s * 0.9, y1 = s * (0.02 + R() * 0.4);
      const t = R();
      g.strokeStyle = rgb(150 + t * 50, 140 + t * 40, 90 + t * 30); g.lineWidth = s * (0.004 + R() * 0.004);
      g.beginPath(); g.moveTo(x0, s); g.quadraticCurveTo(x0, s * 0.5, x1, y1); g.stroke();
    }
  });
}
