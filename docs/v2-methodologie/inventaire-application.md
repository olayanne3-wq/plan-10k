# Inventaire de l'application "Yoria"

> Vue d'ensemble de référence — état ACTUEL du système, à relire en début de
> session. Organisé par thème, pas par session. **L'historique des correctifs,
> bugs et versions livrées vit uniquement dans `changelog.classic.js`** — ne
> pas le dupliquer ici.
>
> ⚠️ **Mettre à jour ce fichier à chaque changement structurel** (nouvel
> écran, nouvelle clé de stockage, nouvelle intégration, pipeline modifié,
> chantier ouvert/fermé). Un simple correctif de bug va dans le changelog,
> pas ici.

## 1. Vue d'ensemble

**Yoria** — PWA + Android TWA de coaching à la course à pied, génère des
plans d'entraînement adaptatifs. Développeur solo : Laurent, objectif
personnel semi-marathon le 1er novembre 2026.

- Repo GitHub : `olayanne3-wq/yoria` (branche `main`)
- Déployé sur Vercel, domaine `yoria.run`
- Stack : vanilla HTML/CSS/JS (modules ES depuis le 19/07/2026), hosting
  statique Vercel, API serverless dans `/api/`
- Backend Supabase (auth + données), intégration Strava

## 2. Arborescence du repo

```
yoria/
├── api/                          # Endpoints serverless (Vercel/Node)
│   ├── coach.js                  # Proxy Claude Haiku (messages coach courts)
│   ├── strava.js                 # OAuth Strava (auth, callback, refresh, activities)
│   ├── weather.js                # Proxy Open-Meteo (prévision + alerte chaleur >28°C)
│   └── config.js                 # Expose SUPABASE_URL/SUPABASE_ANON_KEY au client
├── docs/
│   ├── legal/                    # Confidentialité, CGU/CGV, RGPD, Play Store data safety
│   └── v2-methodologie/
│       ├── inventaire-application.md   # CE FICHIER
│       ├── bibliotheque-seances.md     # Méthodologie des types de séances qualité
│       ├── convergence-v1-v2.md        # Historique des décisions de convergence v1→v2
│       └── (autres docs de contexte : jour-de-course, notes-meteo, etc.)
├── public/
│   ├── index.html                 # App principale (dashboard, ~7300 lignes)
│   ├── privacy.html
│   ├── .well-known/assetlinks.json  # Digital Asset Links (TWA Android)
│   ├── engine-classic-scripts/    # Copies non-module (.classic.js) du moteur v2
│   │   ├── changelog.classic.js    # Historique versions (source de vérité directe,
│   │   │                           # pas de module ES équivalent)
│   │   └── decision-engine-*.classic.js  # Moteur de décision (8 fichiers, UNIQUES,
│   │                               # jamais eu de version module ES — pas une duplication)
│   └── v2/
│       ├── index.html             # Wizard de création de plan
│       └── engine/                # Moteur v2 (modules ES, source de vérité)
│           ├── plan-generator.js
│           ├── plan-forme.js
│           ├── strava.js, weather.js, gist-sync.js
│           └── auth.js, sync-storage.js
```

## 3. Les deux interfaces

| | `public/index.html` | `public/v2/index.html` |
|---|---|---|
| Rôle | App principale : dashboard, suivi, réglages | Wizard : création/paramétrage d'un plan |
| Route | `/` | `/v2` |
| Type de script | `<script type="module">` (converti le 19/07/2026) | Module ES natif |

**Architecture duale (contrainte permanente)** : tout changement dans
`public/v2/engine/*.js` doit être dupliqué dans
`public/engine-classic-scripts/*.classic.js` (suppression des `export` via
sed) — **sauf** les 8 fichiers `decision-engine-*.classic.js`, qui sont des
scripts classiques uniques sans équivalent module ES.

La conversion complète de `index.html`/`v2/index.html` en modules ES est
**terminée** (19/07/2026) : import dynamique au point d'usage, exposition
globale via `Object.assign(window, module)` (sauf `auth.js`/`sync-storage.js`
qui exposent `window.LkAuth`/`window.LkSync` comme objets nommés). Les 7
fichiers `.classic.js` devenus orphelins ont été supprimés du repo.

## 4. Écrans de l'app principale (`index.html`)

Fonctions de rendu (`render*`) :
- `renderSelecteurPlan` — sélection entre plusieurs plans actifs
- `renderDashboard` — écran d'accueil, résumé de la semaine
- `renderWeeks` / `renderWeekDetail` — vue calendrier et détail semaine
- `renderStatusRow`, `showSessionMenu`, `showMoveMenu`, `showRestoreMenu` — gestion des séances
- `renderStats` — statistiques (ACWR, monotonie de charge, etc.)
- `renderCourse` — page jour de course (horaires, parcours, résultat, stratégie)
- `renderHelp` — aide
- `renderSettings` — profil coureur, records personnels, tokens, notifications
- `render` — orchestrateur principal

## 5. Persistance

**localStorage (préfixe `lk_`)** — clés globales (profil/config) :
`lk_profil_coureur`, `lk_github_token`, `lk_strava_token`,
`lk_strava_refresh`, `lk_strava_expires`, `lk_strava_activities`,
`lk_last_sync`.

Clés préfixées par plan (via `clePourPlan()`) : `lk_statuses`,
`lk_hidden_sessions`, `lk_swapped_sessions`, `lk_session_notes`, `lk_notes`,
`lk_checklist`, `lk_adaptations_ignorees`, `lk_last_rebuild`,
`lk_pred_history`, `lk_race_goal`, `lk_race_horaires`, `lk_race_parcours`,
`lk_race_result`, `lk_weather_cache`, `lk_coach_msg`, `lk_coach_date`,
`lk_coach_race_msg`.

**Principe** : toute donnée propre à un plan doit être préfixée — une clé
globale non préfixée est un risque de contamination inter-plans.

**Supabase** — tables `plans_original` (copie figée), `plans_actif`
(version vivante), `plan_donnees`, `integrations` (colonne `v2_gist_id`,
lue/écrite en brut sans JSON.parse/stringify, contrairement aux autres clés).
Sync Realtime activée sur `plan_donnees` (anti-écho 3s). File d'attente de
sync en cas d'échec réseau (`lk_file_attente_sync`, rejouée au retour
réseau et toutes les 5 min, abandon après 10 essais).

## 6. Profil coureur (`lk_profil_coureur`)

```
{
  prenom, nom, dateNaissance, anneeNaissance (dérivée), poids, taille,
  fcMax, fcRepos, sexe, pps,
  records: { "5K": {temps, date?}, "10K": {...}, "Semi": {...}, "Marathon": {...} }
}
```

- `dateNaissance` (YYYY-MM-DD) : catégorie d'âge FFA calculée
  (`calculerCategorieAgeFFA()`, bascule de saison au 1er septembre),
  message anniversaire. `anneeNaissance` reste dérivée automatiquement
  pour compatibilité avec le code existant (Tanaka).
- `fcRepos` (bpm) et `sexe` (`'homme'|'femme'|'autre'`) : champs Réglages,
  consommés par le moteur de décision (pondération TRIMP). Repli sur
  'autre' (moyenne des constantes) si non renseigné.
- Wizard : `preremplirDepuisProfilCoureur()` auto-remplit à partir du
  profil (sélection du record le plus pertinent, repli Riegel sinon).
- `verifierCoherenceRecord()` : écarte un record si écart >10% à
  l'estimation Riegel moyenne des autres records.

## 7. Moteur de plan (`v2/engine/plan-generator.js`)

Pipeline de génération :
1. `computePhases` — découpage en phases (base, construction, affûtage...)
2. `computeVolumeProgression` — progression du volume hebdo
3. `placerSemaine` — répartition des séances dans la semaine
4. `genererContenuQualite` — contenu détaillé séance qualité (12 sous-types,
   paramétrés par niveau — voir `bibliotheque-seances.md`)
5. `genererContenuLongue`, `genererContenuTest`, `genererContenuRace`
6. `repartirVolumeSemaine`
7. `neutraliserJoursApresCourse` — transforme en repos tout jour de la
   dernière semaine après le jour de course
8. `generatePlan` — orchestrateur

Adaptation dynamique : `calculerScoreSemaine`, `analyserAdaptations`,
`appliquerAdaptations`, `regenererStructuresIntervalles` — excluent toujours
les séances déjà passées.

**Stratégie de jour de course** : `calculerStrategieCourse()` (miroir exact
entre `index.html` et `plan-generator.js`) — bornes km fixes pour
Semi/Marathon (tous les 5km + palier à 35km sur marathon), proportionnel
pour 5K/10K.

## 8. Moteur de décision

5 modules, tous livrés et en production (`engine-classic-scripts/decision-engine-*.classic.js`) :

1. **RunnerStateCalculator** — TRIMP/ACWR/fatigue/confiance/risque à partir
   des vraies données Strava (charge aiguë = 7j, charge chronique = moyenne
   sur fenêtres réellement couvertes si historique <28j)
2. **SessionAnalyzer** — score de réussite d'une séance (FC, allure,
   répétitions dans zone `okPace`)
3. **WeekAnalyzer** — bilan hebdomadaire (volume, séances, charge,
   récupération estimée)
4. **TrendAnalyzer** — 5 détecteurs de signaux sur plusieurs semaines
5. **RuleEngine** — catalogue de règles actif :
   - R-006 (pic de séance), R-024s (fatigue élevée), R-040 (désengagement),
     R-050 (ACWR élevé), R-060 (tendance fatigue sur 3 mesures), R-070
     (séances ratées consécutives)
   - R-062 (fatigue persistante 3 semaines, priorité 82)
   - R-080 (déficit volume durable, 3 semaines ≤−10% vs plan, priorité 52)

`DecisionEngineApply` + carte UI : détection automatique, application sur
clic explicite uniquement, `reduire_charge` cible EF/LONGUE/RECUP
uniquement (jamais les séances de qualité — algorithme dédié nécessaire
pour ça, non fait). Garde-fous anti-cumul : −30% max par décision, plafond
cumulé 25%/14j glissants (journal `planBrut.historiqueReductionsMoteur`).

Coach IA branché sur le moteur : lit `RunnerState`/`EngineDecision` du jour,
ne recalcule jamais un ratio séparé, peut commenter la décision mais jamais
en produire une différente.

Monotonie d'entraînement (Foster 1998) : calculée et affichée dans Stats,
sans règle d'alerte (pas de seuils validés pour coureurs récréatifs).

**Non couvert / reporté** :
- Réduction d'intervalles pour séances de qualité (VMA/SEUIL/SPEC) —
  algorithme dédié nécessaire, pas encore conçu
- Saisie de plaisir par séance (PACES-S) — EngagementCalculator tourne sur
  régularité comportementale seule
- R-062/R-070/R-080 jamais observées sur données réelles de Laurent — à
  surveiller

## 9. Saisie manuelle et RPE

**Saisie manuelle** : bouton "Annuler" (réinitialise + relance sync Strava),
champ "durée totale" pour séances de qualité, exclusion Strava complète
quand saisie manuelle existe (injection `ActivitySample` synthétique).

**RPE** : source unique `sessionRpe[uid]`, sélecteur 5 niveaux
(🙂😐😓😣🥵) mappés CR-10, visible dès qu'un statut ✅/⚠️/❌ est posé,
pondération TRIMP +12% si RPE ≥ 8. Libellé affiché en dur sous l'icône
sélectionnée après clic (pas de tooltip seul, ne marche pas sur mobile).

## 10. Import FIT

`adapterFitVersFormatActivite()`, `chargerFitParser()` (import ESM
dynamique depuis jsDelivr, pas de build UMD/browser), `importerFichierFit()`.
`vitesseFiable()` calcule toujours depuis distance/temps, jamais
`avg_speed` du fichier FIT (peut être faux sur Amazfit/Zepp).

## 11. Intégrations externes

**Strava** (Client ID `260339`) — OAuth via `api/strava.js`. Client :
`v2/engine/strava.js`. Sync conditionnelle sur `dataSource === "strava"`
via paramètre `force` (syncs auto respectent le garde, actions explicites
passent `force: true`). Comparaison séance programmée vs laps réels filtrée
par allure cible ±15%.

**Météo** — proxy Open-Meteo (`api/weather.js`), gratuit, sans clé.
Géolocalisation GPS réelle (dernière activité Strava avec GPS, repli
position par défaut sinon).

**Coach (messages courts)** — `api/coach.js`, proxy Claude Haiku 4.5.

**Sync multi-device** — GitHub Gist (`lk_github_token`), géré par
`v2/engine/gist-sync.js`.

## 12. Authentification Supabase

Auth email/mot de passe (pas de Google/Apple sign-in). Variables
`SUPABASE_URL`/`SUPABASE_ANON_KEY` exposées via `api/config.js`
(`fetch('/api/config')` avant création du client, `supabaseReady` à
attendre). Migration douce depuis anciennes clés localStorage.

## 13. Publication Play Store (TWA Android)

- Package : `app.vercel.plan_10k_alpha.twa` (identifiant permanent,
  volontairement inchangé)
- Domaine associé : `yoria.run` (migré depuis `yoria-running.vercel.app`)
- Piste "Tests fermés - Alpha" active, Laurent testeur confirmé
- App en plein écran sans barre de navigation, confirmé
- Icône PWA Chrome bloquée via `beforeinstallprompt` + `preventDefault()`
  (évite la double-icône TWA/PWA)
- Build/signature : voir §"Build TWA Android" dans les mémoires de session
  (procédure figée, keystore critique à ne jamais perdre)

## 14. Mode Forme (v2.6)

Cycle glissant sans date de course, réutilise les briques génériques de
`plan-generator.js` (`placerSemaine`, `genererContenuEF/Longue`,
`repartirVolumeSemaine`, `computeFcMaxTanaka`, `computeZonesFC`) —
n'importe jamais `computePhases`/`ROTATION_SOUS_TYPE`/`placerSeanceTest`/
`placerSeanceCourse`. Câblé de bout en bout (wizard + index.html).

**Reste ouvert** : déclenchement de `genererBlocSuivant()` pas encore câblé
côté `index.html` — décider si automatique ou action explicite utilisateur.

## 15. Principes transverses à retenir

- **Inventaire à jour à chaque push structurel** (pas pour un simple fix)
- **Préfixage des données de plan obligatoire** (`clePourPlan()`)
- **Une seule variable modifiée à la fois** pour la progressive overload
- **Niveau intermédiaire = valeur historique inchangée** à chaque
  différenciation par niveau (zéro régression)
- **Validation historique avant codage** pour toute nouvelle métrique
  (vérifier sur les données réelles de Laurent avant d'investir)
- **Jamais d'apostrophe dans une chaîne JS entre guillemets doubles**
  (échec silencieux du parseur) ; `node --check` systématique avant push
- **404 sur une route API** → vérifier `vercel.json` en premier
- **Toute modification d'un plan existant doit exclure les séances
  passées** — pas un garde-fou générique, à implémenter dans chaque
  nouvelle fonctionnalité qui touche `plans_actif`
- **Ne jamais toucher** `public/beta/`, `api/beta.js`, routes `/beta*`
  sans demande explicite

## 16. État des chantiers ouverts

| Chantier | Statut |
|---|---|
| v2.5 commercialisation (Stripe, abonnements) | 🔜 Non commencé |
| Déclenchement `genererBlocSuivant()` (Mode Forme) | 🔜 À décider |
| Réduction d'intervalles pour séances qualité | 🔜 Session de conception dédiée nécessaire |
| Saisie plaisir par séance (PACES-S) | 🔜 Reporté |
| Republier piste "V2" Play Console | 🔜 Pas urgent, Alpha suffit pour Laurent |
| Nettoyage `lk_gist_id` résiduel | 🔜 Pas urgent |
| Détection auto `invalid access_token` Strava | 🔜 Amélioration future |
| Mise à jour `docs/v2-methodologie/convergence-v1-v2.md` | 🔜 Post-conversion modules ES, pas critique |

Pour l'historique des versions livrées et des correctifs, voir
`changelog.classic.js`. Pour le détail méthodologique des séances, voir
`bibliotheque-seances.md`.
