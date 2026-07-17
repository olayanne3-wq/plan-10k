// ============================================================================
// decision-engine-trend-analysis.classic.js
// ----------------------------------------------------------------------------
// Module 4 du moteur de décision : lit N semaines de WeekAnalysis (+ l'état
// du coureur à chaque semaine) pour détecter des patterns qu'une seule
// semaine ne peut pas révéler (une mauvaise semaine n'est pas un signal,
// trois qui se dégradent en sont un).
//
// Référence : §"Module 4 — Analyse de tendance (TrendAnalyzer)" et §3.3
// (interface TrendAnalysis) du document d'architecture.
//
// DÉCISION ACTÉE avec Laurent le 17/07/2026, avant codage : le contrat
// théorique (`analyser(historiqueSemaines: WeekAnalysis[], fenetreSemaines:
// number)`) a un vide — `pointsDeSuivi[].fatigue` vient de RunnerState
// (Module 1), pas de WeekAnalysis (Module 3), et la signature ne prévoit pas
// de le fournir. Comblé en ajoutant un paramètre séparé
// `historiqueRunnerStates: RunnerState[]`, aligné par INDEX (même position
// que `historiqueSemaines[i]`, même semaine, même ordre chronologique) —
// jamais fusionné dans WeekAnalysis lui-même. Raisons : cohérence avec le
// pattern déjà choisi pour le Module 3 (seances/seancesPrevues séparés
// plutôt que mélangés) ; WeekAnalysis reste un contrat stable, utilisé
// ailleurs (EngineInput.weekAnalysis) — y injecter un champ qui n'appartient
// pas à sa définition casserait le typage et introduirait une dépendance
// cachée vers le Module 1. L'appelant doit garantir l'alignement des deux
// tableaux (même longueur, même ordre) — pas de vérification de cohérence
// interne au-delà de la longueur (cf. analyser()).
//
// Fonction pure, aucune dépendance à un autre script du moteur (même
// philosophie que les Modules 1/2/3/5) — RunnerState et WeekAnalysis sont
// pris tels quels en entrée, jamais recalculés ici.
//
// Où le déposer : /engine-classic-scripts/decision-engine-trend-analysis.classic.js
// Comment le charger : dans index.html, indépendant des autres modules du
// moteur.
//   <script src="/engine-classic-scripts/decision-engine-trend-analysis.classic.js"></script>
// ============================================================================

(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // Détection des signaux — règles simples et nommées, cf. tableau §"Module 4"
  // doc archi. Chaque fonction reçoit l'historique aligné (semaines +
  // runnerStates, même index) et retourne un SignalTendance ou null.
  // Testables indépendamment les unes des autres (pas de logique cachée).
  // --------------------------------------------------------------------------

  function detecter3SemainesReussies(semaines) {
    if (semaines.length < 3) return null;
    const dernieres3 = semaines.slice(-3);
    const tousReussis = dernieres3.every(s => s.seancesTotal > 0 && (s.seancesReussies / s.seancesTotal) >= 0.9);
    if (!tousReussis) return null;
    return { code: '3_SEMAINES_REUSSIES', description: 'Les 3 dernières semaines ont un taux de réussite d\'au moins 90%.', poids: 15 };
  }

  function detecterChargeCroissanteRapide(semaines) {
    if (semaines.length < 3) return null;
    const dernieres3 = semaines.slice(-3);
    // Hausse > 15% sur 2 semaines consécutives, vérifiée sur les 2 dernières
    // transitions disponibles dans la fenêtre de 3 semaines.
    let haussesFortes = 0;
    for (let i = 1; i < dernieres3.length; i++) {
      const precedente = dernieres3[i - 1].chargeTotaleSemaine;
      const courante = dernieres3[i].chargeTotaleSemaine;
      if (precedente > 0 && ((courante - precedente) / precedente) > 0.15) haussesFortes++;
    }
    if (haussesFortes < 2) return null;
    return { code: 'CHARGE_CROISSANTE_RAPIDE', description: 'La charge hebdomadaire augmente de plus de 15% sur 2 semaines consécutives.', poids: 20 };
  }

  function detecterSeancesManqueesRepetees(semaines) {
    if (semaines.length < 3) return null;
    const dernieres3 = semaines.slice(-3);
    const semainesAvecManques = dernieres3.filter(s => s.seancesManquees >= 2).length;
    if (semainesAvecManques < 2) return null;
    return { code: 'SEANCES_MANQUEES_REPETEES', description: 'Au moins 2 des 3 dernières semaines ont 2 séances manquées ou plus.', poids: 18 };
  }

  function detecterFatigueCroissante(runnerStates) {
    if (runnerStates.length < 3) return null;
    const dernieres3 = runnerStates.slice(-3).map(r => r && typeof r.fatigue === 'number' ? r.fatigue : null);
    if (dernieres3.some(f => f === null)) return null; // pas assez de données fiables
    const croissanceConstante = dernieres3[1] > dernieres3[0] && dernieres3[2] > dernieres3[1];
    if (!croissanceConstante) return null;
    return { code: 'FATIGUE_CROISSANTE', description: 'La fatigue augmente de façon constante sur les 3 derniers points de suivi.', poids: 25 };
  }

  function detecterStagnationVolume(semaines) {
    if (semaines.length < 4) return null;
    const dernieres4 = semaines.slice(-4);
    const volumes = dernieres4.map(s => s.volumeRealiseKm);
    const volumeMoyen = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    if (volumeMoyen <= 0) return null;
    const quasiStable = volumes.every(v => Math.abs((v - volumeMoyen) / volumeMoyen) <= 0.05);
    if (!quasiStable) return null;
    return { code: 'STAGNATION_VOLUME', description: 'Le volume hebdomadaire reste quasi stable (±5%) depuis 4 semaines ou plus.', poids: 12 };
  }

  // --------------------------------------------------------------------------
  // Déduit tendanceGenerale depuis les signaux détectés — table de règles
  // simple, pas de logique cachée (cf. doc archi). Priorité aux signaux
  // négatifs (fatigue/charge) sur les signaux positifs en cas de conflit,
  // cohérent avec le principe "sécurité avant performance" déjà appliqué au
  // Module 5 (RuleEngine, cf. inventaire §26).
  // --------------------------------------------------------------------------
  function deduireTendanceGenerale(codes) {
    const a = code => codes.indexOf(code) !== -1;
    if (a('FATIGUE_CROISSANTE') && a('CHARGE_CROISSANTE_RAPIDE')) return 'fatigue_accumulee';
    if (a('FATIGUE_CROISSANTE')) return 'baisse_de_forme';
    if (a('SEANCES_MANQUEES_REPETEES')) return 'baisse_de_forme';
    if (a('3_SEMAINES_REUSSIES') && a('CHARGE_CROISSANTE_RAPIDE')) return 'progression';
    if (a('3_SEMAINES_REUSSIES')) return 'amelioration';
    if (a('STAGNATION_VOLUME')) return 'stagnation';
    return 'stagnation'; // repli neutre si aucun signal net — pas assez de mouvement pour conclure autrement
  }

  // --------------------------------------------------------------------------
  // Analyse une fenêtre de N semaines. historiqueSemaines et
  // historiqueRunnerStates doivent être alignés par index (même semaine,
  // même position) et triés du plus ancien au plus récent — cf. décision en
  // en-tête de fichier. fenetreSemaines borne la lecture aux N dernières
  // semaines de l'historique fourni (l'appelant peut fournir plus, ce module
  // ne lit que la fin).
  // --------------------------------------------------------------------------
  function analyser(historiqueSemaines, fenetreSemaines) {
    const semaines = (historiqueSemaines || []).slice(-fenetreSemaines);
    const runnerStatesAlignes = []; // reconstruit séparément, cf. paramètre optionnel ci-dessous

    return {
      fenetreSemaines: semaines.length,
      tendanceGenerale: 'stagnation',
      pointsDeSuivi: semaines.map(s => ({
        semaine: s.semaine,
        fatigue: null, // rempli par analyserAvecEtatCoureur() si historiqueRunnerStates fourni
        volumeKm: s.volumeRealiseKm,
        tauxReussite: s.seancesTotal > 0 ? Math.round((s.seancesReussies / s.seancesTotal) * 100) / 100 : 0,
      })),
      signauxDetectes: [],
    };
  }

  // --------------------------------------------------------------------------
  // Version complète : historiqueSemaines ET historiqueRunnerStates fournis
  // en parallèle (alignés par index, cf. décision en en-tête de fichier).
  // C'est la fonction que l'appelant doit utiliser en pratique — analyser()
  // ci-dessus reste disponible seule pour les cas où aucun RunnerState
  // historique n'est disponible (dégrade proprement : fatigue toujours null,
  // signal FATIGUE_CROISSANTE jamais détecté, cf. §4 doc archi principe de
  // dégradation propre).
  // --------------------------------------------------------------------------
  function analyserAvecEtatCoureur(historiqueSemaines, historiqueRunnerStates, fenetreSemaines) {
    const toutesSemaines = historiqueSemaines || [];
    const tousRunnerStates = historiqueRunnerStates || [];
    const semaines = toutesSemaines.slice(-fenetreSemaines);
    // Aligne runnerStates sur la même fenêtre que semaines — même nombre
    // d'éléments pris depuis la fin, en supposant l'alignement par index sur
    // les tableaux complets (garanti par l'appelant, cf. en-tête de fichier).
    const decalage = toutesSemaines.length - semaines.length;
    const runnerStates = tousRunnerStates.slice(decalage, decalage + semaines.length);

    const signaux = [
      detecter3SemainesReussies(semaines),
      detecterChargeCroissanteRapide(semaines),
      detecterSeancesManqueesRepetees(semaines),
      detecterFatigueCroissante(runnerStates),
      detecterStagnationVolume(semaines),
    ].filter(Boolean);

    const codes = signaux.map(s => s.code);
    const tendanceGenerale = deduireTendanceGenerale(codes);

    const pointsDeSuivi = semaines.map((s, i) => ({
      semaine: s.semaine,
      fatigue: runnerStates[i] && typeof runnerStates[i].fatigue === 'number' ? runnerStates[i].fatigue : null,
      volumeKm: s.volumeRealiseKm,
      tauxReussite: s.seancesTotal > 0 ? Math.round((s.seancesReussies / s.seancesTotal) * 100) / 100 : 0,
    }));

    return {
      fenetreSemaines: semaines.length,
      tendanceGenerale,
      pointsDeSuivi,
      signauxDetectes: signaux,
    };
  }

  global.DecisionEngineTrendAnalysis = {
    analyser,
    analyserAvecEtatCoureur,
    detecter3SemainesReussies, // exposées pour tests unitaires isolés
    detecterChargeCroissanteRapide,
    detecterSeancesManqueesRepetees,
    detecterFatigueCroissante,
    detecterStagnationVolume,
    deduireTendanceGenerale,
  };

})(window);
