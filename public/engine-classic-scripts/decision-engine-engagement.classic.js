// ============================================================================
// decision-engine-engagement.classic.js
// ----------------------------------------------------------------------------
// Sous-module du Module 1 du moteur de décision : calcule l'état d'engagement
// du coureur (régularité récente, tendance) à partir de l'historique de
// séances déjà adapté (ActivitySample[], produit par
// decision-engine-adapter.classic.js).
//
// Répond à une question différente du RunnerStateCalculator : pas "comment va
// le corps du coureur" mais "ce coureur est-il en train de décrocher".
//
// Références :
//   - Fondements (SDT, désengagement précoce) : §5.7 du document d'architecture
//   - Structure EngagementState : §3.3 du document d'architecture
//   - Sous-calculs attendus : §6 du document d'architecture, sous-module
//     EngagementCalculator
//
// VERSION V1 (16/07/2026) : tourne uniquement sur la régularité comportementale
// (signal principal, ne nécessite aucune saisie). Le signal plaisirDeclare
// (échelle PACES-S, §5.7 doc archi) est noté comme piste future mais volontairement
// PAS implémenté ici — aucune saisie de ce type n'existe encore dans Yoria.
// Cf. décision actée le 16/07/2026 : EngagementCalculator V1 = régularité seule.
//
// Ce fichier ne contient AUCUNE règle de décision (pas de "si désengagement
// alors proposer X") — seulement du calcul. Les règles viendront dans
// decision-engine-rules.classic.js (Module 5), notamment R-040
// (désengagement précoce).
//
// Où le déposer : /engine-classic-scripts/decision-engine-engagement.classic.js
// Comment le charger : dans index.html, APRÈS decision-engine-adapter.classic.js
// (indépendant de decision-engine-runner-state.classic.js, aucun ordre requis
// entre les deux, mais les deux doivent être chargés avant le futur Module 5)
//   <script src="/engine-classic-scripts/decision-engine-engagement.classic.js"></script>
// ============================================================================

(function (global) {
  'use strict';

  const JOUR_MS = 24 * 60 * 60 * 1000;
  const FENETRE_RECENTE_JOURS = 14;
  const SEUIL_DESENGAGEMENT_PRECOCE = 3; // séances minimum sur 14j pour ne pas alerter, cf. §5.7 doc archi

  // --------------------------------------------------------------------------
  // Compte les séances dans une fenêtre de N jours avant dateReference.
  // --------------------------------------------------------------------------
  function compterSeancesDansFenetre(activitySamples, dateReference, nbJours) {
    const maintenant = new Date(dateReference).getTime();
    const fenetreMs = nbJours * JOUR_MS;
    let count = 0;
    activitySamples.forEach(sample => {
      if (!sample.date) return;
      const ecart = maintenant - new Date(sample.date).getTime();
      if (ecart >= 0 && ecart <= fenetreMs) count += 1;
    });
    return count;
  }

  // --------------------------------------------------------------------------
  // Calcule la régularité récente (0-100) : compare les 14 derniers jours à
  // l'habitude établie du coureur. Si l'historique est trop court pour établir
  // une habitude (début de plan), applique directement le seuil de
  // désengagement précoce (§5.7 doc archi : < 3 séances sur 14 jours).
  // --------------------------------------------------------------------------
  function calculerRegulariteRecente(activitySamples, dateReference, frequenceHabituelleHebdo) {
    const nbSeancesRecentes = compterSeancesDansFenetre(activitySamples, dateReference, FENETRE_RECENTE_JOURS);

    // Pas d'habitude connue (ex: tout début de plan, ou frequenceHabituelleHebdo non fournie)
    // → on applique directement le seuil brut du §5.7, sans comparaison relative.
    if (!frequenceHabituelleHebdo || frequenceHabituelleHebdo <= 0) {
      if (nbSeancesRecentes < SEUIL_DESENGAGEMENT_PRECOCE) {
        // Sous le seuil critique : score bas, proportionnel à l'écart au seuil
        return {
          valeur: Math.round((nbSeancesRecentes / SEUIL_DESENGAGEMENT_PRECOCE) * 40), // plafonné à 40 = "sous le seuil"
          nbSeancesRecentes,
          seuilApplique: 'desengagement_precoce',
        };
      }
      // Au-dessus du seuil mais pas d'habitude à comparer : score neutre-haut, pas d'excès de confiance
      return {
        valeur: 65,
        nbSeancesRecentes,
        seuilApplique: 'desengagement_precoce',
      };
    }

    // Habitude connue : compare les 14 derniers jours à ce qu'elle prédirait sur la même fenêtre
    const seancesAttendues = (frequenceHabituelleHebdo / 7) * FENETRE_RECENTE_JOURS;
    const ratio = seancesAttendues > 0 ? nbSeancesRecentes / seancesAttendues : 0;
    const scoreBrut = Math.round(ratio * 70); // 70 = régularité "normale" (ratio 1.0), volontairement pas 100 pour laisser de la marge à un dépassement positif
    const scoreBorne = Math.max(0, Math.min(100, scoreBrut));

    return {
      valeur: scoreBorne,
      nbSeancesRecentes,
      seancesAttendues: Math.round(seancesAttendues * 10) / 10,
      seuilApplique: 'comparaison_habitude',
    };
  }

  // --------------------------------------------------------------------------
  // Calcule la tendance d'engagement à partir de plusieurs points de mesure de
  // régularité (pas un seul point, cf. §6 doc archi : "jamais sur un seul point,
  // pour éviter de réagir à du bruit normal — une semaine chargée au travail
  // n'est pas un décrochage"). pointsRegularite : valeurs les plus récentes en
  // dernier dans le tableau.
  // --------------------------------------------------------------------------
  function calculerTendanceEngagement(pointsRegularite) {
    if (!Array.isArray(pointsRegularite) || pointsRegularite.length < 3) {
      // Historique de points trop court pour distinguer tendance de bruit
      return 'signal_faible';
    }
    const derniers = pointsRegularite.slice(-3);
    const [a, b, c] = derniers;

    // Baisse confirmée sur au moins 2 points consécutifs (b<a et c<b), pas juste un creux isolé
    if (b < a && c < b) return 'en_baisse';
    // Hausse confirmée symétriquement
    if (b > a && c > b) return 'en_hausse';
    return 'stable';
  }

  // --------------------------------------------------------------------------
  // Confiance du calcul d'engagement — suit la même philosophie que
  // calculerConfiance du RunnerState (§4.4 doc archi) : ne dépasse jamais ce
  // que les données permettent réellement d'affirmer. Sans plaisirDeclare
  // (V1, cf. en-tête de fichier), plafonnée pour refléter qu'un seul signal
  // (comportemental) alimente le calcul, pas deux.
  // --------------------------------------------------------------------------
  function calculerConfianceEngagement(nbJoursHistoriqueDisponible, nbPointsRegulariteDisponibles) {
    const scoreProfondeur = Math.min(nbJoursHistoriqueDisponible / 28, 1) * 100;
    const scoreNbPoints = Math.min((nbPointsRegulariteDisponibles || 0) / 3, 1) * 100; // 3 points = confiance max sur la tendance
    const PLAFOND_SANS_PLAISIR_DECLARE = 70; // cf. §4.4 doc archi : un seul signal disponible, jamais une confiance pleine
    return Math.round(Math.min(scoreProfondeur, scoreNbPoints, PLAFOND_SANS_PLAISIR_DECLARE));
  }

  // --------------------------------------------------------------------------
  // Point d'entrée principal — cf. §6 doc archi, EngagementCalculator.
  // pointsRegulariteHistorique (optionnel) : régularités calculées lors
  // d'appels précédents (ex: semaines passées), pour permettre le calcul de
  // tendance. Si absent, seul le point du jour est calculable → 'signal_faible'.
  // --------------------------------------------------------------------------
  function calculerEngagementState(activitySamples, options) {
    const opts = options || {};
    const dateReference = opts.dateReference || new Date().toISOString();
    const frequenceHabituelleHebdo = opts.frequenceHabituelleHebdo || undefined;
    const pointsRegulariteHistorique = Array.isArray(opts.pointsRegulariteHistorique)
      ? opts.pointsRegulariteHistorique
      : [];

    if (!Array.isArray(activitySamples)) {
      return {
        plaisirDeclare: undefined,
        regulariteRecente: 0,
        tendanceEngagement: 'signal_faible',
        signauxDetectes: [],
        confiance: 0,
        calculeLe: new Date().toISOString(),
        avertissement: 'activitySamples invalide ou absent.',
      };
    }

    const regularite = calculerRegulariteRecente(activitySamples, dateReference, frequenceHabituelleHebdo);

    // Ajoute le point du jour à l'historique de points pour calculer la tendance
    const pointsAvecAujourdhui = pointsRegulariteHistorique.concat([regularite.valeur]);
    const tendance = calculerTendanceEngagement(pointsAvecAujourdhui);

    const datesTriees = activitySamples.map(s => s.date).filter(Boolean).sort();
    const nbJoursHistorique = datesTriees.length > 0
      ? Math.round((new Date(dateReference) - new Date(datesTriees[0])) / JOUR_MS)
      : 0;

    const confiance = calculerConfianceEngagement(nbJoursHistorique, pointsAvecAujourdhui.length);

    const signauxDetectes = [];
    if (regularite.seuilApplique === 'desengagement_precoce' && regularite.nbSeancesRecentes < SEUIL_DESENGAGEMENT_PRECOCE) {
      signauxDetectes.push({
        code: 'DESENGAGEMENT_PRECOCE',
        description: `Seulement ${regularite.nbSeancesRecentes} séance(s) sur les ${FENETRE_RECENTE_JOURS} derniers jours, sous le seuil de vigilance.`,
        poids: 1,
      });
    }
    if (tendance === 'en_baisse') {
      signauxDetectes.push({
        code: 'REGULARITE_EN_BAISSE',
        description: 'Baisse de régularité confirmée sur plusieurs points de mesure consécutifs.',
        poids: 1,
      });
    }

    return {
      plaisirDeclare: undefined, // non implémenté en V1, cf. en-tête de fichier
      regulariteRecente: regularite.valeur,
      tendanceEngagement: tendance,
      signauxDetectes,
      confiance,
      calculeLe: new Date().toISOString(),
    };
  }

  global.DecisionEngineEngagement = {
    calculerEngagementState,
    calculerRegulariteRecente, // exposée pour tests unitaires isolés
    calculerTendanceEngagement, // idem
    calculerConfianceEngagement, // idem
  };

})(window);
