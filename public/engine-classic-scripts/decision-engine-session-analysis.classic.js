// ============================================================================
// decision-engine-session-analysis.classic.js
// ----------------------------------------------------------------------------
// Module 2 du moteur de décision : compare une séance de qualité PRÉVUE à sa
// RÉALISATION (écarts allure/FC/volume), produit un SessionAnalysis.
//
// Référence : §6 "Module 2 — Analyse de séance (SessionAnalyzer)" et §3.3
// (interface SessionAnalysis) du document d'architecture.
//
// PÉRIMÈTRE VOLONTAIREMENT RESTREINT (décision Laurent, 17/07/2026) : ce
// module n'analyse QUE les séances de qualité (VMA/SPEC/SEUIL/TEST), pas
// EF/LONGUE/RECUP. Raison : seules les séances de qualité ont une cible
// d'allure précise et resserrée dans Yoria (SESSION_TARGETS, index.html) —
// EF/LONGUE n'ont qu'une zone FC large, l'écart d'allure n'y a pas le même
// sens (l'allure y est volontairement variable selon la fatigue du jour).
//
// Ce module NE RECALCULE PAS les cibles (SESSION_TARGETS/FC_ZONES) : elles
// vivent dans index.html (dépendent du plan chargé, __PLAN_BRUT__.allures) et
// sont transmises en input telles quelles, cf. §"Ce module ne décide de rien.
// Il constate." — même philosophie d'isolation que le RuleEngine (Module 5)
// vis-à-vis du plan.
//
// Où le déposer : /engine-classic-scripts/decision-engine-session-analysis.classic.js
// Comment le charger : dans index.html, indépendant des autres modules du
// moteur (ne dépend d'aucun autre script du moteur), mais doit être chargé
// AVANT tout futur Module 3 (WeekAnalyzer) qui consommera ses sorties.
//   <script src="/engine-classic-scripts/decision-engine-session-analysis.classic.js"></script>
// ============================================================================

(function (global) {
  'use strict';

  const TYPES_QUALITE = ['VMA', 'SPEC', 'SEUIL', 'TEST'];

  // --------------------------------------------------------------------------
  // Convertit une allure "M:SS/km" ou "M:SS" en secondes/km. Retourne null si
  // non parsable — jamais d'exception, cf. philosophie générale du moteur
  // (dégradation propre plutôt que crash), même pattern que ailleurs dans le
  // moteur (parseAllure côté index.html, mais dupliqué ici volontairement :
  // ce module ne doit dépendre d'aucune fonction externe à lui-même).
  // --------------------------------------------------------------------------
  function paceStringVersSecondes(paceStr) {
    if (!paceStr || typeof paceStr !== 'string') return null;
    const nettoye = paceStr.replace('/km', '').trim();
    const parts = nettoye.split(':').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return parts[0] * 60 + parts[1];
  }

  // --------------------------------------------------------------------------
  // Écart d'allure : compare l'allure moyenne réalisée (secondes/km) à la
  // fourchette cible (targetMin/targetMax, secondes/km — plus la valeur est
  // BASSE, plus l'allure est RAPIDE, cf. convention déjà en place dans
  // SESSION_TARGETS). ecartPourcent positif = plus LENT que la cible (allure
  // en secondes plus grande), négatif = plus RAPIDE.
  // --------------------------------------------------------------------------
  function analyserEcartAllure(allureRealiseeSec, cible) {
    if (!allureRealiseeSec || !cible || !cible.targetMin || !cible.targetMax) {
      return { ecartPourcent: 0, dansLaZone: false, commentaire: 'Allure non disponible pour comparaison.' };
    }
    const centreCible = (cible.targetMin + cible.targetMax) / 2;
    const ecartPourcent = Math.round(((allureRealiseeSec - centreCible) / centreCible) * 1000) / 10;
    const dansLaZone = allureRealiseeSec >= cible.targetMin && allureRealiseeSec <= cible.targetMax;

    let commentaire;
    if (dansLaZone) {
      commentaire = 'Allure dans la zone cible.';
    } else if (allureRealiseeSec < cible.targetMin) {
      commentaire = `Allure plus rapide que la cible (${Math.abs(ecartPourcent)}% plus vite).`;
    } else {
      commentaire = `Allure plus lente que la cible (${ecartPourcent}% plus lent).`;
    }
    return { ecartPourcent, dansLaZone, commentaire };
  }

  // --------------------------------------------------------------------------
  // Écart de FC : compare la FC moyenne réalisée à la zone cible (FC_ZONES,
  // bornes en bpm).
  //
  // CORRECTIF (17/07/2026, décision Laurent après discussion) : une FC trop
  // BASSE ne pénalise PLUS. Contrairement à l'allure (où trop rapide EST un
  // problème, cf. analyserEcartAllure), une FC plus basse que prévu n'est pas
  // en soi un signal négatif — elle accompagne souvent une allure plus rapide
  // tenue avec moins d'effort cardiaque que prévu (économie de course), ce
  // qui n'a rien d'un raté. Seule une FC trop HAUTE reste pénalisée (signal
  // réel : fatigue, mauvaise gestion de l'effort, cf. §6 doc archi exemple
  // "FC_TROP_HAUTE"). dansLaZone est donc désormais true dès que la FC est
  // ANORMALE MAIS PAS EXCESSIVE (bornée non plus par zoneFC.min < ... < max,
  // mais par ... <= zoneFC.max seulement).
  // --------------------------------------------------------------------------
  function analyserEcartFC(fcMoyenneRealisee, zoneFC) {
    if (!fcMoyenneRealisee || !zoneFC || !zoneFC.min || !zoneFC.max) {
      return { ecartPourcent: 0, dansLaZone: false, commentaire: 'FC non disponible pour comparaison.' };
    }
    const centreZone = (zoneFC.min + zoneFC.max) / 2;
    const ecartPourcent = Math.round(((fcMoyenneRealisee - centreZone) / centreZone) * 1000) / 10;
    // FC basse : jamais pénalisée. dansLaZone vrai dès que fcMoyenneRealisee <= zoneFC.max.
    const dansLaZone = fcMoyenneRealisee <= zoneFC.max;

    let commentaire;
    if (fcMoyenneRealisee > zoneFC.max) {
      commentaire = `FC au-dessus de la zone cible (${ecartPourcent}%).`;
    } else if (fcMoyenneRealisee < zoneFC.min) {
      commentaire = `FC en-dessous de la zone cible (${Math.abs(ecartPourcent)}%) — pas pénalisant.`;
    } else {
      commentaire = 'FC dans la zone cible.';
    }
    return { ecartPourcent, dansLaZone, commentaire };
  }


  // --------------------------------------------------------------------------
  // Répétitions : remplace l'ancienne analyse "volume" (17/07/2026, décision
  // Laurent). Une comparaison de distance totale ne capture pas le cas d'un
  // abandon en cours de séance : la montre enregistre les créneaux prévus
  // même si une répétition est marchée (récupération forcée), donc la
  // distance totale peut rester proche de la cible même avec une répétition
  // ratée en plein milieu — cf. discussion 17/07/2026. Le signal pertinent
  // est le TAUX DE RÉPÉTITIONS DANS LA ZONE D'ALLURE, pas la distance globale.
  //
  // Réutilise exactement la même logique que ailleurs dans l'app (§6106-6139
  // index.html, validateSuggestion) : okPace comme seuil par répétition,
  // repOk/repWarn comme ratio minimal de complétion — pour ne PAS avoir deux
  // définitions différentes de "séance de qualité réussie" dans la même app
  // (cf. discussion 17/07/2026 : "ça reste 2 sources").
  //
  // lapsEffort attendu : tableau de { allureSec } — un élément par répétition
  // détectée (peut différer de targetReps si abandon ou répétition en trop).
  // --------------------------------------------------------------------------
  function analyserRepetitions(lapsEffort, targetReps, cible) {
    if (!Array.isArray(lapsEffort) || lapsEffort.length === 0 || !cible || !cible.okPace) {
      return { ecartPourcent: 0, dansLaZone: false, commentaire: 'Répétitions non disponibles pour comparaison.' };
    }

    const nbDansLaZone = lapsEffort.filter(l => l.allureSec && l.allureSec <= cible.okPace).length;
    const tauxReussite = nbDansLaZone / lapsEffort.length;

    // repRatio de complétion : combien de répétitions ont eu lieu par rapport
    // à ce qui était prévu — même calcul que repRatio côté index.html.
    const repRatio = targetReps && cible.repOk ? lapsEffort.length / targetReps : 1;

    // dansLaZone : même critère que le statut ✅ existant (avgPace-like mais
    // ici au niveau répétition individuelle) — la majorité des répétitions
    // dans la zone ET la complétion suffisante.
    const dansLaZone = tauxReussite >= 0.5 && repRatio >= (cible.repOk || 0);

    const ecartPourcent = Math.round((tauxReussite - 1) * 1000) / 10; // négatif si en dessous de 100% de réussite

    let commentaire = `${nbDansLaZone}/${lapsEffort.length} répétitions dans la cible`;
    if (targetReps && lapsEffort.length !== targetReps) {
      commentaire += ` (${lapsEffort.length}/${targetReps} répétitions détectées)`;
    }
    commentaire += '.';

    return { ecartPourcent, dansLaZone, commentaire, nbDansLaZone, nbTotal: lapsEffort.length, tauxReussite: Math.round(tauxReussite * 100) };
  }


  // --------------------------------------------------------------------------
  // difficulteRessentie : déduite du RPE si présent (échelle 1-10, cf. doc
  // archi §5.3), sinon estimée depuis les écarts allure/FC comme proxy
  // imparfait (§6 doc archi : "proxy imparfait, 'inconnue' si aucune donnée
  // fiable"). Le proxy ne se prononce que si un écart franc est mesurable —
  // pas de fausse confiance sur des écarts faibles ou des données absentes.
  // --------------------------------------------------------------------------
  function deduireDifficulteRessentie(ressentiRPE, ecartAllure, ecartFC) {
    if (ressentiRPE !== undefined && ressentiRPE !== null) {
      if (ressentiRPE <= 3) return 'facile';
      if (ressentiRPE <= 6) return 'normale';
      if (ressentiRPE <= 8) return 'difficile';
      return 'tres_difficile';
    }
    // Proxy : une FC nettement au-dessus de la zone à allure cible tenue (ou
    // dépassée) suggère une séance difficile. FC basse n'est PLUS utilisée
    // comme signal de facilité (cf. analyserEcartFC, 17/07/2026) — une FC
    // basse à allure rapide ne veut pas forcément dire "facile", peut aussi
    // être une mesure peu fiable (capteur, échauffement du capteur FC en
    // début de séance). Reste 'inconnue' dans ce cas plutôt que de deviner.
    if (!ecartFC || ecartFC.ecartPourcent === 0) return 'inconnue';
    if (ecartFC.ecartPourcent > 8) return 'difficile';
    return 'inconnue';
  }

  // --------------------------------------------------------------------------
  // scoreReussite : moyenne pondérée des dansLaZone. Répétitions (ex-volume)
  // remonté à 0.35 (17/07/2026) : c'est le signal le plus fiable pour
  // détecter un abandon en cours de séance (cf. analyserRepetitions), donc
  // pas un poids mineur comme l'ancien "volume". Allure et FC ajustés en
  // conséquence pour que le total reste sur 100.
  // --------------------------------------------------------------------------
  function calculerScoreReussite(ecartAllure, ecartFC, ecartRepetitions) {
    const poids = { allure: 0.4, fc: 0.25, repetitions: 0.35 };
    let score = 0;
    if (ecartAllure.dansLaZone) score += poids.allure;
    if (ecartFC.dansLaZone) score += poids.fc;
    if (ecartRepetitions.dansLaZone) score += poids.repetitions;
    return Math.round(score * 100);
  }

  // --------------------------------------------------------------------------
  // alertes : déclenchées par seuils simples, cf. §6 doc archi (exemple donné
  // : FC moyenne > FC max cible + 10% → "FC_TROP_HAUTE", gravité "attention").
  // Ce module ne décide de rien (pas d'ampleur de réduction, pas d'action) —
  // il constate et laisse le moteur de règles (Module 5) réagir s'il le juge
  // pertinent, cf. "Point de vigilance" §6 doc archi.
  //
  // CORRECTIF (17/07/2026) : allure symétrique décidée avec Laurent — trop
  // rapide et trop lent pénalisent à la même hauteur (± même seuil), retiré
  // l'ancienne alerte ALLURE_TROP_RAPIDE distincte à un seuil plus bas que
  // ALLURE_TROP_LENTE. Un seul seuil ALLURE_HORS_ZONE couvre les deux sens.
  // --------------------------------------------------------------------------
  function detecterAlertes(ecartAllure, ecartFC) {
    const alertes = [];
    if (ecartFC.ecartPourcent > 10) {
      alertes.push({ code: 'FC_TROP_HAUTE', gravite: 'attention' });
    }
    if (Math.abs(ecartAllure.ecartPourcent) > 10 && !ecartAllure.dansLaZone) {
      alertes.push({ code: 'ALLURE_HORS_ZONE', gravite: 'attention' });
    }
    return alertes;
  }

  // --------------------------------------------------------------------------
  // Point d'entrée principal du Module 2.
  //
  // seanceRealisee attendu : { seanceId, allureMoyenneSec (nombre, secondes/km
  //   — PAS une string "M:SS", cf. paceStringVersSecondes si besoin de
  //   convertir en amont), fcMoyenne, ressentiRPE, lapsEffort (tableau de
  //   { allureSec }, un élément par répétition détectée, cf. analyserRepetitions),
  //   targetReps (nombre de répétitions prévues par le plan, pour détecter un
  //   abandon en cours de séance) }
  // ciblesSeance attendu : { type, allureCible: {targetMin, targetMax, okPace,
  //   warnPace, repOk, repWarn} (= SESSION_TARGETS[type] côté index.html),
  //   zoneFC: {min,max} (= FC_ZONES[type] côté index.html) }
  //
  // Retourne null si le type de séance n'est pas une séance qualité (cf.
  // périmètre restreint en en-tête) — pas une erreur, juste hors scope.
  // --------------------------------------------------------------------------
  function analyser(seanceRealisee, ciblesSeance) {
    if (!seanceRealisee || !ciblesSeance || !ciblesSeance.type) return null;
    if (TYPES_QUALITE.indexOf(ciblesSeance.type) === -1) return null; // hors périmètre, cf. en-tête

    const ecartAllure = analyserEcartAllure(seanceRealisee.allureMoyenneSec, ciblesSeance.allureCible);
    const ecartFC = analyserEcartFC(seanceRealisee.fcMoyenne, ciblesSeance.zoneFC);
    const ecartRepetitions = analyserRepetitions(seanceRealisee.lapsEffort, seanceRealisee.targetReps, ciblesSeance.allureCible);

    const scoreReussite = calculerScoreReussite(ecartAllure, ecartFC, ecartRepetitions);
    const difficulteRessentie = deduireDifficulteRessentie(seanceRealisee.ressentiRPE, ecartAllure, ecartFC);
    const alertes = detecterAlertes(ecartAllure, ecartFC);

    return {
      seanceId: seanceRealisee.seanceId || null,
      reussite: scoreReussite >= 60, // seuil simple : majorité des critères pondérés dans la zone
      scoreReussite,
      difficulteRessentie,
      derive: {
        allure: ecartAllure,
        frequenceCardiaque: ecartFC,
        repetitions: ecartRepetitions,
      },
      alertes,
      calculeLe: new Date().toISOString(),
    };
  }

  global.DecisionEngineSessionAnalysis = {
    analyser,
    paceStringVersSecondes,        // exposée pour que index.html puisse convertir avant appel
    analyserEcartAllure,           // exposées pour tests unitaires isolés
    analyserEcartFC,
    analyserRepetitions,
    calculerScoreReussite,
    deduireDifficulteRessentie,
    detecterAlertes,
    TYPES_QUALITE,
  };

})(window);
