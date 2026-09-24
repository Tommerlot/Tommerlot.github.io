/**
 * Piscine 12 × 5 m : cuve en mosaïque perle (caustiques animées), escalier d'angle,
 * margelles en pierre à bord arrondi, projecteurs immergés, eau à réfraction réelle.
 * Terrasse en dalles travertin découpée autour du bassin.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxB, worldUV, Batch, WATER_LEVEL } from './materials.js';

export const POOL = { x0: -6, x1: 6, z0: -2.5, z1: 2.5, depth: 1.45 };

export function buildPool(M) {
  const g = new THREE.Group(); g.name = 'pool';
  const B = new Batch();
  const { x0, x1, z0, z1, depth } = POOL;
  const floorY = -depth;

  // ---------- Terrasse (dalle percée par le bassin) ----------
  const T = { x0: -11.5, x1: 14.5, z0: -7.5, z1: 6.8 };
  const shape = new THREE.Shape();
  shape.moveTo(T.x0, T.z0); shape.lineTo(T.x1, T.z0); shape.lineTo(T.x1, T.z1); shape.lineTo(T.x0, T.z1); shape.closePath();
  // trou légèrement plus grand que la cuve : évite deux faces superposées (scintillement) sous la margelle
  const e = 0.03;
  const hole = new THREE.Path();
  hole.moveTo(x0 - e, z0 - e); hole.lineTo(x0 - e, z1 + e); hole.lineTo(x1 + e, z1 + e); hole.lineTo(x1 + e, z0 - e); hole.closePath();
  shape.holes.push(hole);
  const terr = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
  terr.rotateX(Math.PI / 2); // extrusion vers le bas : dessus à y = 0
  terr.computeVertexNormals();
  // ExtrudeGeometry après rotation : z du shape → -z monde ; on remet dans le bon sens
  terr.scale(1, 1, 1);
  B.add(M.terrace, worldUV(terr, 2.4));
  // nez de marche de la terrasse vers le jardin (côté sud)
  B.add(M.coping, boxB(T.x0, T.x1, -0.35, 0.02, T.z1, T.z1 + 0.06, 1.2));

  // ---------- Cuve ----------
  B.add(M.poolTile, boxB(x0, x1, floorY - 0.2, floorY, z0, z1, 1.25));           // fond
  B.add(M.poolTile, boxB(x0 - 0.25, x0, floorY - 0.2, 0, z0 - 0.25, z1 + 0.25, 1.25)); // parois
  B.add(M.poolTile, boxB(x1, x1 + 0.25, floorY - 0.2, 0, z0 - 0.25, z1 + 0.25, 1.25));
  B.add(M.poolTile, boxB(x0, x1, floorY - 0.2, 0, z0 - 0.25, z0, 1.25));
  B.add(M.poolTile, boxB(x0, x1, floorY - 0.2, 0, z1, z1 + 0.25, 1.25));
  // escalier d'angle sur toute la largeur (côté ouest) : 3 marches + banquette
  const steps = [[-0.36, 0.45], [-0.72, 0.9], [-1.08, 1.35]];
  steps.forEach(([top, run]) => B.add(M.poolTile, boxB(x0, x0 + run, floorY, top, z0, z0 + 2.2, 1.25)));
  B.add(M.poolTile, boxB(x0 + 0.01, x1 - 0.01, floorY, -0.62, z1 - 0.45, z1, 1.25)); // banquette immergée côté sud
  // ligne d'eau : frise de carreaux plus sombres
  const frise = M.poolTile.clone(); frise.color = new THREE.Color(0xb9c9c8);
  B.add(frise, boxB(x0 - 0.001, x1 + 0.001, -0.22, -0.02, z0 - 0.001, z0 + 0.002, 1.25));
  B.add(frise, boxB(x0 - 0.001, x1 + 0.001, -0.22, -0.02, z1 - 0.002, z1 + 0.001, 1.25));
  B.add(frise, boxB(x1 - 0.002, x1 + 0.001, -0.22, -0.02, z0, z1, 1.25));

  // ---------- Margelles (bord arrondi, léger débord) ----------
  const cw = 0.42, over = 0.04, ct = 0.06;
  const coping = (cx0, cx1, cz0, cz1) => {
    const w = cx1 - cx0, d = cz1 - cz0;
    const geo = new RoundedBoxGeometry(w, ct, d, 2, 0.02);
    geo.translate((cx0 + cx1) / 2, ct / 2 - 0.005, (cz0 + cz1) / 2);
    return B.add(M.coping, worldUV(geo, 1.2));
  };
  coping(x0 - cw, x1 + cw, z0 - cw, z0 + over);
  coping(x0 - cw, x1 + cw, z1 - over, z1 + cw);
  coping(x0 - cw, x0 + over, z0 + over, z1 - over);
  coping(x1 - over, x1 + cw, z0 + over, z1 - over);

  // ---------- Projecteurs immergés ----------
  [-3, 0, 3].forEach((x) => {
    const l = new THREE.CircleGeometry(0.11, 24); l.translate(x, -0.55, z0 + 0.005);
    B.add(M.poolLight, worldUV(l));
    const r = new THREE.RingGeometry(0.11, 0.14, 24); r.translate(x, -0.55, z0 + 0.004);
    B.add(M.metalLight, worldUV(r));
  });

  B.build(g);

  // ---------- Eau ----------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.02, z1 - z0 + 0.02, 1, 1), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_LEVEL, 0);
  water.geometry.attributes.uv.array.forEach((_, i, a) => { a[i] *= i % 2 === 0 ? 3.0 : 1.25; });
  water.receiveShadow = true;
  water.name = 'water';
  g.add(water);

  return { group: g, water };
}
