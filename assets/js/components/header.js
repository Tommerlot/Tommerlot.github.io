/** Header : état au scroll (transparent → verre sombre / clair), menu mobile, lien actif, CTA mobile. */
export function initHeader() {
  const header = document.querySelector('.site-header');
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.nav');
  const mobileCta = document.querySelector('.mobile-cta');
  const hero = document.querySelector('.hero');
  const lightSections = [...document.querySelectorAll('.section--paper, .section--stone')];

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Ouvrir le menu');
    nav.classList.remove('is-open');
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // Fond du header selon la section sous le header
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const probe = header.offsetHeight / 2;
    const onLight = lightSections.some((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    });
    header.classList.toggle('is-scrolled', y > 40 && !onLight);
    header.classList.toggle('is-light', onLight);

    // CTA mobile : visible une fois l'intro du hero dépassée, masqué dans la section réservation
    if (mobileCta) {
      const heroIntroPassed = y > window.innerHeight * 0.6;
      const rdv = document.getElementById('rdv').getBoundingClientRect();
      const inBooking = rdv.top < window.innerHeight && rdv.bottom > 0;
      const visible = heroIntroPassed && !inBooking;
      mobileCta.classList.toggle('is-visible', visible);
      mobileCta.setAttribute('aria-hidden', String(!visible));
      mobileCta.querySelector('a').tabIndex = visible ? 0 : -1;
    }
    hero.classList.toggle('is-scrolling', y > 60);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();

  // Lien de navigation actif
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const a = map.get(en.target.id);
      if (a && en.isIntersecting) {
        links.forEach((l) => l.removeAttribute('aria-current'));
        a.setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
