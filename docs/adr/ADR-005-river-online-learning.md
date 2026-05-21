# ADR-005 : River pour l'online learning (apprentissage incrémental)

## Statut
Accepted

## Contexte

Le modèle ML de SmartTips doit apprendre les patterns de contribution de chaque employé au fil des shifts. La question centrale est : doit-on réentraîner un modèle batch périodiquement, ou utiliser un algorithme d'online learning qui se met à jour après chaque shift ?

## Décision

Utilisation de **River**, la librairie Python de référence pour l'online machine learning (anciennement creme + scikit-multiflow).

Pipeline par tenant :
```
StandardScaler → LinearRegression (online) ou HoeffdingTreeRegressor
```

Un modèle River distinct par tenant, sérialisé sur Cloudflare R2 après chaque mise à jour.

## Alternatives considérées

### Réentraînement batch nuitier (scikit-learn)
- ✅ Modèles très connus, documentation abondante
- ✅ Métriques et outils de validation matures
- ❌ Nécessite de stocker l'historique complet de chaque tenant pour réentraîner
- ❌ Le modèle est figé entre deux entraînements (toute la nuit potentiellement)
- ❌ Coût computationnel élevé à mesure que les données s'accumulent
- ❌ Pas de différenciation réelle par rapport à des solutions existantes (7shifts, Toast ont déjà des analytics batch)

### Modèle de règles fixes (pas de ML)
- ✅ Déterministe, explicable, zéro surprise
- ✅ Simple à implémenter et à auditer
- ❌ Pas d'apprentissage : ne capture pas les nuances individuelles des employés
- ❌ Élimine le différenciateur principal de SmartTips

### PyTorch / modèles deep learning
- ✅ Très puissant pour les données volumineuses
- ❌ Totalement disproportionné pour des datasets de quelques dizaines d'employés par restaurant
- ❌ Pas conçu pour l'online learning natif
- ❌ Coût d'infrastructure GPU injustifiable

### River — online learning (choix retenu)
- ✅ Le modèle se met à jour après **chaque shift fermé**, sans stocker l'historique
- ✅ S'adapte naturellement aux changements de personnel, de saison, de menu
- ✅ Empreinte mémoire constante (pas d'accumulation de dataset)
- ✅ Différenciateur technique clair et défendable en entrevue
- ✅ Les ajustements manuels du manager deviennent des signaux d'entraînement (feedback loop)
- ⚠️ Cold start : les premières prédictions sont peu précises → fallback sur règles pendant les N premiers shifts
- ⚠️ Moins connu que scikit-learn → avantage en entrevue (montre de la curiosité technique)

## Conséquences

- Chaque tenant dispose de son propre modèle River isolé (conformément à ADR-001).
- **Cold start** : les 10 premiers shifts d'un tenant utilisent les règles métier (heures × coefficient de rôle). À partir du 11e shift, le modèle River prend le relais progressivement.
- Les features d'entrée du modèle : `role` (one-hot), `hours_worked`, `sales_generated`, `order_count`, `shift_type` (lunch/dinner), `day_of_week`.
- La target : score de contribution normalisé (0–1) calculé à partir du pool déclaré et de la distribution finale validée par le manager.
- Les ajustements manuels du manager (modifier la part d'un employé) sont loggés et réinjectés comme signal d'entraînement au prochain cycle.
- Métriques suivies par tenant : MAE, RMSE, R² — visualisées dans le dashboard ML monitoring (BIS-30).