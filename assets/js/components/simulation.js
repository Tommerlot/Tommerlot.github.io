/**
 * Simulation indicative : uniquement de l'arithmétique sur les valeurs saisies.
 * Aucun taux de conversion ni performance n'est présumé.
 */
export function initSimulation() {
  const $ = (id) => document.getElementById(id);
  const budget = $('sim-budget'), basket = $('sim-basket'), jobs = $('sim-jobs'), zone = $('sim-zone');
  const out = { revenue: $('out-revenue'), ratio: $('out-ratio'), perjob: $('out-perjob'), area: $('out-area') };
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });

  const val = (el) => Math.max(0, Number(String(el.value).replace(',', '.')) || 0);

  const render = () => {
    const b = val(budget), p = val(basket), j = val(jobs), km = Number(zone.value);
    const revenue = p * j;
    out.revenue.textContent = revenue ? eur.format(revenue) : '—';
    out.ratio.textContent = revenue ? pct.format(b / revenue) : '—';
    out.perjob.textContent = j ? eur.format(b / j) : '—';
    out.area.textContent = `${num.format(Math.PI * km * km)} km²`;
  };
  [budget, basket, jobs, zone].forEach((el) => el.addEventListener('input', render));
  render();
}
