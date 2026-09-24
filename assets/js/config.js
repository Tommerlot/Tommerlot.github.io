/**
 * ABAST UP — configuration centrale du site.
 * Tout ce qui est susceptible de changer (textes de marque, liens, contact,
 * réservation, couleurs, mode du Hero 3D) se modifie ici, sans toucher au reste du code.
 */
export const SITE = {
  name: 'ABAST UP',
  slogan: 'Ce n’est plus les clients qui vous choisissent, c’est vous qui choisissez vos clients.',
  baseline: 'Génération de clients qualifiés pour les entreprises de piscine',

  // Couleurs de marque (appliquées aux variables CSS au démarrage).
  colors: {
    ink: '#0b1114',      // noir profond légèrement bleuté
    paper: '#f4f1ea',    // blanc cassé chaud (pierre claire)
    stone: '#e6e0d4',
    pool: '#2f8f94',     // turquoise profond, utilisé avec parcimonie
    poolLight: '#8fd3d1',
  },

  /**
   * ▼▼▼ LIEN DE RÉSERVATION — À COMPLÉTER ▼▼▼
   * provider : 'calendly' | 'google' | 'other'
   * url      : votre lien (ex. https://calendly.com/votre-compte/rendez-vous
   *            ou le lien de page de réservation Google Agenda).
   * Tant que url est vide, les boutons « Réserver » mènent à la section #rdv
   * qui affiche un formulaire de contact de secours (mailto) si un e-mail est renseigné.
   *
   * CRITÈRES DU VISITEUR → CALENDLY : les critères choisis dans « Vous choisissez » sont envoyés
   * automatiquement comme réponse à la 1re question personnalisée de votre rendez-vous.
   * Réglage à faire une fois dans Calendly : Type d'événement > Formulaire de réservation
   * (« Questions pour l'invité ») > ajouter, EN PREMIÈRE question, « Vos critères de ciblage »
   * au format « Plusieurs lignes ». Vous recevrez alors ces critères dans l'e-mail de
   * confirmation de chaque rendez-vous et dans le détail de l'événement.
   */
  booking: {
    provider: 'calendly',
    url: 'https://calendly.com/t-merlot08', // lien de la page Calendly (idéalement : lien direct du type de rendez-vous)
    embed: true, // true : agenda intégré dans la page ; false : ouverture dans un nouvel onglet
  },

  // Coordonnées affichées dans le pied de page — laissez vide ce qui ne doit pas apparaître.
  contact: {
    email: 'contact@abastup.fr',
    phone: '06 61 46 87 91',
    address: '',
  },

  // Identité légale (reprise dans les mentions légales et le pied de page)
  legal: {
    owner: 'Tom Merlot',
    form: 'Entrepreneur individuel (EI)',
    tradeName: 'ABAST UP',
    siren: '130 358 963',
    siret: '130 358 963 00010',
    address: '511 avenue Général Leclerc, 06140 Vence, France',
  },

  social: {
    instagram: '',
    facebook: '',
    linkedin: '',
  },

  // URL publique du site (utilisée pour les liens canoniques / partage).
  // À VÉRIFIER avant la mise en ligne, puis à reporter dans index.html, sitemap.xml et robots.txt.
  siteUrl: 'https://abastup.fr',

  /**
   * Hero 3D
   * mode : 'auto'     → WebGL si l'appareil le permet, sinon image de secours
   *        'webgl'    → force la scène temps réel
   *        'sequence' → séquence d'images pré-rendues (ex. rendu Blender/Unreal)
   *        'poster'   → image fixe uniquement
   * sequence.path : motif des fichiers, #### = numéro sur 4 chiffres (0001, 0002…)
   */
  hero: {
    mode: 'auto',
    sequence: { path: 'assets/sequence/frame_####.webp', count: 0 },
  },
};
