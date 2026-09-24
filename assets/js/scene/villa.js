/**
 * Villa contemporaine : rez-de-chaussée vitré, étage en porte-à-faux (enduit + bardage bois),
 * mur en pierre, toit-terrasse avec garde-corps verre, pergola bioclimatique, intérieurs éclairés.
 * Repère : piscine centrée en (0,0,0), villa au nord (z négatif), façade vitrée face au bassin.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxB, worldUV, Batch } from './materials.js';

export function buildVilla(M) {
  const g = new THREE.Group(); g.name = 'villa';
  const B = new Batch();
  const glass = new Batch();

  // ---------- Rez-de-chaussée ----------
  const GF = { x0: -11, x1: 8, z0: -16, z1: -7.5, h: 3.3 };
  // dalle de sol intérieure / soubassement
  B.add(M.concrete, boxB(GF.x0 - 0.2, GF.x1 + 0.2, -0.05, 0.12, GF.z0 - 0.2, GF.z1, 1.2));
  // murs arrière et latéraux
  // (le mur arrière s'arrête où commence le volume pierre : deux faces au même endroit = scintillement)
  B.add(M.plaster, boxB(-6.9, GF.x1, 0.12, GF.h, GF.z0, GF.z0 + 0.3, 2));
  B.add(M.plaster, boxB(GF.x1 - 0.35, GF.x1, 0.12, GF.h, GF.z0 + 0.3, GF.z1, 2));
  // volume pierre à gauche (légèrement en saillie sur toutes ses faces visibles)
  B.add(M.stone, boxB(GF.x0 - 0.3, -6.9, 0, GF.h + 0.3, GF.z0 - 0.06, GF.z1 + 0.35, 2.4));
  // pilier droit
  B.add(M.plaster, boxB(7.25, GF.x1, 0.12, GF.h, GF.z1 - 0.3, GF.z1 + 0.05, 2));

  // Baie vitrée coulissante du RDC (x -6.9 → 7.25)
  const gx0 = -6.9, gx1 = 7.25, gz = GF.z1 - 0.15;
  glass.add(M.glass, boxB(gx0, gx1, 0.12, GF.h - 0.05, gz - 0.02, gz + 0.02));
  // menuiseries aluminium sombre
  const mullions = 6;
  for (let i = 0; i <= mullions; i++) {
    const x = gx0 + ((gx1 - gx0) * i) / mullions;
    B.add(M.metal, boxB(x - 0.04, x + 0.04, 0.12, GF.h, gz - 0.06, gz + 0.06));
  }
  B.add(M.metal, boxB(gx0, gx1, 0.12, 0.18, gz - 0.07, gz + 0.07));
  B.add(M.metal, boxB(gx0, gx1, GF.h - 0.1, GF.h, gz - 0.07, gz + 0.07));

  // ---------- Intérieur visible (profondeur + chaleur) ----------
  B.add(M.interiorFloor, boxB(gx0, gx1, 0.1, 0.14, GF.z0 + 0.3, gz, 1.5));
  B.add(M.interiorWall, boxB(gx0, gx1, 0.14, GF.h, -12.6, -12.4, 2));             // mur de fond
  B.add(M.interiorWall, boxB(gx0, gx0 + 0.2, 0.14, GF.h, -12.4, gz, 2));
  B.add(M.plasterShade, boxB(gx0, gx1, GF.h - 0.12, GF.h, -12.4, gz, 2));          // plafond
  // plafond bois
  B.add(M.wood, boxB(gx0, gx1, GF.h - 0.16, GF.h - 0.12, -12.4, gz - 0.1, 1.2));
  // canapé d'angle, table basse, buffet, suspension
  const sofaGeo = (x, z, w, d) => { const s = new RoundedBoxGeometry(w, 0.42, d, 3, 0.06); s.translate(x, 0.35, z); return worldUV(s, 0.6); };
  B.add(M.sofa, sofaGeo(-2.2, -11.6, 3.6, 0.95));
  B.add(M.sofa, sofaGeo(-0.1, -10.9, 0.95, 2.3));
  { const b = new RoundedBoxGeometry(3.6, 0.45, 0.25, 3, 0.05); b.translate(-2.2, 0.72, -12.05); B.add(M.sofa, worldUV(b, 0.6)); }
  B.add(M.teak, boxB(-3, -1.4, 0.14, 0.42, -10.6, -9.8, 0.8));
  B.add(M.concreteDark, boxB(2.2, 5.6, 0.14, 0.9, -12.35, -11.9, 1));
  { const l = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32); l.translate(-2.2, 2.6, -10.3); B.add(M.lampGlow, worldUV(l)); }
  { const l = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32); l.translate(3.8, 2.6, -10.3); B.add(M.lampGlow, worldUV(l)); }
  // grande plante d'intérieur
  { const p = new THREE.CylinderGeometry(0.28, 0.22, 0.6, 24); p.translate(6.3, 0.44, -11.9); B.add(M.concreteDark, worldUV(p)); }

  // ---------- Dalle intermédiaire + étage en porte-à-faux ----------
  const UF = { x0: -12, x1: 5, z0: -16.5, z1: -5, y0: 3.3, y1: 6.5 };
  B.add(M.plaster, boxB(UF.x0, UF.x1, UF.y0, UF.y0 + 0.35, UF.z0, UF.z1, 2));          // dalle
  B.add(M.wood, boxB(UF.x0 + 0.05, UF.x1 - 0.05, UF.y0 - 0.03, UF.y0, GF.z1, UF.z1 - 0.05, 1.2)); // sous-face bois
  // murs de l'étage
  B.add(M.plaster, boxB(UF.x0, UF.x1, UF.y0 + 0.35, UF.y1, UF.z0, UF.z0 + 0.3, 2));
  B.add(M.plaster, boxB(UF.x0, UF.x0 + 0.3, UF.y0 + 0.35, UF.y1, UF.z0, UF.z1, 2));
  // façade étage côté piscine : allège + bandeau + fenêtre filante
  const wy0 = 4.15, wy1 = 5.95, wx0 = -10.6, wx1 = 1.1, fz = UF.z1;
  B.add(M.plaster, boxB(UF.x0, UF.x1, UF.y0 + 0.35, wy0, fz - 0.3, fz, 2));
  B.add(M.plaster, boxB(UF.x0, UF.x1, wy1, UF.y1, fz - 0.3, fz, 2));
  B.add(M.plaster, boxB(UF.x0, wx0, wy0, wy1, fz - 0.3, fz, 2));
  // bardage bois vertical sur la partie droite de l'étage
  B.add(M.wood, boxB(wx1, UF.x1, UF.y0 + 0.35, UF.y1, fz - 0.3, fz + 0.04, 1.6));
  B.add(M.wood, boxB(UF.x1 - 0.04, UF.x1 + 0.02, UF.y0 + 0.35, UF.y1, UF.z0, fz, 1.6));
  // tableaux (épaisseur de la fenêtre) + vitrage en retrait
  B.add(M.metal, boxB(wx0, wx1, wy0, wy0 + 0.05, fz - 0.55, fz - 0.05));
  B.add(M.metal, boxB(wx0, wx1, wy1 - 0.05, wy1, fz - 0.55, fz - 0.05));
  glass.add(M.glass, boxB(wx0, wx1, wy0 + 0.05, wy1 - 0.05, fz - 0.5, fz - 0.46));
  for (let i = 0; i <= 5; i++) { const x = wx0 + ((wx1 - wx0) * i) / 5; B.add(M.metal, boxB(x - 0.035, x + 0.035, wy0, wy1, fz - 0.52, fz - 0.44)); }
  B.add(M.interiorWall, boxB(wx0, wx1, UF.y0 + 0.35, UF.y1 - 0.1, -8.6, -8.4, 2));
  // toiture de l'étage + acrotère
  B.add(M.plaster, boxB(UF.x0 - 0.05, UF.x1 + 0.05, UF.y1, UF.y1 + 0.28, UF.z0 - 0.05, UF.z1 + 0.05, 2));
  B.add(M.concreteDark, boxB(UF.x0 + 0.3, UF.x1 - 0.3, UF.y1 + 0.28, UF.y1 + 0.3, UF.z0 + 0.3, UF.z1 - 0.3, 2));

  // Toit-terrasse du RDC côté droit (au-dessus de x 5 → 8) + garde-corps verre
  B.add(M.plaster, boxB(UF.x1, GF.x1 + 0.1, GF.h, GF.h + 0.35, GF.z0, GF.z1 + 0.1, 2));
  B.add(M.terrace, boxB(UF.x1, GF.x1, GF.h + 0.35, GF.h + 0.38, GF.z0 + 0.1, GF.z1, 1.2));
  glass.add(M.balustrade, boxB(UF.x1, GF.x1, GF.h + 0.38, GF.h + 1.4, GF.z1 - 0.06, GF.z1 - 0.02));
  glass.add(M.balustrade, boxB(GF.x1 - 0.06, GF.x1 - 0.02, GF.h + 0.38, GF.h + 1.4, GF.z0 + 0.1, GF.z1));
  B.add(M.metalLight, boxB(UF.x1, GF.x1, GF.h + 1.38, GF.h + 1.42, GF.z1 - 0.07, GF.z1 - 0.01));

  // ---------- Façade arrière et côtés : ouvertures ----------
  const backGlass = (x0, x1, y0, y1) => {
    glass.add(M.glass, boxB(x0, x1, y0, y1, GF.z0 - 0.02, GF.z0 + 0.02));
    B.add(M.metal, boxB(x0 - 0.05, x1 + 0.05, y0 - 0.05, y0, GF.z0 - 0.05, GF.z0 + 0.05));
    B.add(M.metal, boxB(x0 - 0.05, x1 + 0.05, y1, y1 + 0.05, GF.z0 - 0.05, GF.z0 + 0.05));
    B.add(M.metal, boxB(x0 - 0.05, x0, y0, y1, GF.z0 - 0.05, GF.z0 + 0.05));
    B.add(M.metal, boxB(x1, x1 + 0.05, y0, y1, GF.z0 - 0.05, GF.z0 + 0.05));
  };
  backGlass(-5.5, -4.9, 0.3, 2.9); backGlass(-3.8, -3.2, 0.3, 2.9); backGlass(3.2, 6.6, 0.9, 2.9);
  // porte d'entrée pivotante en bois + auvent
  B.add(M.wood, boxB(-0.9, 0.6, 0.12, 2.8, GF.z0 - 0.08, GF.z0 + 0.02, 1.2));
  B.add(M.metal, boxB(0.35, 0.4, 1.1, 1.9, GF.z0 - 0.14, GF.z0 - 0.08));
  B.add(M.plaster, boxB(-1.8, 1.5, 2.95, 3.1, GF.z0 - 1.4, GF.z0, 2));
  // fenêtres étage arrière
  const upBack = (x0, x1) => {
    glass.add(M.glass, boxB(x0, x1, 4.3, 5.9, UF.z0 - 0.02, UF.z0 + 0.02));
    B.add(M.metal, boxB(x0 - 0.05, x1 + 0.05, 4.25, 4.3, UF.z0 - 0.05, UF.z0 + 0.05));
    B.add(M.metal, boxB(x0 - 0.05, x1 + 0.05, 5.9, 5.95, UF.z0 - 0.05, UF.z0 + 0.05));
  };
  upBack(-9.5, -6.5); upBack(-4.2, -3.4); upBack(-2.2, 1.8);
  // côté est du RDC : baie + côté ouest de l'étage : fenêtre verticale
  glass.add(M.glass, boxB(GF.x1 - 0.02, GF.x1 + 0.02, 0.3, 2.9, -13.6, -9.4));
  B.add(M.metal, boxB(GF.x1 - 0.05, GF.x1 + 0.05, 0.25, 0.3, -13.65, -9.35));
  B.add(M.metal, boxB(GF.x1 - 0.05, GF.x1 + 0.05, 2.9, 2.95, -13.65, -9.35));
  glass.add(M.glass, boxB(UF.x0 - 0.02, UF.x0 + 0.02, 3.9, 6.0, -12.5, -11.3));

  // ---------- Pergola bioclimatique (côté est de la terrasse) ----------
  const P = { x0: 8.6, x1: 13.4, z0: -6.8, z1: -1.4, h: 2.75 };
  [[P.x0, P.z0], [P.x1, P.z0], [P.x0, P.z1], [P.x1, P.z1]].forEach(([x, z]) => B.add(M.metal, boxB(x - 0.08, x + 0.08, 0, P.h, z - 0.08, z + 0.08)));
  B.add(M.metal, boxB(P.x0 - 0.08, P.x1 + 0.08, P.h - 0.22, P.h, P.z0 - 0.08, P.z0 + 0.08));
  B.add(M.metal, boxB(P.x0 - 0.08, P.x1 + 0.08, P.h - 0.22, P.h, P.z1 - 0.08, P.z1 + 0.08));
  B.add(M.metal, boxB(P.x0 - 0.08, P.x0 + 0.08, P.h - 0.22, P.h, P.z0, P.z1));
  B.add(M.metal, boxB(P.x1 - 0.08, P.x1 + 0.08, P.h - 0.22, P.h, P.z0, P.z1));
  for (let z = P.z0 + 0.3; z < P.z1 - 0.1; z += 0.3) {
    const lame = new THREE.BoxGeometry(P.x1 - P.x0, 0.03, 0.2);
    lame.rotateX(-0.55); lame.translate((P.x0 + P.x1) / 2, P.h - 0.1, z);
    B.add(M.metalLight, worldUV(lame));
  }

  B.build(g);
  glass.build(g, { cast: false, receive: false });
  g.traverse((o) => { if (o.isMesh && (o.material === M.glass || o.material === M.balustrade)) o.renderOrder = 2; });
  return g;
}
