# ADR-001 : Multi-tenancy par row-level (tenant_id)

## Statut
Accepted

## Contexte

SmartTips est une plateforme SaaS multi-tenant destinée aux franchises de restaurants. Chaque restaurant (tenant) doit avoir ses données strictement isolées des autres. Trois stratégies principales existent pour implémenter le multi-tenancy en PostgreSQL.

## Décision

Utilisation du **row-level multi-tenancy** : chaque table métier contient une colonne `tenant_id` (UUID) qui référence le tenant propriétaire de la ligne. Toutes les requêtes filtrent obligatoirement par `tenant_id`.

## Alternatives considérées

### Schema séparé par tenant
Chaque tenant possède son propre schema PostgreSQL (`restaurant_abc.employees`, `restaurant_abc.shifts`, etc.).
- ✅ Isolation forte au niveau base de données
- ✅ Migrations par tenant possibles
- ❌ Complexité opérationnelle élevée : N schemas à migrer à chaque déploiement
- ❌ Pool de connexions plus difficile à gérer (Prisma supporte mal le switching de schema dynamique)
- ❌ Sur-ingénierie pour notre échelle actuelle

### Base de données séparée par tenant
Un cluster PostgreSQL (ou une base Neon) par tenant.
- ✅ Isolation maximale, idéal pour clients enterprise exigeants
- ❌ Coût prohibitif à l'échelle de démo
- ❌ Opération très complexe (N connexions, N migrations)
- ❌ Impossible à maintenir sans infrastructure DevOps dédiée

### Row-level (choix retenu)
Une seule base, une seule migration, `tenant_id` sur chaque table.
- ✅ Migration unique pour tous les tenants
- ✅ Un seul pool de connexions Prisma
- ✅ Déploiement simplifié sur Neon
- ✅ Suffisant pour notre cible (franchises PME, pas d'exigences enterprise)
- ⚠️ Risque de data leak si `tenant_id` omis dans une requête → mitigation via guards NestJS systématiques et middleware d'injection du contexte tenant

## Conséquences

- Chaque module NestJS doit extraire le `tenantId` du JWT et l'injecter dans chaque query Prisma.
- Un `TenantGuard` global intercepte toutes les requêtes authentifiées pour valider et propager le contexte tenant.
- Les soft deletes (`deletedAt`) sont obligatoires pour conformité légale — les lignes supprimées restent en base filtrées par `tenant_id`.
- Les UUID sont utilisés comme clés primaires pour éviter l'énumération inter-tenant.