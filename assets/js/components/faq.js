/**
 * FAQ : accordéons <details> natifs (accessibles sans JS), avec ouverture/fermeture animée
 * et une seule réponse ouverte à la fois. (Les données structurées FAQPage sont écrites dans index.html :
 * pensez à les mettre à jour si vous modifiez une question.)
 */
export function initFaq() {
  const items = [...document.querySelectorAll('.qa')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  items.forEach((d) => {
    const summary = d.querySelector('summary');
    const panel = d.querySelector('.qa__a');
    summary.addEventListener('click', (e) => {
      if (reduced) return;
      e.preventDefault();
      if (d.open) close(d, panel); else {
        items.filter((o) => o !== d && o.open).forEach((o) => close(o, o.querySelector('.qa__a')));
        open(d, panel);
      }
    });
  });

  function open(d, panel) {
    d.open = true;
    const h = panel.scrollHeight;
    panel.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.7,.1,1)' });
  }
  function close(d, panel) {
    const h = panel.scrollHeight;
    const a = panel.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.2,.7,.1,1)' });
    a.onfinish = () => { d.open = false; };
  }
}
