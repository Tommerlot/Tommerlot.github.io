/** Méthode : la ligne verticale se remplit au fil du scroll dans les 4 étapes. */
export function initMethod() {
  const steps = document.querySelector('.steps');
  if (!steps) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = steps.getBoundingClientRect();
    const mid = window.innerHeight * 0.6;
    const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
    steps.style.setProperty('--progress', p.toFixed(3));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
