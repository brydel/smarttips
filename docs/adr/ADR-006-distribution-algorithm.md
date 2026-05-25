# ADR-006 — Algorithme de répartition des pourboires

## Statut

Accepté

## Date

2026-05-25

## Contexte

SmartTips doit répartir un pool de pourboires entre les employés d'un shift de manière juste, transparente, déterministe et auditable.

La distribution des pourboires est une opération sensible, car elle touche directement à la rémunération des employés. L'algorithme doit donc éviter les erreurs d'arrondi, garantir que la somme distribuée correspond exactement au montant du pool, empêcher les cas incohérents, et produire une explication vérifiable pour chaque employé.

Cette version constitue le baseline métier basé sur des règles. Elle servira aussi de référence pour les futures versions assistées par ML, notamment lorsque le modèle devra apprendre à proposer des distributions plus optimisées ou plus équitables.

## Décision

Nous avons décidé d'implémenter un algorithme de distribution basé sur un score pondéré par employé.

Le calcul prend en compte :

- le rôle de l'employé pendant le shift ;
- le coefficient individuel de l'employé ;
- les heures travaillées ;
- les ventes générées par les rôles vendeurs ;
- un minimum garanti par heure ;
- un plafond maximal par employé ;
- une allocation exacte en cents pour garantir l'intégrité financière.

---

## Formule de score

Chaque employé reçoit un score calculé ainsi :

```txt
score = coefficient_rôle × coefficient_employé × heures_travaillées × salesBonus
```

Le salesBonus est calculé ainsi :

```txt
salesBonus = 1 + ((ventes_employé - moyenne_ventes_shift) / moyenne_ventes_shift) × salesBonusWeight
```

Cependant, le bonus de vente s'applique uniquement aux rôles éligibles aux ventes.

Les rôles actuellement éligibles aux ventes sont :

- SERVER
- BARTENDER

Pour les rôles non vendeurs, ou si la moyenne des ventes du shift est égale à 0, le bonus reste neutre :

```txt
salesBonus = 1
```

Cela évite de pénaliser les employés qui ne génèrent pas directement de ventes, comme les bussers, hosts, cooks ou chefs.

## Répartition proportionnelle

Une fois les scores calculés, le pool est réparti proportionnellement :

```txt
tip_employé = (score_employé / somme_des_scores) × pool_total
```

Cette étape donne un montant brut théorique par employé.

Le montant final peut ensuite être ajusté par les garde-fous métier : minimum garanti, plafond maximal, et arrondis.

## Garde-fous métier

Les garde-fous sont appliqués pour éviter les distributions injustes ou dangereuses.

### 1. Minimum garanti

Chaque employé peut recevoir un montant minimal basé sur ses heures travaillées :

```txt
minimum = minimumPerHour × hoursWorked
```

Exemple :

```txt
minimumPerHour = 2.00 $
hoursWorked = 8
minimum = 16.00 $
```

Si le montant brut d'un employé est inférieur à ce minimum, l'algorithme marque `minimumApplied = true`.

Si la somme des minimums dépasse le pool disponible, la distribution est refusée avec une erreur explicite :

```txt
error.distribution.minimumPoolInsufficient
```

Cette décision est volontaire : le système ne doit pas créer de l'argent artificiellement ni masquer une configuration impossible.

### 2. Plafond maximal par employé

Aucun employé ne peut recevoir plus que `maxSharePercent` du pool total.

Exemple :

```txt
pool_total = 1000.00 $
maxSharePercent = 35 %
maximum par employé = 350.00 $
```

Si un employé dominant dépasse ce plafond, son montant est plafonné et le surplus est redistribué aux autres employés éligibles.

Si le plafond rend mathématiquement impossible la distribution complète du pool, la distribution est refusée :

```txt
error.distribution.capPreventsFullAllocation
```

Exemple d'impossibilité :

```txt
2 employés
maxSharePercent = 35 %
capacité totale = 70 %
```

Dans ce cas, il est impossible de distribuer 100 % du pool sans dépasser le plafond.

### 3. Minimum supérieur au plafond

Si le minimum garanti d'un employé dépasse son plafond maximal, la distribution est refusée :

```txt
error.distribution.minimumExceedsCap
```

Cela évite une contradiction métier entre deux règles de configuration.

## Gestion des montants et des arrondis

Les montants sont manipulés avec `Prisma.Decimal` et convertis en cents entiers pour l'allocation finale.

L'objectif est d'éviter les erreurs liées aux nombres flottants JavaScript.

Le système garantit que :

```txt
somme_des_distributions = pool_total
```

au cent près, sans tolérance.

## Méthode d'allocation des restes

L'algorithme utilise une approche inspirée de la méthode du plus grand reste.

Les montants bruts sont calculés, convertis en cents, puis arrondis vers le bas. Les cents restants sont ensuite redistribués de manière déterministe.

Le tri de redistribution utilise :

1. la fraction décimale restante la plus élevée ;
2. puis `employeeId` comme critère secondaire.

Le critère `employeeId` garantit que deux exécutions avec les mêmes données produisent exactement le même résultat.

## Fallback

Si la somme des scores est égale à 0, l'algorithme utilise une répartition proportionnelle aux heures travaillées.

```txt
tip_employé = (heures_employé / total_heures) × pool_total
```

Ce fallback est strictement limité au cas où `totalScore = 0`.

Il ne sert pas à masquer une erreur inattendue. Une erreur inattendue doit bloquer la distribution au lieu de produire une répartition silencieuse.

## Explainability

Chaque distribution générée contient un champ `explanation` au format JSON.

Ce champ permet de comprendre pourquoi un employé a reçu un certain montant.

L'explication contient notamment :

- le coefficient du rôle ;
- le coefficient de l'employé ;
- les heures travaillées ;
- les ventes générées ;
- la moyenne des ventes du shift ;
- le bonus de vente ;
- le score brut ;
- la part du score ;
- le montant brut ;
- le montant minimum ;
- le plafond ;
- si le minimum a été appliqué ;
- si le plafond a été appliqué ;
- l'ajustement d'arrondi en cents ;
- le montant final.

Exemple conceptuel :

```json
{
  "roleCoefficient": "1.0000",
  "employeeCoefficient": "1.0000",
  "hoursWorked": "8.0000",
  "salesGenerated": "700.00",
  "shiftAvgSales": "500.00",
  "salesBonus": "1.2000",
  "baseScore": "8.0000",
  "rawScore": "9.6000",
  "scoreShare": "0.4200",
  "rawAmount": "210.00",
  "capAmount": "175.00",
  "minAmount": "16.00",
  "capApplied": true,
  "minimumApplied": false,
  "roundingAdjustmentCents": -3500,
  "finalAmount": "175.00"
}
```

Ce champ est essentiel pour la confiance des employés et pour les audits internes.

## Features snapshot

Chaque `TipDistribution` peut également conserver un `featuresSnapshot`.

Ce snapshot capture les données utilisées au moment du calcul :

- rôle ;
- heures travaillées ;
- ventes générées ;
- coefficient employé.

Cela permet de conserver une preuve du calcul même si les données d'origine changent plus tard.

Ce champ prépare aussi le terrain pour les futures versions ML du système.

## Isolation multi-tenant

La configuration de distribution est propre à chaque tenant.

Elle est récupérée depuis le modèle `DistributionConfig`.

Les principaux champs utilisés sont :

- `roleCoefficients`
- `minPerHour`
- `maxSharePct`
- `salesBonusWeight`

Si aucun `DistributionConfig` n'existe pour un tenant, le système applique une configuration par défaut :

```txt
minimumPerHour   = 2.00
maxSharePercent  = 35.00
salesBonusWeight = 0.5
```

Les coefficients par défaut sont :

```txt
SERVER    = 1.0
BARTENDER = 0.9
BUSSER    = 0.7
HOST      = 0.6
COOK      = 0.5
CHEF      = 0.8
```

Chaque requête de distribution est filtrée par `tenantId`.

Aucune distribution ne peut être calculée ou lue pour un autre tenant.

## Sécurité et intégrité

La distribution est exécutée dans une transaction Prisma.

L'opération vérifie :

- que le shift existe ;
- que le shift appartient au tenant courant ;
- que le shift est clôturé ;
- qu'un tip pool existe ;
- que le tip pool est au statut `DECLARED` ;
- qu'aucune distribution active n'existe déjà ;
- que les employés sont actifs ;
- que les heures travaillées sont valides ;
- que le montant total du pool est positif.

La distribution n'est pas rejouable. Le statut du tip pool passe de `DECLARED` à `DISTRIBUTED` avec une condition transactionnelle. Si deux requêtes tentent de distribuer le même pool en même temps, une seule peut réussir.

## Tests

Le moteur de calcul est couvert par des tests unitaires.

Les tests valident notamment :

- l'intégrité du pool ;
- l'allocation exacte des cents ;
- le cas d'un seul employé ;
- les rôles non vendeurs ;
- le plafond maximal ;
- les cas où le plafond rend la distribution impossible ;
- le minimum garanti ;
- les validations métier ;
- le déterminisme.

Résultat actuel :

```txt
Test Suites: 1 passed
Tests:       20 passed
```

## Alternatives considérées

| Alternative | Raison d'écarter |
|---|---|
| Répartition égale pure | Ignore les heures, les rôles et la contribution réelle |
| Points fixes par rôle | Trop rigide et peu adaptable par tenant |
| Calcul uniquement basé sur les ventes | Injuste pour les rôles non vendeurs |
| Calcul en `number` JavaScript | Risque d'erreurs d'arrondi sur les montants financiers |
| Arrondi simple `ROUND_HALF_UP` | Ne garantit pas que la somme finale égale exactement le pool |
| Fallback automatique sur toute erreur | Trop dangereux, peut masquer un bug financier |

## Conséquences positives

- L'algorithme est déterministe.
- La somme distribuée est garantie égale au pool.
- Les cas impossibles sont refusés explicitement.
- Les montants sont calculés en cents pour éviter les erreurs monétaires.
- Chaque distribution est explicable et auditable.
- La configuration est personnalisable par tenant.
- Le système prépare l'intégration future du ML.
- Les tests couvrent les invariants critiques.

## Conséquences négatives

- L'algorithme est plus complexe qu'une répartition simple.
- Certaines configurations peuvent être refusées si elles sont mathématiquement impossibles.
- Les managers devront comprendre l'impact de `minimumPerHour` et `maxSharePercent`.
- Une mauvaise configuration tenant peut empêcher la distribution tant qu'elle n'est pas corrigée.

## Invariants obligatoires

1. Aucun montant final ne doit être négatif.
2. La somme finale doit être exactement égale au pool.
3. Un employé ne doit pas dépasser le plafond configuré.
4. Le minimum garanti doit être appliqué uniquement s'il est mathématiquement possible.
5. Deux exécutions avec les mêmes entrées doivent produire le même résultat.
6. Une distribution déjà créée ne doit pas être recréée.
7. Les données d'un tenant ne doivent jamais influencer un autre tenant.

## Décision finale

Nous adoptons cet algorithme comme baseline officiel de distribution des pourboires dans SmartTips.

Il sera utilisé comme référence stable pour les premières versions du produit.

Les futures versions pourront introduire des stratégies supplémentaires, notamment :

- distribution assistée par ML ;
- audit automatique de fairness ;
- recommandations de configuration ;
- détection d'anomalies ;
- comparaison entre règles métier et prédictions ML.

Ces évolutions devront préserver les mêmes invariants financiers et auditables que cette version.