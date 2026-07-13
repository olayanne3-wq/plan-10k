# Source de données des séances (Strava / manuel) — Run by Léa

Document de conception du chantier permettant à un utilisateur de suivre son plan et d'alimenter l'estimation 10K **sans dépendre de Strava** — posé avant la mise en ligne sur le Play Store, où les utilisateurs n'auront pas tous un compte Strava. Décisions tranchées le 13 juillet 2026.

---

## 1. Constat de départ

Audit du code existant (`public/index.html`) avant d'ajouter quoi que ce soit :

- Le suivi du plan (validation d'une séance, calcul du taux de complétion, export PDF, adaptation du plan) repose sur `statuses[uid]` (`✅`/`⚠️`/`❌`/`—`), stocké indépendamment de Strava. **Ce mécanisme fonctionne déjà sans Strava** — un bouton de validation manuelle (`renderStatusRow`) existe pour chaque séance.
- Strava (`stravaActivities`) n'intervient que pour **enrichir** l'affichage d'une séance déjà validée (distance/allure/FC réelles, lien vers l'activité) et pour **alimenter le prédicteur 10K** (`predict10K`, `predict10KAtDate`), qui calcule une vitesse moyenne pondérée à partir des laps Strava des séances SPEC et VMA.
- **Sans Strava, le prédicteur reste bloqué sur `BASE_TIME_REFERENCE`** (estimation statique de référence), jamais affiné par la performance réelle. C'est la vraie fonctionnalité qui se dégrade sans Strava — pas le suivi du plan lui-même.

Conclusion : le chantier ne consiste pas à rendre l'app "utilisable sans Strava" (elle l'est déjà pour le suivi), mais à permettre à la **saisie manuelle d'alimenter le prédicteur 10K et l'adaptation du plan** au même titre que Strava.

---

## 2. Principe retenu : pas de hiérarchie entre les sources

Plusieurs pistes explorées et écartées avant de converger sur le principe final :

- ❌ **Décote systématique du poids des séances manuelles** (facteur réduit sur la durée d'effort). Écarté : pénalise un utilisateur 100% manuel sans aucune justification, puisqu'il n'y a rien à comparer dans son cas — la décote n'a de sens qu'en présence d'un conflit entre deux sources sur une même séance, pas comme pénalité globale du mode.
- ❌ **Hiérarchie automatique Strava > manuel en cas de conflit**. Écarté : Strava n'est pas intrinsèquement plus fiable qu'une saisie manuelle (cas d'une montre qui bug — GPS perdu, arrêt prématuré, oubli — Strava enregistre alors une donnée fausse).
- ❌ **Détection automatique d'écart anormal** (seuil sur distance/allure) déclenchant un signal de confirmation. Écarté : ce n'est pas à l'app de deviner si un écart vient d'un bug technique ou d'une vraie variation de performance — c'est au coureur de le savoir et de trancher.

**Décision finale : aucune hiérarchie, aucune décote, aucune détection automatique.**

- Strava et saisie manuelle sont **deux sources à poids strictement égal** dans le prédicteur — le poids d'une séance dépend uniquement de sa durée d'effort (mécanique déjà en place dans `weightedAvgByEffortDuration`), jamais de sa provenance.
- Le bouton de correction/saisie manuelle est **toujours accessible** sur la carte du jour, quel que soit le réglage de source par défaut — pas réservé à un "mode manuel" exclusif.
- **Dès qu'une saisie manuelle existe pour une séance donnée, elle prime automatiquement sur Strava pour cette séance**, sans confirmation ni comparateur. C'est un acte volontaire du coureur (il ne saisit manuellement que s'il a une raison de le faire, typiquement un bug de montre) — l'app n'a pas à le questionner sur son propre choix.
- Le prédicteur agrège l'historique complet sans distinction de source. Aucune rupture ni recalcul spécial lors d'un changement de réglage en cours de plan — les séances déjà validées gardent leurs données telles quelles.

---

## 3. Réglage `dataSource`

Nouveau réglage dans Réglages, **préférence d'affichage par défaut sur la carte du jour — pas un mode exclusif**.

| Valeur | Statut | Comportement |
|---|---|---|
| `strava` | Disponible | Active aujourd'hui (comportement par défaut, rétrocompatible) |
| `manuel` | À implémenter (ce chantier) | Le formulaire de saisie manuelle s'affiche en premier sur la carte du jour |
| `montre` (Garmin, Coros, Polar…) | Prévu, non implémenté | Option visible mais désactivée dans Réglages, pour poser le cap produit |
| `gpx` | Prévu, non implémenté | Idem |

Le réglage ne conditionne que l'affichage par défaut : même en mode `strava`, la correction manuelle reste possible ; même en mode `manuel`, une activité Strava détectée reste affichée si aucune saisie manuelle n'existe pour cette date.

---

## 4. Format de la saisie manuelle

Les laps Strava sont détaillés par répétition (`getLapsAffichage`). Reproduire ce niveau de détail en saisie manuelle serait trop lourd pour un usage sans montre connectée.

**Choix : un "lap virtuel" unique par séance**, injecté dans le même pipeline de calcul que les laps Strava (`weightedAvgByEffortDuration`), sans traitement différencié :

```js
{ average_speed: distanceEffort / tempsEffort, distance: distanceEffort }
```

Champs du formulaire (tous optionnels sauf le statut ✅/⚠️/❌, qui seul suffit à valider la séance) :
- **Allure moyenne de l'effort** (pas l'allure totale de la sortie — cohérent avec ce que `getLapsAffichage` extrait déjà des laps Strava)
- **FC moyenne** (optionnel) — alimente les mêmes garde-fous d'adaptation que la FC Strava quand disponible
- **Ressenti (RPE, échelle simple)** — sert de repli pour l'adaptation du plan quand la FC n'est pas renseignée

Distance d'effort déductible de `structureIntervalles` si non précisée par l'utilisateur (le plan connaît déjà la distance prévue).

---

## 5. Stockage

Suit la convention existante (`statuses`, `hiddenSessions`, etc.) :

```js
let manualPerf = load(clePourPlan("lk_manual_perf"), {}); // {uid: {average_speed, distance, average_heartrate, rpe}}
```

Persisté et synchronisé via Supabase au même titre que `statuses` (à vérifier lors de l'implémentation — cf. section 6, ouvert).

---

## 6. Points ouverts / à vérifier à l'implémentation

- Confirmer que `manualPerf` suit le même chemin de synchronisation Supabase que `statuses` (`LkSync`), pour ne pas recréer un silo localStorage-only.
- Décider si un badge discret ("Saisie manuelle retenue — Strava ignorée pour cette séance") doit apparaître sur la carte quand une correction manuelle écrase une activité Strava existante, pour la transparence — non tranché, mais recommandé pour éviter toute confusion silencieuse.
- Les options `montre` et `gpx` du réglage `dataSource` sont volontairement non fonctionnelles à ce stade — à ne pas confondre avec un chantier à traiter maintenant.
