/**
 * Footer : les coordonnées sont écrites directement dans le HTML (lisibles sans JavaScript, par les robots
 * et les agents IA). Ce module ajoute seulement l'année et les réseaux sociaux renseignés dans config.js.
 */
import { SITE } from '../config.js';

export function initFooter() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const socials = Object.entries(SITE.social).filter(([, v]) => v);
  if (!socials.length) return;
  const p = document.createElement('p');
  p.innerHTML = socials.map(([k, v]) => `<a href="${v}" target="_blank" rel="noopener">${k[0].toUpperCase() + k.slice(1)}</a>`).join(' · ');
  document.getElementById('footer-contact')?.appendChild(p);
}
