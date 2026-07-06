# Convergence v1 → v2 — Run by Léa

Document de suivi du chantier : faire produire par le moteur générique v2 (`plan-generator.js`) un plan aussi riche que le plan v1 actuel de Laurent (`const PLAN` codé en dur dans `public/index.html`), affiché via l'interface v1 (design conservé).

**Contexte et décision de calendrier** (posée le 6 juillet 2026) : ce chantier est un investissement produit pour l'app finale commercialisée — le moteur v2 doit devenir l'unique source de vérité, quel que soit le profil/objectif de l'utilisateur, pas seulement celui de Laurent. **v1 reste l'outil de suivi quotidien réel jusqu'à Gem'Aubagne (6 septembre 2026)** ; ce chantier se construit en parallèle, sans urgence, et ne remplace v1 qu'après validation post-course.

---

## 1. Principe directeur

Pour chaque écart identifié entre v1 et v2, une décision est prise : **combler** (ajouter au moteur v2), **abandonner** (garder l'approche v2 plus simple), ou **reporter** (décision à prendre plus tard, dépend d'un autre chantier).

Le moteur reste générique : rien de ce qui est ajouté ne doit être spécifique à Laurent ou à Gem'Aubagne — les exemples ci-dessous s'appuient sur son plan actuel mais toute règle ajoutée doit s'exprimer en fonction de paramètres (distance, phase, conditions), pas de valeurs codées en dur.

## 2. Écarts identifiés

### 2.1 Structure warmup / session / cooldown séparés

- **v1** : 3 champs distincts (`warmup`, `session`, `cooldown`) par séance, ex. `"10' footing + éducatifs"` / `"38 min @ 6:20/km"` / `"10' marche + étirements"`
- **v2** : un seul champ `contenu` fusionné, ex. `"20min à allure EF (6:10/km) — 3.2km"`
- **Décision : ABANDONNÉ.** Laurent valide l'approche v2 (bloc unique) comme référence pour le produit final — pas de perte jugée significative sur ce point. *(décidé le 6 juillet 2026)*

### 2.2 Notes contextuelles dynamiques (météo)

- **v1** : notes conditionnelles liées aux conditions du jour, ex. `"Chaleur > 28°C → 6:40/km"` sur une séance EF
- **v2** : aucun mécanisme de note contextuelle ; le moteur ne reçoit aucune donnée externe (météo ou autre)
- **Décision : À COMBLER, en deux temps.**
  1. D'abord des notes statiques utiles par type de séance (rapide à construire, déjà un vrai gain)
  2. Puis des notes conditionnelles réellement dynamiques (ex. ajustement allure si chaleur prévue), qui demandent de brancher une source météo au moteur — chantier dépendant d'une intégration externe (API météo), pas juste du moteur seul
- **Statut : non commencé.**

### 2.3 Notes pratiques par type de séance (hors météo)

- **v1** : conseils pratiques ponctuels sur certains types de séance, ex. sortie longue → `"Hydratation++ · Allonge selon la forme"`
- **v2** : aucune note de ce type actuellement
- **Décision : À COMBLER.** Rejoint le point 2.2 (notes statiques par type), à traiter dans le même chantier.
- **Statut : non commencé.**

## 3. Écarts restant à vérifier

Cette liste sera complétée au fur et à mesure — seules les séances EF et sortie longue de la semaine 1 ont été comparées en détail au 6 juillet 2026. Reste à comparer :
- Séances qualité (Seuil, VMA) — premier aperçu favorable à v2 (déjà proche du niveau de détail v1), à confirmer sur plusieurs semaines/phases
- Semaines de décharge et d'affûtage — contenu et notes spécifiques à ces semaines particulières
- Contenu de la semaine de course elle-même

## 4. Étapes du chantier (rappel, une fois le contenu du moteur jugé suffisant)

1. Faire générer par le moteur v2 un plan aussi proche que possible du plan v1 actuel (mêmes dates, zones d'allure cohérentes) — comparaison côte à côte pour validation
2. Adapter l'affichage de v1 pour lire ce plan généré au lieu du tableau `PLAN` statique, en conservant le design/CSS actuel
3. Migrer les statuts de séances existants (`lk_statuses`, `hiddenSessions`, `swappedSessions`) vers le système `plan.statuses` de v2, pour ne pas perdre l'historique de suivi déjà enregistré
4. Brancher le bouton d'adaptation (`analyserAdaptations`/`appliquerAdaptations`) dans l'interface v1

Aucune de ces étapes n'est commencée à ce jour (6 juillet 2026) — ce document liste le travail de contenu (section 2) à faire avant de s'y attaquer.
