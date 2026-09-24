/**
 * Générateurs de textures procédurales « purs » (aucune dépendance au DOM ni à Three.js) :
 * ils tournent dans des Web Workers (tex-worker.js), en parallèle, sans bloquer la page.
 * Chaque générateur renvoie { size, col, nrm, rough } (tableaux RGBA 8 bits).
 * Toutes les textures sont « tileables » (bruit périodique) pour éviter les raccords visibles.
 */

// ---------- Bruit périodique ----------
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function makeNoise(seed = 1) {
  const R = rng(seed);
  const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = R(); }
  for (let i = P - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[i + P] = perm[i];
  const fade = (t) => t * t * (3 - 2 * t);
  // bruit de valeur tileable sur une période entière `per`
  const n2 = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const m = (a) => ((a % per) + per) % per;
    const h = (a, b) => vals[perm[(perm[m(a) & 255] + m(b)) & 255]];
    const u = fade(xf), v = fade(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (u, v, base = 4, oct = 5, gain = 0.5) => {
    let amp = 0.5, f = base, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += amp * n2(u * f, v * f, f); norm += amp; amp *= gain; f *= 2; }
    return sum / norm;
  };
  return { n2, fbm, R };
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];

/** Fonction par pixel (u,v ∈ [0,1[) → {c:[r,g,b], h, r} ⇒ tableaux couleur, normal (Sobel), rugosité. */
function bake(size, fn, { normalStrength = 2 } = {}) {
  const col = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = fn(x / size, y / size);
      col[i * 4] = s.c[0] * 255; col[i * 4 + 1] = s.c[1] * 255; col[i * 4 + 2] = s.c[2] * 255; col[i * 4 + 3] = 255;
      const r = (s.r ?? 0.8) * 255;
      rough[i * 4] = r; rough[i * 4 + 1] = r; rough[i * 4 + 2] = r; rough[i * 4 + 3] = 255;
      height[i] = s.h ?? 0;
    }
  }
  const nrm = new Uint8ClampedArray(size * size * 4);
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * normalStrength, ny = -dy * normalStrength, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
    }
  }
  return { size, col, nrm, rough };
}

// ---------- Matériaux de surface ----------

/** Dallage travertin grand format (4 × 2 dalles par motif). */
export function travertine(size, seed = 3, tint = 0xd8ccb8) {
  const N = makeNoise(seed); const base = hex(tint);
  const cols = 4, rows = 2, grout = 0.004;
  const tileTone = []; for (let i = 0; i < cols * rows; i++) tileTone.push([N.R(), N.R(), N.R()]);
  return bake(size, (u, v) => {
    const cx = u * cols, cy = v * rows;
    const ix = Math.floor(cx), iy = Math.floor(cy);
    const fx = cx - ix, fy = cy - iy;
    const g = Math.min(fx, 1 - fx) / cols, gy = Math.min(fy, 1 - fy) / rows;
    const inGrout = Math.min(g, gy) < grout;
    const t = tileTone[(iy * cols + ix) % tileTone.length];
    const vein = N.fbm(u * 0.8 + t[0], v * 4 + t[1], 4, 5);
    const mottle = N.fbm(u, v, 8, 4);
    const pore = N.n2(u * 380, v * 380, 380) > 0.86 ? 1 : 0;
    const tone = 0.93 + t[2] * 0.1 + (vein - 0.5) * 0.12 + (mottle - 0.5) * 0.08 - pore * 0.12;
    let c = [base[0] * tone, base[1] * tone * 0.995, base[2] * tone * 0.985];
    if (inGrout) c = c.map((x) => x * 0.72);
    return { c, h: inGrout ? -0.6 : (mottle - 0.5) * 0.08 - pore * 0.25, r: inGrout ? 0.95 : 0.62 + mottle * 0.18 + pore * 0.2 };
  }, { normalStrength: 2.2 });
}

/** Mosaïque de bassin (pâte de verre gris perle / sable). */
export function mosaic(size, seed = 7) {
  const N = makeNoise(seed);
  const n = 40; const grout = 0.08;
  const palette = [hex(0xd9dfdc), hex(0xcfd8d6), hex(0xe4e6e0), hex(0xc4d0cf), hex(0xdadcd3)];
  return bake(size, (u, v) => {
    const cx = u * n, cy = v * n, ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy;
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
    const k = Math.floor(N.n2(ix * 7.3, iy * 3.1, n * 8) * palette.length * 0.999);
    const p = palette[(k + ((ix * 31 + iy * 17) % 3)) % palette.length];
    const var_ = 0.94 + N.n2(ix + 0.5, iy + 0.5, n) * 0.1;
    if (edge < grout) return { c: [0.86, 0.87, 0.85], h: -0.5, r: 0.9 };
    const bevel = clamp01((edge - grout) / 0.12);
    return { c: p.map((x) => x * var_), h: bevel * 0.4, r: 0.18 + (1 - bevel) * 0.2 };
  }, { normalStrength: 3 });
}

/** Enduit architectural blanc cassé, légèrement nuancé. */
export function plaster(size, seed = 11) {
  const N = makeNoise(seed); const base = hex(0xeae6de);
  return bake(size, (u, v) => {
    const m = N.fbm(u, v, 3, 5), g = N.n2(u * 256, v * 256, 256);
    const tone = 0.95 + (m - 0.5) * 0.08 + (g - 0.5) * 0.03;
    return { c: base.map((x) => x * tone), h: (m - 0.5) * 0.3 + (g - 0.5) * 0.25, r: 0.86 + (g - 0.5) * 0.1 };
  }, { normalStrength: 1.2 });
}

/** Béton architectural lissé (sol intérieur, murets). */
export function concrete(size, seed = 13) {
  const N = makeNoise(seed); const base = hex(0xbdb8ae);
  return bake(size, (u, v) => {
    const m = N.fbm(u, v, 2, 6), s = N.n2(u * 200, v * 200, 200);
    const tone = 0.92 + (m - 0.5) * 0.18 + (s > 0.9 ? -0.08 : 0);
    return { c: base.map((x) => x * tone), h: (m - 0.5) * 0.15, r: 0.7 + (m - 0.5) * 0.2 };
  }, { normalStrength: 1 });
}

/** Bardage bois vertical (lames). */
export function woodSlats(size, seed = 17, slats = 10) {
  const N = makeNoise(seed);
  const a = hex(0x8a5a3b), b = hex(0x6d4429);
  const tones = []; for (let i = 0; i < slats; i++) tones.push(N.R());
  return bake(size, (u, v) => {
    const cx = u * slats, ix = Math.floor(cx), fx = cx - ix;
    const gap = fx < 0.07;
    const grain = N.fbm(u * 1.2 + tones[ix] * 3, v * 0.08, 16, 4);
    const fine = N.n2(u * 512, v * 24, 512);
    const t = clamp01(0.35 + tones[ix] * 0.35 + (grain - 0.5) * 0.9 + (fine - 0.5) * 0.15);
    let c = [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
    if (gap) c = c.map((x) => x * 0.25);
    return { c, h: gap ? -1 : (grain - 0.5) * 0.2, r: gap ? 1 : 0.62 + (fine - 0.5) * 0.1 };
  }, { normalStrength: 2.5 });
}

/** Parement pierre (appareillage irrégulier). */
export function stoneWall(size, seed = 19) {
  const N = makeNoise(seed);
  const rows = 9; const rowH = 1 / rows;
  const layout = [];
  for (let r = 0; r < rows; r++) {
    const cuts = [0]; let x = N.R() * 0.2;
    while (x < 1) { cuts.push(x); x += 0.12 + N.R() * 0.22; }
    cuts.push(1);
    layout.push({ cuts: [...new Set(cuts)].sort((p, q) => p - q), tones: cuts.map(() => [N.R(), N.R()]) });
  }
  const pal = [hex(0xcbbfa9), hex(0xb9ab93), hex(0xd6cdbd), hex(0xa99d88), hex(0xc4b59a)];
  return bake(size, (u, v) => {
    const r = Math.min(rows - 1, Math.floor(v * rows)); const fy = (v - r * rowH) / rowH;
    const L = layout[r];
    let k = 0; while (k < L.cuts.length - 2 && u >= L.cuts[k + 1]) k++;
    const x0 = L.cuts[k], x1 = L.cuts[k + 1];
    const fx = (u - x0) / Math.max(1e-4, x1 - x0);
    const wob = (N.fbm(u, v, 6, 3) - 0.5) * 0.25;
    const edge = Math.min(fx * (x1 - x0) * rows, (1 - fx) * (x1 - x0) * rows, fy, 1 - fy) + wob * 0.2;
    const t = L.tones[k];
    const p = pal[Math.floor(t[0] * pal.length) % pal.length];
    const surf = N.fbm(u, v, 12, 4);
    if (edge < 0.07) return { c: [0.55, 0.52, 0.47], h: -1, r: 0.95 };
    const dome = clamp01(edge / 0.3);
    const tone = 0.86 + t[1] * 0.18 + (surf - 0.5) * 0.25;
    return { c: p.map((x) => x * tone), h: dome * 0.6 + (surf - 0.5) * 0.5, r: 0.8 + (surf - 0.5) * 0.15 };
  }, { normalStrength: 3.5 });
}

/** Pelouse (couleur macro variée + micro-brins). */
export function grass(size, seed = 23) {
  const N = makeNoise(seed);
  const g1 = hex(0x4f6b2c), g2 = hex(0x6f8a3a), dry = hex(0x9a9160);
  return bake(size, (u, v) => {
    const m = N.fbm(u, v, 3, 5), d = N.fbm(u + 0.3, v + 0.7, 2, 4);
    const blade = N.n2(u * 480, v * 480, 480);
    const t = clamp01(m * 1.2 - 0.1);
    let c = [mix(g1[0], g2[0], t), mix(g1[1], g2[1], t), mix(g1[2], g2[2], t)];
    const dd = clamp01((d - 0.6) * 3) * 0.35;
    c = c.map((x, i) => mix(x, dry[i], dd) * (0.8 + blade * 0.35));
    return { c, h: blade * 0.6, r: 0.9 };
  }, { normalStrength: 1.5 });
}

/** Gravier / terre des massifs. */
export function gravel(size, seed = 29) {
  const N = makeNoise(seed);
  return bake(size, (u, v) => {
    const a = N.n2(u * 90, v * 90, 90), b = N.n2(u * 190, v * 190, 190), m = N.fbm(u, v, 4, 4);
    const pebble = clamp01((a - 0.45) * 4);
    const tone = 0.55 + pebble * 0.35 + (b - 0.5) * 0.2 + (m - 0.5) * 0.1;
    return { c: [0.62 * tone, 0.56 * tone, 0.48 * tone], h: pebble * 0.8 + b * 0.2, r: 0.93 };
  }, { normalStrength: 3 });
}

/** Écorce d'olivier (sillons verticaux). */
export function bark(size, seed = 31) {
  const N = makeNoise(seed);
  return bake(size, (u, v) => {
    const f = N.fbm(u * 1, v * 0.25, 12, 5), g = N.n2(u * 128, v * 64, 128);
    const furrow = Math.abs(f - 0.5) * 2;
    const tone = 0.35 + furrow * 0.35 + g * 0.1;
    return { c: [0.46 * tone + 0.06, 0.42 * tone + 0.05, 0.36 * tone + 0.04], h: furrow, r: 0.92 };
  }, { normalStrength: 4 });
}

/** Tissu des coussins (tissage fin). */
export function fabric(size, seed = 37, tint = 0xe9e4d8) {
  const N = makeNoise(seed); const base = hex(tint);
  return bake(size, (u, v) => {
    const w = (Math.sin(u * size * 0.9) * Math.sin(v * size * 0.9)) * 0.5 + 0.5;
    const m = N.fbm(u, v, 4, 3);
    const tone = 0.93 + w * 0.05 + (m - 0.5) * 0.05;
    return { c: base.map((x) => x * tone), h: w * 0.4, r: 0.95 };
  }, { normalStrength: 1.2 });
}

/** Normal map d'eau (houle fine, tileable) — seul le tableau nrm est utilisé. */
export function waterNormal(size, seed = 41) {
  const N = makeNoise(seed);
  return bake(size, (u, v) => {
    const h = N.fbm(u, v, 4, 5, 0.55) * 0.7 + N.fbm(u + 0.37, v + 0.11, 9, 3) * 0.3;
    return { c: [0, 0, 0], h: h * 1.4, r: 0 };
  }, { normalStrength: 3.2 });
}
