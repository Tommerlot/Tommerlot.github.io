/**
 * ABAST UP — point d'entrée.
 * Chaque section a son module ; la scène 3D est chargée à part (import dynamique)
 * pour ne jamais bloquer l'affichage du contenu.
 */
import { SITE } from './config.js';
import { initHeader } from './components/header.js';
import { initHero } from './components/hero.js';
import { initReveal } from './components/reveal.js';
import { initCustomization } from './components/customization.js';
import { initMethod } from './components/method.js';
import { initSimulation } from './components/simulation.js';
import { initBooking } from './components/booking.js';
import { initFaq } from './components/faq.js';
import { initFooter } from './components/footer.js';

document.documentElement.classList.add('js');

// Couleurs de marque depuis la config
const root = document.documentElement.style;
root.setProperty('--ink', SITE.colors.ink);
root.setProperty('--paper', SITE.colors.paper);
root.setProperty('--stone', SITE.colors.stone);
root.setProperty('--pool', SITE.colors.pool);
root.setProperty('--pool-light', SITE.colors.poolLight);
document.querySelectorAll('[data-bind="name"]').forEach((el) => { el.textContent = SITE.name; });

const safe = (fn, name) => { try { fn(); } catch (err) { console.error(`[ABAST UP] ${name}`, err); } };
safe(initHeader, 'header');
safe(initReveal, 'reveal');
safe(initCustomization, 'customization');
safe(initMethod, 'method');
safe(initSimulation, 'simulation');
safe(initBooking, 'booking');
safe(initFaq, 'faq');
safe(initFooter, 'footer');
safe(initHero, 'hero');
