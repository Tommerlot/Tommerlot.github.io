/**
 * Hero : calcule la progression du scroll dans la séquence (0 → 1),
 * pilote les chapitres de texte + l'indicateur de rotation,
 * puis charge le rendu adapté à l'appareil (3D temps réel, séquence d'images ou poster).
 */
import { SITE } from '../config.js';

export function initHero() {
  const hero = document.querySelector('.hero');
  const track = hero.querySelector('.hero__track');
  const media = document.getElementById('hero-media');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const dialProgress = hero.querySelector('.dial__progress');
  const dialDeg = hero.querySelector('.dial__deg');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer = null; // { setProgress(p), setActive(bool) }
  let progress = 0;

  const computeProgress = () => {
    const rect = track.getBoundingClientRect();
    const total = track.offsetHeight - window.innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
  };

  const update = () => {
    progress = computeProgress();
    if (!reduced) {
      chapters.forEach((c) => {
        const from = parseFloat(c.dataset.from);
        const to = parseFloat(c.dataset.to);
        c.classList.toggle('is-active', progress >= from && progress < to);
      });
    }
    if (dialProgress) dialProgress.style.strokeDashoffset = String(100 - progress * 100);
    if (dialDeg) dialDeg.textContent = `${Math.round(progress * 360)}°`;
    media.style.setProperty('--p', progress.toFixed(4)); // mouvement de l'image en mode allégé
    renderer?.setProgress(progress);
  };

  // Mode allégé (connexion lente, pas de WebGL, 3D trop longue à arriver) : image animée au scroll,
  // séquence raccourcie. La position de lecture est conservée pour éviter tout saut de page.
  const enterLite = () => {
    if (hero.classList.contains('hero--lite')) return;
    const p = computeProgress();
    const inHero = track.getBoundingClientRect().top < 0 && p > 0 && p < 1;
    hero.classList.add('hero--lite');
    if (inHero) window.scrollTo(0, track.offsetTop + p * (track.offsetHeight - window.innerHeight));
    update();
  };

  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });
  window.addEventListener('resize', update);
  update();

  // Titre ajusté à l'espace réellement disponible entre le header et le bas de l'écran,
  // quel que soit le format (plein écran, fenêtre réduite, portable, tablette, téléphone).
  const title = hero.querySelector('.hero__title');
  const intro = hero.querySelector('.chapter--intro');
  const headerEl = document.querySelector('.site-header');
  const fitTitle = () => {
    if (reduced) return;
    title.style.fontSize = '';
    const vw = window.innerWidth;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const maxPx = vw <= 640 ? Math.min(vw * 0.094, 2.7 * rem) : Math.min(1.3 * rem + vw * 0.044, 5.6 * rem);
    const minPx = vw <= 640 ? 26 : 30;
    const shift = intro.classList.contains('is-active') ? 0 : 24; // décalage de l'animation d'entrée
    const fits = (px) => {
      title.style.fontSize = `${px}px`;
      const top = Math.min(...[...intro.children].filter((k) => k.offsetParent).map((k) => k.getBoundingClientRect().top)) - shift;
      return top >= headerEl.getBoundingClientRect().bottom + 20;
    };
    if (fits(maxPx)) return;
    let lo = minPx, hi = maxPx;
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    title.style.fontSize = `${Math.floor(lo)}px`;
  };
  window.addEventListener('resize', fitTitle);
  fitTitle();
  document.fonts?.ready.then(fitTitle); // les polices modifient la hauteur des lignes

  // Rendu actif uniquement quand le hero est visible (économie batterie / GPU)
  const vis = new IntersectionObserver(([e]) => renderer?.setActive(e.isIntersecting), { rootMargin: '100px' });
  vis.observe(hero);

  const hasWebGL2 = (() => {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
  })();

  // ?hero=poster|webgl|sequence permet de forcer un mode (tests)
  const forced = new URLSearchParams(location.search).get('hero');
  const mode = ['poster', 'webgl', 'sequence', 'auto'].includes(forced) ? forced : SITE.hero.mode;
  const wantsSequence = mode === 'sequence' && SITE.hero.sequence.count > 0;
  // Cas certains → pas de 3D : « économie de données » activée ou connexion 2G.
  // (Les estimations de débit du navigateur sont trop approximatives pour décider seules : dans les autres cas,
  //  c'est le temps réel de téléchargement de la 3D qui tranche, voir MAX_WAIT_MS.)
  const conn = navigator.connection;
  const slowNet = !!conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || ''));
  const wantsWebGL = !wantsSequence && mode !== 'poster' && hasWebGL2 && (mode === 'webgl' || (mode === 'auto' && !slowNet));
  if (!wantsWebGL && !wantsSequence) enterLite();

  const MAX_WAIT_MS = 6000; // au-delà, on garde l'image : la 3D arriverait trop tard et figerait la page
  const start = async () => {
    performance.mark('abast:hero-start');
    // Si la 3D n'est pas téléchargée au bout de MAX_WAIT_MS, on passe en mode allégé tout de suite
    // et on n'activera pas la 3D ensuite (elle figerait la page en arrivant tardivement).
    let gaveUp = false;
    const guard = mode === 'auto' && wantsWebGL ? setTimeout(() => { gaveUp = true; enterLite(); }, MAX_WAIT_MS) : 0;
    try {
      if (wantsSequence) {
        const { createSequence } = await import('../scene/sequence.js');
        renderer = await createSequence(media, SITE.hero.sequence);
      } else if (wantsWebGL) {
        const { createScene } = await import('../scene/scene.js');
        clearTimeout(guard);
        if (gaveUp) return;
        renderer = await createScene(media, { reducedMotion: reduced });
      }
      if (renderer) {
        if (new URLSearchParams(location.search).has('debug')) { // outil de réglage visuel
          window.__hero = renderer;
          window.__shot = (p) => {
            document.querySelectorAll('.hero__chapters,.hero__scrim,.site-header,.hero__dial,.hero__scrollhint,.hero__disclaimer').forEach((e) => { e.style.visibility = 'hidden'; });
            renderer.setActive(false); renderer.setProgress(p, true); renderer.debug?.render(); renderer.debug?.render();
            return 'ok';
          };
        }
        media.classList.add('is-live');
        renderer.setProgress(progress, true);
        renderer.setActive(true);
      }
    } catch (err) {
      console.warn('[ABAST UP] Hero : rendu 3D indisponible, affichage du poster.', err);
      enterLite();
    }
  };

  // La 3D démarre juste après le premier affichage (sans attendre la fin du chargement de la page),
  // et tous ses fichiers sont demandés d'un coup plutôt qu'en cascade.
  if (wantsWebGL) { try { preload3D(); } catch { /* aperçu hors ligne : pas de préchargement */ } }
  setTimeout(start, 30);
}

const SCENE_MODULES = ['scene', 'quality', 'materials', 'textures', 'texgen', 'villa', 'pool', 'garden'];
const THREE_ADDONS = [
  'utils/BufferGeometryUtils', 'geometries/RoundedBoxGeometry', 'postprocessing/EffectComposer', 'postprocessing/RenderPass',
  'postprocessing/GTAOPass', 'postprocessing/ShaderPass', 'postprocessing/OutputPass', 'postprocessing/Pass', 'postprocessing/MaskPass',
  'shaders/CopyShader', 'shaders/GTAOShader', 'shaders/PoissonDenoiseShader', 'shaders/OutputShader', 'math/SimplexNoise',
];
function preload3D() {
  const urls = [
    new URL('assets/vendor/three/build/three.module.min.js', document.baseURI).href,
    ...SCENE_MODULES.map((m) => new URL(`../scene/${m}.js`, import.meta.url).href),
    ...THREE_ADDONS.map((m) => new URL(`assets/vendor/three/examples/jsm/${m}.js`, document.baseURI).href),
  ];
  urls.forEach((href) => {
    const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = href; document.head.appendChild(l);
  });
}
