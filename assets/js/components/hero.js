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
    renderer?.setProgress(progress);
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
  const wantsWebGL = !wantsSequence && mode !== 'poster' && hasWebGL2 && (mode === 'webgl' || mode === 'auto');

  const start = async () => {
    try {
      if (wantsSequence) {
        const { createSequence } = await import('../scene/sequence.js');
        renderer = await createSequence(media, SITE.hero.sequence);
      } else if (wantsWebGL) {
        const { createScene } = await import('../scene/scene.js');
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
    }
  };

  // Chargement différé : le contenu s'affiche d'abord, la 3D ensuite.
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  if (document.readyState === 'complete') idle(start, { timeout: 800 });
  else window.addEventListener('load', () => idle(start, { timeout: 800 }), { once: true });
}
