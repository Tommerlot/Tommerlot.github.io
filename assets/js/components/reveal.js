/** Apparitions progressives au scroll (une seule fois par élément). */
export function initReveal() {
  const items = document.querySelectorAll('.reveal, .reveal-stagger, .mismatch__item, .step');
  document.querySelectorAll('.reveal-stagger').forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty('--i', i));
  });
  if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
}
