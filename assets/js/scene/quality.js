/**
 * Niveau de qualité de la scène selon l'appareil.
 * high   : ordinateur récent — ombres 4K, occlusion ambiante, herbe dense
 * medium : portable / GPU modeste
 * low    : mobile — scène allégée, pas de post-traitement
 * Un moniteur de FPS peut ensuite rétrograder dynamiquement (voir scene.js).
 */
export function detectQuality() {
  const nav = navigator;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse && small;
  const mem = nav.deviceMemory || 8;
  const cores = nav.hardwareConcurrency || 8;
  const params = new URLSearchParams(location.search);
  const forced = params.get('q'); // ?q=low|medium|high pour tester

  let tier = 'high';
  if (mobile || mem <= 2 || cores <= 2) tier = 'low';
  else if (mem <= 4 || cores <= 4 || coarse) tier = 'medium';
  if (['low', 'medium', 'high'].includes(forced)) tier = forced;

  const presets = {
    high:   { dpr: Math.min(window.devicePixelRatio, 1.75), shadowSize: 4096, ao: true,  grass: 90000, leafScale: 1,   texSize: 1024, bloom: true },
    medium: { dpr: Math.min(window.devicePixelRatio, 1.25), shadowSize: 2048, ao: false, grass: 30000, leafScale: .7,  texSize: 1024, bloom: false },
    low:    { dpr: Math.min(window.devicePixelRatio, 1.5),  shadowSize: 1024, ao: false, grass: 0,     leafScale: .45, texSize: 512,  bloom: false },
  };
  return { tier, mobile, ...presets[tier] };
}
