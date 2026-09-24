/**
 * Scène 3D du Hero : villa + piscine + jardin, caméra en orbite de 360° pilotée par le scroll.
 * Rendu : PBR, ciel physique (Sky) servant aussi d'éclairage d'environnement (IBL),
 * soleil avec ombres douces, occlusion ambiante (GTAO) et grain photo sur les appareils puissants.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { detectQuality } from './quality.js';
import { createMaterials } from './materials.js';
import { buildVilla } from './villa.js';
import { buildPool } from './pool.js';
import { buildGarden, wind } from './garden.js';

// Soleil : après-midi, lumière rasante latérale depuis le sud-ouest (élévation / azimut en degrés,
// azimut mesuré depuis +z vers +x ; la façade vitrée regarde +z)
const SUN = { elevation: 30, azimuth: 64 };

/** Dôme de ciel dégradé (zénith bleu profond → horizon clair) avec halo solaire. */
function makeSkyDome(sunDir, radius, gain = 1) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone() }, uGain: { value: gain } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }',
    fragmentShader: `uniform vec3 uSun; uniform float uGain; varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 zenith = vec3(0.12, 0.30, 0.62);
        vec3 mid = vec3(0.30, 0.52, 0.80);
        vec3 horizon = vec3(0.70, 0.79, 0.85);
        vec3 ground = vec3(0.42, 0.40, 0.33);
        vec3 c = y > 0.0 ? mix(horizon, mix(mid, zenith, smoothstep(0.2, 0.85, y)), smoothstep(0.0, 0.22, y)) : mix(horizon, ground, smoothstep(0.0, -0.08, y));
        float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
        c += vec3(1.0, 0.92, 0.78) * (pow(s, 12.0) * 0.35 + pow(s, 900.0) * 6.0);
        gl_FragColor = vec4(c * uGain, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.frustumCulled = false;
  return m;
}

/** Trajectoire caméra : p ∈ [0,1] → position + cible. Départ au sud, face à la villa, tour complet. */
const THETA0 = 0.52; // départ en vue de trois-quarts (sud-est) : villa + bassin dans le même cadre
function cameraPose(p, aspect, out) {
  const theta = THETA0 + p * Math.PI * 2;
  const back = (1 - Math.cos(theta)) / 2;            // 0 devant la villa, 1 derrière
  const portrait = aspect < 0.9;
  const R = (portrait ? 21 : 20.5) + back * 12;
  const h = 3.0 + back * 5.5 + Math.sin(theta * 2) * 0.25 + (portrait ? 1.8 : 0);
  const cx = 0.5, cz = -4;
  out.pos.set(cx + Math.sin(theta) * R, h, cz + Math.cos(theta) * R);
  if (portrait) {
    // Téléphone : caméra plus proche et inclinée vers le bassin → villa et piscine dans le haut de l'écran,
    // au-dessus du texte (au lieu d'un grand ciel vide)
    out.target.set(Math.sin(theta) * 1.2, -2.2 + back * 3.6, -0.5 - back * 9.5);
  } else {
    out.target.set(Math.sin(theta) * 1.2, 0.9 + back * 2.2, -3.2 - back * 7);
  }
  return out;
}

const GrainVignetteShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVignette: { value: 0.22 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVignette * 2.2;
      c.rgb *= v; c.rgb += (h(vUv * 1000.0) - 0.5) * uGrain; gl_FragColor = c; }`,
};

export async function createScene(container, { reducedMotion = false } = {}) {
  const q = detectQuality();

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !q.ao, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.2, 1400);

  // ---------- Ciel + environnement ----------
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - SUN.elevation), THREE.MathUtils.degToRad(SUN.azimuth));
  const sky = makeSkyDome(sunDir, 1000); // doit rester dans le plan lointain de la caméra
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  // (le PMREM capture jusqu'à 100 m : ciel et sol de l'environnement doivent tenir dans ce rayon)
  envScene.add(makeSkyDome(sunDir, 90, 1.25));
  // sol chaud dans l'environnement pour des reflets réalistes (rebond de lumière)
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(80, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6f6a58 }));
  envGround.position.y = -1.5; envScene.add(envGround);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();

  scene.fog = new THREE.Fog(new THREE.Color(0xb9cad3), 120, 640);

  // ---------- Lumières ----------
  const sun = new THREE.DirectionalLight(0xffecd4, 4.8);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.target.position.set(0, 0, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  const sc = sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 20; sc.far = 160;
  sc.updateProjectionMatrix();
  // (carte d'ombre moins précise sur mobile → décalages plus forts pour éviter les « anneaux » sur les grandes surfaces)
  const coarse = q.shadowSize < 2048;
  sun.shadow.bias = coarse ? -0.0009 : -0.0003; sun.shadow.normalBias = coarse ? 0.09 : 0.03; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xcfe0ee, 0x6b6450, 0.15));

  // ---------- Contenu ----------
  performance.mark('abast:3d-debut');
  const M = await createMaterials(q);
  performance.mark('abast:3d-textures');
  scene.add(buildVilla(M));
  const { group: poolGroup } = buildPool(M);
  scene.add(poolGroup);
  scene.add(buildGarden(M, q));
  performance.mark('abast:3d-geometrie');

  // ---------- Post-traitement ----------
  let composer = null, grainPass = null;
  const setupComposer = () => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    if (q.ao) {
      const ao = new GTAOPass(scene, camera, container.clientWidth, container.clientHeight);
      ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.6, thickness: 1.5, scale: 1.2 });
      ao.blendIntensity = 1;
      composer.addPass(ao);
    }
    composer.addPass(new OutputPass());
    grainPass = new ShaderPass(GrainVignetteShader);
    composer.addPass(grainPass);
    composer.setPixelRatio(q.dpr);
    composer.setSize(container.clientWidth, container.clientHeight);
  };
  if (q.tier !== 'low') setupComposer();

  // ---------- Caméra / progression ----------
  const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let targetP = 0, currentP = 0, active = false, disposed = false;
  const fitFov = () => {
    const a = camera.aspect;
    // Focale « architecturale » : ~62° horizontaux en paysage, plafonnée en portrait
    const hfov = THREE.MathUtils.degToRad(a < 0.9 ? 78 : 62);
    camera.fov = Math.min(64, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / a)));
    camera.updateProjectionMatrix();
  };
  const applyCamera = (p) => {
    cameraPose(p, camera.aspect, pose);
    camera.position.copy(pose.pos);
    camera.lookAt(pose.target);
  };

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; fitFov();
    composer?.setSize(w, h);
    if (reducedMotion) render(0);
  };
  window.addEventListener('resize', resize);
  camera.aspect = container.clientWidth / container.clientHeight; fitFov();

  // ---------- Boucle ----------
  const clock = new THREE.Clock();
  let t = 0, frames = 0, slowFrames = 0, warm = 0, degraded = false;
  function render(dt) {
    t += dt;
    const tt = reducedMotion ? 4 : t;
    M.uniforms.uTime.value = tt;
    wind.uTime.value = tt;
    M.waterUniforms.uWaveA.value.set(tt * 0.012, tt * 0.007);
    M.waterUniforms.uWaveB.value.set(-tt * 0.009, tt * 0.011);
    if (grainPass) grainPass.uniforms.uTime.value = tt % 10;
    applyCamera(currentP);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function loop() {
    if (disposed) return;
    if (!active) { raf = 0; return; }
    const dt = Math.min(0.05, clock.getDelta());
    // lissage exponentiel de la caméra : mouvement fluide même avec un scroll saccadé
    currentP += (targetP - currentP) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(targetP - currentP) < 1e-5) currentP = targetP;
    render(dt);
    // Adaptation dynamique : si l'appareil peine, on allège le rendu
    // (les 90 premières images sont ignorées : la carte graphique « chauffe », ce n'est pas représentatif)
    frames++; warm++;
    if (warm > 90 && dt > 1 / 38) slowFrames++;
    if (warm > 90 && frames >= 120) {
      if (!degraded && slowFrames > 60) {
        degraded = true;
        if (composer) { composer.dispose(); composer = null; grainPass = null; }
        renderer.setPixelRatio(Math.min(1, q.dpr));
        renderer.setSize(container.clientWidth, container.clientHeight, false);
      }
      frames = 0; slowFrames = 0;
    }
    raf = requestAnimationFrame(loop);
  }
  let raf = 0;

  // Premier rendu (compilation des shaders) puis fondu d'apparition
  applyCamera(0);
  // Compilation des shaders en parallèle par la carte graphique (sans figer la page), puis premier rendu
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  performance.mark('abast:3d-shaders');
  // Envoi des textures à la carte graphique une par une (la page respire entre deux envois)
  const textures = new Set();
  scene.traverse((o) => { if (!o.material) return; [].concat(o.material).forEach((m) => ['map', 'normalMap', 'roughnessMap', 'alphaMap'].forEach((k) => m[k] && textures.add(m[k]))); });
  for (const tex of textures) { renderer.initTexture(tex); await new Promise((r) => setTimeout(r, 0)); }
  performance.mark('abast:3d-upload');
  render(0);
  performance.mark('abast:3d-pret');
  setTimeout(() => renderer.domElement.classList.add('is-ready'), 30);
  // Pleine définition des grandes surfaces, en arrière-plan une fois la scène affichée
  setTimeout(() => M.upgradeTextures().then(() => { performance.mark('abast:3d-hd'); if (reducedMotion) render(0); }), 400);

  return {
    setProgress(p, immediate = false) {
      targetP = reducedMotion ? 0 : p;
      if (immediate) currentP = targetP;
    },
    setActive(on) {
      if (reducedMotion) { if (on) render(0); return; }
      active = on;
      if (on && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose(); composer?.dispose();
    },
    get info() { return { tier: q.tier, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, degraded }; },
    debug: {
      THREE, scene, camera, renderer, sun, sky, M, render: () => render(0), setExposure: (e) => { renderer.toneMappingExposure = e; },
      /** Exporte une image de la scène (même rendu que l'affichage réel) — sert à fabriquer l'image d'attente. */
      async exportFrame(w, h, p = 0, type = 'image/jpeg', quality = 0.82) {
        const prevPR = renderer.getPixelRatio();
        renderer.setPixelRatio(1); renderer.setSize(w, h, false);
        camera.aspect = w / h; fitFov();
        if (composer) { composer.setPixelRatio(1); composer.setSize(w, h); }
        currentP = targetP = p; render(0);
        const blob = await new Promise((r) => renderer.domElement.toBlob(r, type, quality));
        renderer.setPixelRatio(prevPR); if (composer) composer.setPixelRatio(prevPR); resize();
        return blob;
      },
    },
  };
}
