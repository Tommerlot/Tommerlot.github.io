/**
 * Mode « séquence d'images » : lecture d'un tour à 360° pré-rendu (Blender, Unreal, V-Ray…)
 * synchronisée avec le scroll. C'est la voie vers un rendu 100 % photoréaliste :
 * déposez les images dans assets/sequence/ puis réglez SITE.hero dans config.js.
 * Conseils : 120 à 180 images, 1920×1080 en WebP qualité ~70 (≈ 80–150 Ko / image).
 */
export async function createSequence(container, { path, count }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  container.appendChild(canvas);
  const frames = new Array(count);
  const src = (i) => path.replace('####', String(i + 1).padStart(4, '0'));
  let current = -1, target = 0, active = false, raf = 0;

  const load = (i) => new Promise((res) => {
    const img = new Image(); img.decoding = 'async'; img.src = src(i);
    img.onload = () => { frames[i] = img; res(); }; img.onerror = res;
  });
  // Première image d'abord, puis chargement progressif (une image sur 8, puis le reste)
  await load(0);
  const order = [];
  for (let step = 8; step >= 1; step = Math.floor(step / 2)) for (let i = 0; i < count; i += step) if (!order.includes(i)) order.push(i);
  (async () => { for (const i of order) if (!frames[i]) await load(i); })();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = container.clientWidth * dpr; canvas.height = container.clientHeight * dpr;
    current = -1; draw();
  };
  const nearest = (i) => { for (let d = 0; d < count; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; } return null; };
  function draw() {
    const i = Math.round(target * (count - 1));
    if (i === current) return;
    const img = frames[i] || nearest(i); if (!img) return;
    current = frames[i] ? i : -1;
    const s = Math.max(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }
  const loop = () => { if (!active) { raf = 0; return; } draw(); raf = requestAnimationFrame(loop); };
  window.addEventListener('resize', resize);
  resize();
  canvas.classList.add('is-ready');

  return {
    setProgress(p) { target = p; },
    setActive(on) { active = on; if (on && !raf) raf = requestAnimationFrame(loop); },
  };
}
