/**
 * Bibliothèque de matériaux PBR de la scène + utilitaires géométriques.
 * Les UV sont calculées en mètres (projection planaire par face) : densité de texture
 * constante sur tous les objets, sans étirement.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

export const WATER_LEVEL = -0.1;

// ---------- Géométrie ----------
/** Recalcule les UV d'une géométrie en coordonnées monde (mètres / taille du motif). */
export function worldUV(geo, tile = 1, offset = 0) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / tile + offset; uv[i * 2 + 1] = v / tile + offset;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Boîte positionnée par ses bornes (xmin..xmax, ymin..ymax, zmin..zmax). */
export function boxB(x0, x1, y0, y1, z0, z1, tile = 1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g, tile);
}

/** Regroupe des géométries par matériau en un seul mesh (moins d'appels de dessin). */
export class Batch {
  constructor() { this.items = new Map(); }
  add(material, geo) { if (!this.items.has(material)) this.items.set(material, []); this.items.get(material).push(geo); return geo; }
  build(parent, { cast = true, receive = true } = {}) {
    for (const [mat, geos] of this.items) {
      const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast && !mat.userData.noShadow; m.receiveShadow = receive;
      parent.add(m);
      geos.forEach((g) => g.dispose());
    }
    this.items.clear();
  }
}

// ---------- Shaders additionnels ----------
const CAUSTIC_GLSL = /* glsl */`
  float causticLayer(vec2 p, float t) {
    vec2 i = p; float c = 1.0; float inten = .005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0; c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }
  float caustics(vec3 wp, float t) {
    vec2 p = mod(wp.xz * 0.85 + wp.y * 0.35, 6.28318) - 250.0;
    return causticLayer(p, t * 0.55) * 0.65 + causticLayer(p * 1.3 + 17.0, t * 0.45) * 0.35;
  }
`;

/** Ajoute des caustiques animées sous le niveau de l'eau. */
function withCaustics(mat, uniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCaustic = uniforms.uCaustic;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uCaustic;\n${CAUSTIC_GLSL}`)
      .replace('#include <dithering_fragment>', `
        float under = smoothstep(${WATER_LEVEL.toFixed(2)} + 0.02, ${WATER_LEVEL.toFixed(2)} - 0.15, vWPos.y);
        float depthFade = clamp(1.0 - (${WATER_LEVEL.toFixed(2)} - vWPos.y) * 0.28, 0.35, 1.0);
        float cst = caustics(vWPos, uTime);
        gl_FragColor.rgb *= mix(1.0, 0.9, under);
        gl_FragColor.rgb += vec3(0.85, 0.97, 1.0) * cst * uCaustic * under * depthFade;
        #include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => 'caustics';
  return mat;
}

/** Casse la répétition d'une texture : second échantillonnage à grande échelle + modulation. */
function antiTile(mat, macroScale = 0.137) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texA = texture2D(map, vMapUv);
        vec4 texB = texture2D(map, vMapUv * ${macroScale} + vec2(0.31, 0.77));
        vec4 texC = texture2D(map, vMapUv * 0.031 + vec2(0.5, 0.2));
        float k = smoothstep(0.35, 0.65, texC.g * 1.6 - 0.2);
        vec4 sampledDiffuseColor = mix(texA, texB, 0.45);
        sampledDiffuseColor.rgb *= mix(0.86, 1.12, k);
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  mat.customProgramCacheKey = () => `antitile${macroScale}`;
  return mat;
}

// ---------- Bibliothèque ----------
export async function createMaterials(q) {
  const S = q.texSize, s2 = Math.max(256, S / 2);
  // Affichage rapide : première passe en 512 px maximum (4× moins de calcul), puis les 5 grandes surfaces
  // passent en pleine définition en arrière-plan (M.upgradeTextures, appelé après le premier rendu).
  const S0 = Math.min(S, 512);
  const uniforms = { uTime: { value: 0 }, uCaustic: { value: 1.25 } };

  // Les textures sont calculées en arrière-plan ; en attendant, les matériaux utilisent des textures provisoires
  // (la scène et ses shaders se préparent en même temps). M.texturesReady : toutes les vraies images en place.
  const pending = [
    T.travertine(S0, 3, 0xc9bca6), T.travertine(s2, 5, 0xdcd2c0), T.mosaic(S0), T.plaster(s2), T.concrete(s2),
    T.woodSlats(s2), T.stoneWall(S0), T.grass(S0), T.gravel(s2), T.bark(256), T.fabric(256, 37, 0xece6d9), T.fabric(256, 39, 0x5b5e57),
    T.waterNormal(S0),
  ];
  const sets = pending.map(() => T.pbrPlaceholder());
  sets[12] = sets[12].normalMap; // normales de l'eau seules
  const [trav, coping, mos, plas, conc, wood, stone, grassT, grav, barkT, fab, fabDark, waterN] = sets;
  const swapTex = (old, fresh) => { old.image = fresh.image; old.dispose(); old.needsUpdate = true; };
  const fill = (old, fresh) => { if (old.isTexture) swapTex(old, fresh); else ['map', 'normalMap', 'roughnessMap'].forEach((k) => swapTex(old[k], fresh[k])); };
  const texturesReady = Promise.all(pending.map((p, i) => p.then((fresh) => fill(sets[i], fresh))));
  const aniso = 8;
  [trav, coping, mos, plas, conc, wood, stone, grassT, grav, barkT, fab, fabDark].forEach((set) => Object.values(set).forEach((t) => { t.anisotropy = aniso; }));

  const std = (set, o = {}) => new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0, ...o,
  });

  const M = {
    uniforms, texturesReady,
    terrace: std(trav, { color: 0xe2d8c8, normalScale: new THREE.Vector2(0.8, 0.8) }),
    coping: std(coping, { normalScale: new THREE.Vector2(0.9, 0.9) }),
    poolTile: withCaustics(std(mos, { normalScale: new THREE.Vector2(0.6, 0.6), color: 0xf2f6f5 }), uniforms),
    plaster: std(plas, { normalScale: new THREE.Vector2(0.35, 0.35) }),
    plasterShade: std(plas, { color: 0xe4ddd1, normalScale: new THREE.Vector2(0.35, 0.35) }),
    concrete: std(conc, { normalScale: new THREE.Vector2(0.5, 0.5) }),
    concreteDark: std(conc, { color: 0x8d8a84, normalScale: new THREE.Vector2(0.5, 0.5) }),
    wood: std(wood, { normalScale: new THREE.Vector2(1, 1) }),
    teak: std(wood, { color: 0xc49a74, normalScale: new THREE.Vector2(0.6, 0.6) }),
    stone: std(stone, { normalScale: new THREE.Vector2(1.3, 1.3) }),
    grass: antiTile(std(grassT, { normalScale: new THREE.Vector2(0.7, 0.7) })),
    gravel: std(grav, { normalScale: new THREE.Vector2(1, 1) }),
    bark: std(barkT, { normalScale: new THREE.Vector2(1.5, 1.5) }),
    fabric: std(fab),
    fabricDark: std(fabDark),
    metal: new THREE.MeshStandardMaterial({ color: 0x23272a, metalness: 0.75, roughness: 0.38 }),
    metalLight: new THREE.MeshStandardMaterial({ color: 0x9aa0a3, metalness: 0.9, roughness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x22323a, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.6,
      envMapIntensity: 5, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, ior: 1.52, depthWrite: false,
    }),
    balustrade: new THREE.MeshPhysicalMaterial({ color: 0xa9c4c6, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.18, envMapIntensity: 1.6, depthWrite: false }),
    interiorWall: new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.9, emissive: 0xffd8a8, emissiveIntensity: 0.08 }),
    interiorFloor: std(conc, { color: 0xd8d0c2, roughness: 0.55 }),
    sofa: std(fab, { color: 0xcfc6b6 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xfff2dc, emissive: 0xffe2b8, emissiveIntensity: 2.2 }),
    poolLight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbff4ff, emissiveIntensity: 1.2 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xa8674a, roughness: 0.85 }),
    planterStone: std(conc, { color: 0xcfc6b8 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 }),
  };
  M.glass.userData.noShadow = true;
  M.fabric.shadowSide = THREE.DoubleSide; // toile du parasol (cône ouvert)
  M.balustrade.userData.noShadow = true;

  // Eau : transmission physique (réfraction réelle du fond), reflets de l'environnement, double houle animée.
  waterN.anisotropy = aniso;
  const waterUniforms = { uWaveA: { value: new THREE.Vector2() }, uWaveB: { value: new THREE.Vector2() } };
  M.water = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.035, transmission: 1, thickness: 0.35, ior: 1.333,
    attenuationColor: new THREE.Color(0x1f95a0), attenuationDistance: 1.5,
    normalMap: waterN, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 2.4, specularIntensity: 1,
  });
  M.water.onBeforeCompile = (shader) => {
    shader.uniforms.uWaveA = waterUniforms.uWaveA;
    shader.uniforms.uWaveB = waterUniforms.uWaveB;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uWaveA;\nuniform vec2 uWaveB;')
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        `vec3 nA = texture2D( normalMap, vNormalMapUv + uWaveA ).xyz * 2.0 - 1.0;
         vec3 nB = texture2D( normalMap, vNormalMapUv * 1.83 + uWaveB ).xyz * 2.0 - 1.0;
         vec3 mapN = normalize( vec3( nA.xy + nB.xy * 0.7, nA.z * nB.z ) );`);
  };
  M.water.customProgramCacheKey = () => 'water2';
  M.waterUniforms = waterUniforms;

  // Feuillages (cartes alpha, double face, ombres découpées)
  const leafMat = (tex, color = 0xffffff, rough = 0.75) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color, roughness: rough, metalness: 0 });
    m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
    return m;
  };
  M.olive = leafMat(T.oliveLeaves(256, 43), 0xffffff, 0.7);
  M.cypress = leafMat(T.denseFoliage(256, 47, [40, 62, 36], [92, 118, 64]), 0xffffff, 0.85);
  M.shrub = leafMat(T.denseFoliage(256, 61, [40, 62, 34], [96, 120, 62]), 0xffffff, 0.8);
  M.pittosporum = leafMat(T.denseFoliage(256, 67, [58, 78, 48], [132, 148, 98]), 0xffffff, 0.8);
  M.lavender = leafMat(T.lavender(256, 53), 0xffffff, 0.9);
  M.tuft = leafMat(T.grassTuft(256, 59), 0xffffff, 0.9);

  // Passage en pleine définition, en arrière-plan : les nouvelles images remplacent les anciennes
  // dans les mêmes textures (aucun matériau à reconstruire), une surface à la fois pour rester fluide.
  M.upgradeTextures = async () => {
    if (S <= S0) { T.releaseWorkers(); return; }
    const jobs = [
      [trav, T.travertine(S, 3, 0xc9bca6)], [mos, T.mosaic(S)], [stone, T.stoneWall(S)], [grassT, T.grass(S)], [waterN, T.waterNormal(S)],
    ];
    for (const [old, pending] of jobs) {
      fill(old, await pending);
      await new Promise((r) => setTimeout(r, 50));
    }
    T.releaseWorkers();
  };
  return M;
}
