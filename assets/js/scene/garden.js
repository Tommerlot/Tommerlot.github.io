/**
 * Jardin méditerranéen : pelouse (herbe instanciée animée par le vent), oliviers, cyprès,
 * arbustes, lavandes, graminées, murets en pierre sèche, mobilier, arrière-plan collinaire.
 * Le feuillage utilise des cartes alpha instanciées (une seule draw call par essence).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxB, worldUV, Batch } from './materials.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Uniform partagé pour le vent (herbe + feuillages)
export const wind = { uTime: { value: 0 } };

/** Ajoute un léger balancement au feuillage (vertex shader, par instance). */
function sway(mat, amount = 0.06) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev?.call(mat, shader, r);
    shader.uniforms.uTime = wind.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = ip.x * 0.37 + ip.z * 0.53;
          float k = ${amount.toFixed(3)} * (0.6 + 0.4 * sin(uTime * 0.7 + ph));
          transformed.x += sin(uTime * 1.6 + ph) * k * (0.5 + position.y);
          transformed.z += cos(uTime * 1.3 + ph * 1.3) * k * 0.6 * (0.5 + position.y);
        #endif`);
  };
  mat.customProgramCacheKey = () => `sway${amount}`;
  return mat;
}

/** Nuage de cartes de feuillage (InstancedMesh) avec variations de teinte. */
class Cards {
  constructor(material, cardSize = 0.6, upright = false) { this.material = material; this.size = cardSize; this.upright = upright; this.m = []; this.c = []; }
  add(pos, scale, color) {
    const e = this.upright
      ? new THREE.Euler((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25, 'YXZ')
      : new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    const q = new THREE.Quaternion().setFromEuler(e);
    this.m.push(new THREE.Matrix4().compose(pos, q, new THREE.Vector3(scale, scale, scale)));
    this.c.push(color);
  }
  build(parent, cast = true) {
    if (!this.m.length) return null;
    const geo = new THREE.PlaneGeometry(this.size, this.size);
    const mesh = new THREE.InstancedMesh(geo, this.material, this.m.length);
    this.m.forEach((mm, i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, this.c[i]); });
    mesh.castShadow = cast; mesh.receiveShadow = true;
    const depth = this.material.userData.depth;
    if (cast && depth && depth.isMaterial) mesh.customDepthMaterial = depth;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
}

export function buildGarden(M, q) {
  const g = new THREE.Group(); g.name = 'garden';
  const B = new Batch();
  const R = rng(7);
  const leafK = q.leafScale;

  // ---------- Sol ----------
  // pelouse percée à l'emplacement de la terrasse (sinon elle recouvrirait le fond du bassin)
  const gs = new THREE.Shape();
  gs.moveTo(-110, -110); gs.lineTo(110, -110); gs.lineTo(110, 110); gs.lineTo(-110, 110); gs.closePath();
  const gh = new THREE.Path();
  gh.moveTo(-11.4, -7.4); gh.lineTo(-11.4, 6.7); gh.lineTo(14.4, 6.7); gh.lineTo(14.4, -7.4); gh.closePath();
  gs.holes.push(gh);
  const ground = new THREE.ShapeGeometry(gs);
  ground.rotateX(Math.PI / 2); ground.translate(0, -0.02, 0);
  ground.computeVertexNormals();
  const gn = ground.attributes.normal; for (let i = 0; i < gn.count; i++) gn.setXYZ(i, 0, 1, 0);
  const gidx = ground.index.array; for (let i = 0; i < gidx.length; i += 3) { const t = gidx[i + 1]; gidx[i + 1] = gidx[i + 2]; gidx[i + 2] = t; }
  worldUV(ground, 5.5);
  const groundMesh = new THREE.Mesh(ground, M.grass); groundMesh.receiveShadow = true; g.add(groundMesh);

  // Collines lointaines (relief + teinte sèche), noyées dans la brume
  const hills = new THREE.PlaneGeometry(900, 900, 160, 160);
  hills.rotateX(-Math.PI / 2);
  const hp = hills.attributes.position; const hc = new Float32Array(hp.count * 3);
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), z = hp.getZ(i); const d = Math.hypot(x, z);
    const f = THREE.MathUtils.smoothstep(d, 80, 260);
    const ridge = Math.sin(Math.atan2(z, x) * 3 + 0.7) * 0.5 + Math.sin(Math.atan2(z, x) * 7 + 2.1) * 0.3;
    const h = f * (6 + 7 * ridge + 3 * Math.sin(x * 0.03 + z * 0.021)) + 14 * THREE.MathUtils.smoothstep(d, 260, 450) * (0.6 + 0.4 * ridge);
    hp.setY(i, h - 0.4 + (d < 70 ? -1 : 0));
    const t = 0.5 + 0.5 * Math.sin(x * 0.05) * Math.cos(z * 0.04);
    hc[i * 3] = 0.36 + t * 0.12; hc[i * 3 + 1] = 0.40 + t * 0.07; hc[i * 3 + 2] = 0.26 + t * 0.04;
  }
  hills.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  hills.computeVertexNormals();
  const hillMesh = new THREE.Mesh(hills, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  hillMesh.receiveShadow = false; g.add(hillMesh);

  // Pins parasols et arbres lointains (silhouettes)
  // (léger éclairage propre : vus à contre-jour, les arbres lointains ne virent plus au noir)
  const farMat = new THREE.MeshStandardMaterial({ map: M.cypress.map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x3a4a2c, emissiveIntensity: 0.55 });
  const farTrees = new Cards(farMat, 3.2);
  const coreCypress = new THREE.MeshStandardMaterial({ color: 0x1d2b1b, roughness: 1 });
  const coreShrub = new THREE.MeshStandardMaterial({ color: 0x33452a, roughness: 1 });
  const corePitto = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1 });
  const farTrunks = [];
  for (let i = 0; i < 260 * leafK; i++) {
    const a = R() * Math.PI * 2, d = 55 + R() * 200;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = hp.getY(Math.min(hp.count - 1, Math.round(((z + 450) / 900) * 160) * 161 + Math.round(((x + 450) / 900) * 160)));
    const pine = R() > 0.45;
    const h = pine ? 7 + R() * 5 : 6 + R() * 6;
    for (let k = 0; k < (pine ? 9 : 7); k++) {
      const cy = pine ? h + (R() - 0.3) * 1.5 : h * (0.25 + (k / 7) * 0.75);
      const rad = pine ? 3.2 : 1.1 * (1 - k / 8);
      const p = new THREE.Vector3(x + (R() - 0.5) * rad * 1.6, y + cy, z + (R() - 0.5) * rad * 1.6);
      farTrees.add(p, pine ? 1.4 + R() * 0.8 : 0.9 + R() * 0.4, new THREE.Color().setHSL(0.25 + R() * 0.05, 0.3, 0.26 + R() * 0.1));
    }
    if (pine) farTrunks.push([x, y, z, h]);
  }
  farTrees.build(g, false);
  farTrunks.forEach(([x, y, z, h]) => { const c = new THREE.CylinderGeometry(0.18, 0.28, h, 6); c.translate(x, y + h / 2, z); B.add(M.bark, worldUV(c)); });

  // ---------- Allée et massifs ----------
  // pas japonais de la terrasse vers le jardin
  for (let i = 0; i < 6; i++) {
    const s = new RoundedBoxGeometry(1.1, 0.06, 0.55, 2, 0.02);
    s.translate(-9 + (i % 2) * 0.12, 0.0, 7.6 + i * 0.95);
    B.add(M.terrace, worldUV(s, 2.4));
  }
  // bandes de gravier le long de la villa et au pied des murets
  B.add(M.gravel, boxB(-16, 16, -0.03, 0.005, -18.6, -16.3, 1.5));
  B.add(M.gravel, boxB(-16.5, -12.4, -0.03, 0.005, -16.3, 6.8, 1.5));
  B.add(M.gravel, boxB(-17, 17, -0.03, 0.005, 21.2, 22.4, 1.5));

  // ---------- Murets en pierre sèche (limites) ----------
  // enceinte fermée (sud, est, ouest, nord avec l'entrée de l'allée), chaperon en pierre sur tout le pourtour
  const wall = (x0, x1, z0, z1) => {
    B.add(M.stone, boxB(x0, x1, -0.1, 0.85, z0, z1, 2.4));
    B.add(M.coping, boxB(x0 - 0.05, x1 + 0.05, 0.85, 0.92, z0 - 0.05, z1 + 0.05, 1.2));
  };
  wall(-24, 24, 22.4, 23);           // sud
  wall(-24, -23.4, -22, 22.35);      // ouest
  wall(23.4, 24, -22, 22.35);        // est
  wall(-24, -3.2, -22.6, -22);       // nord (gauche de l'entrée)
  wall(3.2, 24, -22.6, -22);         // nord (droite de l'entrée)
  // piliers d'entrée
  [-3.2, 3.2].forEach((x) => { B.add(M.stone, boxB(x - 0.3, x + 0.3, -0.1, 1.35, -22.65, -21.95, 2.4)); B.add(M.coping, boxB(x - 0.35, x + 0.35, 1.35, 1.43, -22.7, -21.9, 1.2)); });
  // allée gravillonnée entre l'entrée et la porte
  B.add(M.gravel, boxB(-2.6, 2.6, -0.03, 0.006, -22, -18.6, 1.5));
  // jardinière basse en pierre le long de la terrasse (sud-est)
  B.add(M.stone, boxB(6.5, 14.5, 0, 0.55, 6.9, 7.6, 1.6));
  B.add(M.coping, boxB(6.45, 14.55, 0.55, 0.6, 6.85, 7.65, 1.2));
  B.add(M.soil, boxB(6.6, 14.4, 0.4, 0.5, 7.0, 7.5));

  // ---------- Mobilier ----------
  // 4 bains de soleil en teck + coussins, orientés vers le bassin
  [-4.6, -2.5, 2.5, 4.6].forEach((x) => {
    const zc = 4.55;
    B.add(M.teak, boxB(x - 0.36, x + 0.36, 0.08, 0.3, zc - 1, zc + 1, 0.8));
    [[-0.3, -0.9], [0.3, -0.9], [-0.3, 0.9], [0.3, 0.9]].forEach(([dx, dz]) => B.add(M.teak, boxB(x + dx - 0.04, x + dx + 0.04, 0, 0.1, zc + dz - 0.04, zc + dz + 0.04, 0.8)));
    const cushion = new RoundedBoxGeometry(0.68, 0.1, 1.4, 3, 0.04); cushion.translate(x, 0.35, zc - 0.28); B.add(M.fabric, worldUV(cushion, 0.5));
    const back = new RoundedBoxGeometry(0.68, 0.1, 0.62, 3, 0.04); back.rotateX(-0.75); back.translate(x, 0.55, zc + 0.68); B.add(M.fabric, worldUV(back, 0.5));
    const towel = new RoundedBoxGeometry(0.5, 0.015, 0.7, 1, 0.005); towel.translate(x + 0.02, 0.41, zc - 0.5); B.add(M.fabricDark, worldUV(towel, 0.5));
  });
  // table d'appoint + parasol carré
  B.add(M.teak, boxB(-0.3, 0.3, 0.38, 0.42, 4.3, 4.9, 0.8));
  B.add(M.teak, boxB(-0.04, 0.04, 0, 0.38, 4.56, 4.64, 0.8));
  { const p = new THREE.CylinderGeometry(0.035, 0.035, 2.6, 12); p.translate(0, 1.3, 5.6); B.add(M.metalLight, worldUV(p)); }
  { const base = new THREE.BoxGeometry(0.6, 0.12, 0.6); base.translate(0, 0.06, 5.6); B.add(M.concreteDark, worldUV(base)); }
  { const c = new THREE.ConeGeometry(2.1, 0.45, 4, 1, true); c.rotateY(Math.PI / 4); c.translate(0, 2.55, 5.6); B.add(M.fabric, worldUV(c, 0.6)); }

  // table + 6 chaises sous la pergola
  B.add(M.teak, boxB(9.6, 12.4, 0.74, 0.79, -4.65, -3.65, 0.8));
  [[9.8, -4.5], [12.2, -4.5], [9.8, -3.8], [12.2, -3.8]].forEach(([x, z]) => B.add(M.metal, boxB(x - 0.03, x + 0.03, 0, 0.74, z - 0.03, z + 0.03)));
  [10.1, 11, 11.9].forEach((x) => [-5.25, -3.05].forEach((z) => {
    const seat = new RoundedBoxGeometry(0.5, 0.06, 0.5, 2, 0.02); seat.translate(x, 0.45, z); B.add(M.fabric, worldUV(seat, 0.5));
    const back = new RoundedBoxGeometry(0.5, 0.42, 0.05, 2, 0.02); back.translate(x, 0.7, z + (z < -4 ? -0.24 : 0.24)); B.add(M.teak, worldUV(back, 0.8));
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([dx, dz]) => B.add(M.metal, boxB(x + dx - 0.015, x + dx + 0.015, 0, 0.45, z + dz - 0.015, z + dz + 0.015)));
  }));

  // bornes lumineuses le long de l'allée
  for (let i = 0; i < 4; i++) {
    B.add(M.metal, boxB(-10.2, -10.05, 0, 0.55, 8 + i * 1.8, 8.15 + i * 1.8));
    B.add(M.lampGlow, boxB(-10.19, -10.06, 0.42, 0.5, 8.01 + i * 1.8, 8.14 + i * 1.8));
  }

  // grands pots (terre cuite + pierre)
  const pot = (x, z, r, h, mat) => {
    const pts = [new THREE.Vector2(r * 0.7, 0), new THREE.Vector2(r, h * 0.85), new THREE.Vector2(r * 1.05, h), new THREE.Vector2(r * 0.95, h)];
    const lathe = new THREE.LatheGeometry(pts, 28); lathe.translate(x, 0, z);
    B.add(mat, worldUV(lathe, 0.7));
    const soil = new THREE.CircleGeometry(r * 0.94, 24); soil.rotateX(-Math.PI / 2); soil.translate(x, h - 0.06, z);
    B.add(M.soil, worldUV(soil));
  };
  pot(7.6, -6.6, 0.45, 0.9, M.planterStone); pot(-7.6, -6.9, 0.45, 0.9, M.planterStone); pot(14.1, -1.0, 0.38, 0.75, M.terracotta);

  B.build(g);

  // ---------- Végétation ----------
  const olive = new Cards(sway(M.olive, 0.05), 0.75);
  const cypress = new Cards(sway(M.cypress, 0.03), 0.62);
  const shrub = new Cards(sway(M.shrub, 0.03), 0.55);
  const pitto = new Cards(sway(M.pittosporum, 0.03), 0.5);
  const lav = new Cards(sway(M.lavender, 0.08), 0.62, true);
  const tuft = new Cards(sway(M.tuft, 0.1), 0.9, true);
  const trunks = new Batch();

  // Olivier : tronc tortueux + charpentières + houppier en grappes
  const oliveTree = (x, z, s, seed) => {
    const r = rng(seed);
    const base = new THREE.Vector3(x, 0, z);
    const trunkPts = [base.clone()];
    let p = base.clone();
    for (let i = 1; i <= 4; i++) { p = p.clone().add(new THREE.Vector3((r() - 0.5) * 0.5 * s, 0.45 * s, (r() - 0.5) * 0.5 * s)); trunkPts.push(p); }
    const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 24, 0.2 * s, 10, false);
    const tp = trunk.attributes.position; // épaississement à la base
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = 1 + Math.max(0, 0.9 - y) * 0.6; tp.setX(i, x + (tp.getX(i) - x) * k); tp.setZ(i, z + (tp.getZ(i) - z) * k); }
    trunk.computeVertexNormals();
    trunks.add(M.bark, worldUV(trunk, 0.8));
    const top = trunkPts[trunkPts.length - 1];
    const nb = 5;
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * Math.PI * 2 + r() * 0.8;
      const len = (1.1 + r() * 0.9) * s;
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * len, (0.6 + r() * 0.8) * s, Math.sin(a) * len));
      const mid = top.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.25 * s, 0));
      trunks.add(M.bark, worldUV(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top, mid, end]), 10, 0.08 * s, 6, false), 0.8));
      // grappe de feuillage à l'extrémité
      const n = Math.round(130 * leafK * s);
      for (let i = 0; i < n; i++) {
        const u = new THREE.Vector3(r() - 0.5, (r() - 0.35) * 0.7, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * 1.25 * s);
        const col = new THREE.Color().setHSL(0.19 + r() * 0.05, 0.16 + r() * 0.1, 0.62 + r() * 0.2);
        olive.add(end.clone().add(u), 0.8 + r() * 0.5, col);
      }
    }
  };
  // (la caméra orbite à ~20–27 m du centre (0.5, -3) : les arbres hauts sont soit en deçà de 17 m, soit au-delà de 30 m)
  oliveTree(-7, 11, 1.25, 11); oliveTree(22, 18, 1.15, 23); oliveTree(-15, 1.5, 1.15, 37); oliveTree(13.2, -12.2, 1.0, 41); oliveTree(-3, 13.2, 0.9, 53);
  oliveTree(-24, 22, 1.2, 61); oliveTree(26, -20, 1.1, 67);

  // Cyprès de Provence (fuseau dense)
  const cypressTree = (x, z, h, seed) => {
    const r = rng(seed);
    const core = new THREE.CylinderGeometry(0.05, 0.4, h * 0.9, 8); core.translate(x, h * 0.45, z);
    trunks.add(coreCypress, worldUV(core));
    const n = Math.round(260 * leafK * (h / 8));
    for (let i = 0; i < n; i++) {
      const t = Math.pow(r(), 0.85);
      const rad = 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)) * (1 - t * 0.35) * (h / 8);
      const a = r() * Math.PI * 2, rr = rad * (0.55 + r() * 0.45);
      const col = new THREE.Color().setHSL(0.27 + r() * 0.04, 0.35, 0.22 + r() * 0.12);
      cypress.add(new THREE.Vector3(x + Math.cos(a) * rr, 0.3 + t * h, z + Math.sin(a) * rr), 0.9 + r() * 0.5, col);
    }
  };
  for (let i = 0; i < 7; i++) cypressTree(-31, -20 + i * 5.5, 8.5 + R() * 3, 100 + i);
  for (let i = 0; i < 4; i++) cypressTree(31, -18 + i * 6, 8.5 + R() * 3, 150 + i);
 cypressTree(-14, -44, 10, 205); cypressTree(12, -45, 9.5, 206);

  // Arbustes en boule (pittosporum / buis) et massifs
  const bush = (x, z, rad, cards, seed, n = 90) => {
    const r = rng(seed);
    const core = new THREE.SphereGeometry(rad * 0.75, 12, 8); core.scale(1, 0.8, 1); core.translate(x, rad * 0.62, z);
    trunks.add(cards === pitto ? corePitto : coreShrub, worldUV(core));
    for (let i = 0; i < n * leafK; i++) {
      const u = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.1, r() - 0.5).normalize().multiplyScalar(rad * (0.7 + r() * 0.35));
      const col = new THREE.Color().setHSL(0.24 + r() * 0.05, 0.3, 0.3 + r() * 0.15);
      cards.add(new THREE.Vector3(x + u.x, rad * 0.62 + u.y * 0.8, z + u.z), 0.8 + r() * 0.4, col);
    }
  };
  [[-12.8, -6.4], [-12.9, -4.2], [-13.6, -2.1], [15.6, -6.8], [15.2, -4.4], [9, -16.9], [6.4, -17.1], [-6, -17.2], [-9.4, -17]].forEach(([x, z], i) => bush(x, z, 0.55 + (i % 3) * 0.12, i % 2 ? pitto : shrub, 300 + i));
  [[-10.5, 13], [-7, 13.8], [12.4, 10.6], [8.8, 14.6]].forEach(([x, z], i) => bush(x, z, 0.8, pitto, 400 + i, 130));

  // Lavandes (bordure sud de la terrasse) et graminées
  // massif de lavandes en quinconce (sud-ouest), hauteurs et teintes irrégulières
  for (let x = -11.2; x < -3.4; x += 0.55) {
    if (x > -9.8 && x < -8.2) continue; // passage de l'allée
    for (let row = 0; row < 3; row++) {
      if (R() < 0.12) continue;
      const px = x + (R() - 0.5) * 0.25 + (row % 2) * 0.27, pz = 7.35 + row * 0.5 + (R() - 0.5) * 0.15;
      const s = 0.6 + R() * 0.45;
      for (let k = 0; k < 3; k++) {
        const col = new THREE.Color().setHSL(0.71 + R() * 0.05, 0.12 + R() * 0.1, 0.7 + R() * 0.2);
        lav.add(new THREE.Vector3(px + (R() - 0.5) * 0.18, 0.31 * s, pz + (R() - 0.5) * 0.18), s * (0.85 + R() * 0.25), col);
      }
    }
  }
  for (let x = 6.9; x < 14.2; x += 0.42) {
    const s = 0.5 + R() * 0.35;
    tuft.add(new THREE.Vector3(x + (R() - 0.5) * 0.15, 0.48 + s * 0.45, 7.25 + (R() - 0.5) * 0.2), s, new THREE.Color().setHSL(0.12 + R() * 0.04, 0.25 + R() * 0.15, 0.62 + R() * 0.2));
  }
  for (let i = 0; i < 26; i++) tuft.add(new THREE.Vector3(-16 + R() * 3.2, 0.4, -14 + R() * 20), 0.7 + R() * 0.3, new THREE.Color().setHSL(0.12, 0.3, 0.7 + R() * 0.15));

  // Rochers décoratifs
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.DodecahedronGeometry(0.35 + R() * 0.35, 1);
    const rp = rock.attributes.position;
    for (let k = 0; k < rp.count; k++) rp.setY(k, rp.getY(k) * 0.6);
    rock.computeVertexNormals();
    rock.translate(-16 + R() * 3, 0.1, -12 + i * 2.8 + R());
    trunks.add(M.stone, worldUV(rock, 1.5));
  }

  trunks.build(g);
  [olive, cypress, shrub, pitto, lav, tuft].forEach((c) => c.build(g));

  // ---------- Herbe instanciée (pelouse sud, est et ouest) ----------
  if (q.grass > 0) {
    const blade = new THREE.PlaneGeometry(0.03, 0.11, 1, 3);
    blade.translate(0, 0.055, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y / 0.12)); }
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wind.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float w = sin(uTime * 1.8 + ip.x * 0.6 + ip.z * 0.4) * 0.5 + sin(uTime * 3.1 + ip.x * 1.7) * 0.2;
          transformed.x += w * position.y * 0.35;
          transformed.z += w * position.y * 0.2;`);
    };
    mat.customProgramCacheKey = () => 'grassblades';
    const count = q.grass;
    const mesh = new THREE.InstancedMesh(blade, mat, count);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
    let i = 0, guard = 0;
    while (i < count && guard++ < count * 4) {
      const x = -23 + R() * 46, z = -22 + R() * 44.5;
      const onTerrace = x > -11.7 && x < 14.7 && z > -7.7 && z < 7.7;
      const onVilla = x > -12.6 && x < 9 && z < -4.8;
      const onBeds = (z > 21 && z < 22.5) || (x < -12.3 && z < 7) || (z < -16.2);
      if (onTerrace || onVilla || onBeds) continue;
      ps.set(x, 0, z);
      qq.setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * Math.PI, (R() - 0.5) * 0.5));
      const h = 0.6 + R() * 0.8; sc.set(1, h, 1);
      m4.compose(ps, qq, sc); mesh.setMatrixAt(i, m4);
      col.setHSL(0.21 + R() * 0.05, 0.4 + R() * 0.15, 0.13 + R() * 0.09); mesh.setColorAt(i, col);
      i++;
    }
    mesh.count = i; mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
    g.add(mesh);
  }

  return g;
}
