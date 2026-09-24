/**
 * Réservation — composant configurable via SITE.booking (config.js).
 *  - url renseignée + embed:true  → agenda intégré (Calendly / Google Agenda / autre) en iframe, chargé à l'approche
 *  - url renseignée + embed:false → les boutons « Réserver » ouvrent l'agenda dans un nouvel onglet
 *  - url vide                     → formulaire de contact (mailto) si SITE.contact.email est renseigné
 *
 * Critères du visiteur (section « Vous choisissez ») :
 *  - Calendly : ils pré-remplissent la 1re question personnalisée du type de rendez-vous (paramètre a1).
 *    → Dans Calendly : Type d'événement > Questions pour l'invité > ajouter en 1re question
 *      « Vos critères de ciblage » (réponse sur plusieurs lignes). La réponse apparaît dans l'e-mail de
 *      notification et dans le détail du rendez-vous.
 *  - Formulaire e-mail : ils sont ajoutés au message.
 */
import { SITE } from '../config.js';
import { BRIEF_EVENT, loadCriteria, criteriaToText, criteriaToSummary } from './customization.js';

// Accord du visiteur pour l'agenda Calendly (conservé 6 mois, comme le recommande la CNIL)
export const CONSENT_KEY = 'abast-consent-calendly';
const CONSENT_MS = 1000 * 60 * 60 * 24 * 182;
export function hasConsent() {
  try { const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); return !!(c && c.ok && Date.now() - c.t < CONSENT_MS); } catch { return false; }
}
export function saveConsent(ok) {
  try { if (ok) localStorage.setItem(CONSENT_KEY, JSON.stringify({ ok: true, t: Date.now() })); else localStorage.removeItem(CONSENT_KEY); } catch { /* ignoré */ }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initBooking() {
  const { url, embed, provider } = SITE.booking;
  const widget = document.getElementById('booking-widget');
  const briefEl = document.getElementById('booking-brief');
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  let criteria = loadCriteria(); // uniquement si le visiteur a composé son ciblage

  const showBrief = () => {
    if (!criteria) return;
    briefEl.hidden = false;
    briefEl.innerHTML = `<strong>Votre ciblage :</strong> ${escapeHtml(criteriaToSummary(criteria))}`
      + (url ? '<br><span class="booking__brief-note">Il sera joint automatiquement à votre rendez-vous.</span>' : '');
  };
  document.addEventListener(BRIEF_EVENT, (e) => {
    // les valeurs par défaut ne sont pas transmises : seulement ce que le visiteur a réellement choisi
    if (!e.detail.byUser && !criteria) return;
    criteria = e.detail; showBrief(); scheduleEmbedUpdate();
  });
  showBrief();

  const bookingUrl = () => {
    if (!url) return '';
    const u = new URL(url, location.href);
    if (provider === 'calendly') {
      // (le bandeau cookies de Calendly reste affiché : c'est lui qui recueille le consentement pour ses propres cookies)
      u.searchParams.set('utm_source', 'site-abastup');
      if (criteria) u.searchParams.set('a1', criteriaToText(criteria));
    }
    return u.toString();
  };

  // --- Cas 1 : lien externe (nouvel onglet) — l'URL est calculée au clic, avec les critères du moment
  if (url && !embed) {
    document.querySelectorAll('[data-book]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); window.open(bookingUrl(), '_blank', 'noopener'); });
    });
  }

  // --- Cas 2 : agenda intégré — chargé UNIQUEMENT après l'accord du visiteur (Calendly dépose des cookies).
  // Aucun contenu Calendly n'est chargé avant le clic ; le choix est mémorisé 6 mois et révocable (page Cookies).
  let iframe = null, timer = 0;
  function scheduleEmbedUpdate() {
    if (!iframe) return;
    clearTimeout(timer); // évite de recharger l'agenda à chaque mouvement du curseur
    timer = setTimeout(() => { iframe.src = bookingUrl(); }, 600);
  }
  if (url && embed) {
    const { email, phone } = SITE.contact;
    const alt = [email && `<a class="link" href="mailto:${email}">${email}</a>`, phone && `<a class="link" href="tel:${phone.replace(/\s/g, '')}">${phone}</a>`].filter(Boolean).join(' ou ');
    const showAgenda = (remember) => {
      if (remember) saveConsent(true);
      iframe = document.createElement('iframe');
      iframe.title = 'Agenda de réservation Calendly — ABAST UP';
      iframe.src = bookingUrl();
      const bar = document.createElement('p');
      bar.className = 'booking-card__note booking__revoke';
      bar.innerHTML = 'Agenda fourni par Calendly. <button type="button" class="linkbtn">Masquer l’agenda et retirer mon accord</button>';
      bar.querySelector('button').addEventListener('click', () => { saveConsent(false); iframe = null; renderGate(); });
      widget.replaceChildren(iframe, bar);
    };
    const renderGate = () => {
      widget.innerHTML = `<div class="booking-card">
        <h3>Choisissez votre créneau</h3>
        <p>La prise de rendez-vous se fait avec <strong>Calendly</strong>. En affichant l’agenda, vous acceptez que Calendly dépose les cookies nécessaires à son fonctionnement et traite les informations que vous y saisirez, pour organiser le rendez-vous.</p>
        <button type="button" class="btn btn--primary btn--block" id="show-agenda">Afficher l’agenda de réservation</button>
        <p class="booking-card__note">Détails : <a class="link" href="confidentialite.html">politique de confidentialité</a> · <a class="link" href="cookies.html">cookies</a>.${alt ? ` Vous préférez ne pas utiliser Calendly ? Contactez-nous : ${alt}.` : ''}</p>
      </div>`;
      widget.querySelector('#show-agenda').addEventListener('click', () => showAgenda(true));
    };
    if (hasConsent()) showAgenda(false); else renderGate();
    return;
  }
  if (url) return;

  // --- Cas 3 : pas encore d'agenda → formulaire de contact par e-mail
  const email = SITE.contact.email;
  const todo = isLocal
    ? `<p class="booking-card__todo">Configuration : ajoutez votre lien de réservation dans <code>assets/js/config.js</code> → <code>booking.url</code>${email ? '' : ', ou au minimum un e-mail de contact (<code>contact.email</code>)'}. Ce message n’apparaît qu’en local.</p>`
    : '';

  if (!email) {
    widget.innerHTML = `<div class="booking-card">
      <h3>Agenda en ligne bientôt disponible</h3>
      <p>La prise de rendez-vous en ligne arrive très prochainement.</p>
      ${todo}
    </div>`;
    return;
  }

  widget.innerHTML = `<div class="booking-card">
    <h3>Demander un rendez-vous</h3>
    <p>Indiquez vos coordonnées : nous revenons vers vous pour fixer un créneau.</p>
    <form id="booking-form" novalidate>
      <label class="field"><span>Nom et prénom</span><span class="field__input"><input name="nom" autocomplete="name" required></span></label>
      <label class="field"><span>Entreprise</span><span class="field__input"><input name="entreprise" autocomplete="organization" required></span></label>
      <label class="field"><span>Téléphone</span><span class="field__input"><input name="tel" type="tel" autocomplete="tel" required></span></label>
      <label class="field"><span>Votre projet</span><span class="field__input"><textarea name="message" rows="3"></textarea></span></label>
      <button class="btn btn--primary btn--block" type="submit">Réserver mon rendez-vous</button>
      <p class="booking-card__note">Votre messagerie s’ouvre avec la demande pré-remplie, critères de ciblage inclus.</p>
    </form>
    ${todo}
  </div>`;
  widget.querySelector('#booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const crit = criteria ? `\n\nCritères de ciblage :\n${criteriaToText(criteria)}` : '';
    const body = `Nom : ${f.get('nom')}\nEntreprise : ${f.get('entreprise')}\nTéléphone : ${f.get('tel')}\n\n${f.get('message')}${crit}`;
    location.href = `mailto:${email}?subject=${encodeURIComponent('Demande de rendez-vous — ABAST UP')}&body=${encodeURIComponent(body)}`;
  });
}
