/**
 * « Vous choisissez » : cartes de critères interactives.
 * - Les critères sont enregistrés dans le navigateur du visiteur (localStorage) et restaurés à sa prochaine visite.
 * - Ils sont transmis à la réservation (Calendly : pré-remplissage de la 1re question personnalisée).
 */
export const BRIEF_EVENT = 'abast:brief';
const STORAGE_KEY = 'abast-criteria-v1';

const GROUP_LABELS = { chantier: 'Type de chantier', projet: 'Type de projet', clientele: 'Type de clientèle' };

/** Critères enregistrés (ou null). Utilisé par la réservation au chargement de la page. */
export function loadCriteria() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

/** Texte structuré transmis avec la demande de rendez-vous. */
export function criteriaToText(c, sep = '\n') {
  if (!c) return '';
  const line = (k) => `${GROUP_LABELS[k]} : ${c.groups[k]?.length ? c.groups[k].join(', ') : 'à définir'}`;
  return [line('chantier'), line('projet'), line('clientele'), `Zone : ${c.radius} km autour de l'entreprise`].join(sep);
}

/** Résumé court affiché à l'écran. */
export function criteriaToSummary(c) {
  if (!c) return '';
  const parts = [...(c.groups.chantier || []), ...(c.groups.projet || []), ...(c.groups.clientele || [])];
  return `${parts.length ? parts.join(' · ') : 'Critères à définir ensemble'} · ${c.radius} km autour de votre entreprise`;
}

export function initCustomization() {
  const section = document.getElementById('choisir');
  const radius = section.querySelector('#radius');
  const radiusOut = section.querySelector('#radius-out');
  const area = section.querySelector('.radar__area');
  const ring = section.querySelector('.radar__ring');
  const briefText = section.querySelector('#brief-text');
  const savedNote = section.querySelector('#brief-saved');
  const groups = [...section.querySelectorAll('.chips')];

  // Restauration des critères d'une visite précédente
  const saved = loadCriteria();
  if (saved) {
    if (saved.radius) radius.value = saved.radius;
    groups.forEach((g) => {
      const on = saved.groups?.[g.dataset.group];
      if (!Array.isArray(on)) return;
      g.querySelectorAll('.chip').forEach((chip) => {
        const active = on.includes(chip.textContent.trim());
        chip.classList.toggle('is-on', active);
        chip.setAttribute('aria-pressed', String(active));
      });
    });
  }

  const current = () => ({
    radius: Number(radius.value),
    groups: Object.fromEntries(groups.map((g) => [g.dataset.group, [...g.querySelectorAll('.chip.is-on')].map((c) => c.textContent.trim())])),
  });

  const render = (persist) => {
    const c = current();
    radiusOut.textContent = `${c.radius} km`;
    // 10 km → r 16, 120 km → r 88 (échelle douce)
    const r = 16 + ((c.radius - 10) / 110) * 72;
    area.setAttribute('r', r.toFixed(1));
    ring.setAttribute('r', r.toFixed(1));
    briefText.textContent = criteriaToSummary(c);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); // uniquement les critères choisis, rien d'autre
        if (savedNote) savedNote.hidden = false;
      } catch { /* stockage indisponible (navigation privée…) : les critères restent transmis pendant la visite */ }
    }
    document.dispatchEvent(new CustomEvent(BRIEF_EVENT, { detail: { ...c, byUser: !!persist } }));
  };

  groups.forEach((group) => {
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const on = !chip.classList.contains('is-on');
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
      render(true);
    });
  });
  radius.addEventListener('input', () => render(true));
  if (saved && savedNote) savedNote.hidden = false;
  render(false);
}
