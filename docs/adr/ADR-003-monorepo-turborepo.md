# ADR-003 : Monorepo avec Turborepo

## Statut
Accepted

## Contexte

SmartTips comprend plusieurs applications distinctes : un frontend Next.js, une API NestJS, et un service ML Python. Il faut décider comment organiser ces applications dans le système de contrôle de version et comment gérer le build, le linting et les tests de façon cohérente.

## Décision

Utilisation d'un **monorepo géré par Turborepo** avec pnpm workspaces.

Structure :
```
smarttips/
├── apps/
│   ├── web/          # Next.js 14
│   └── api/          # NestJS
├── packages/
│   ├── shared/       # Types TypeScript partagés, DTOs, constantes
│   └── config/       # Configs ESLint, TypeScript, Prettier partagées
└── ml-service/       # FastAPI (Python, hors workspace pnpm)
```

## Alternatives considérées

### Polyrepo (un repo Git par application)
- ✅ Isolation totale, chaque équipe travaille indépendamment
- ✅ CI/CD plus simple par service
- ❌ Partage de types entre frontend et backend impossible sans package publié
- ❌ Synchronisation des changements breaking entre repos laborieuse
- ❌ Pour un projet solo de portfolio, la friction administrative est disproportionnée

### Monorepo sans outil de build (simple dossier)
- ✅ Zéro configuration supplémentaire
- ❌ Aucune optimisation : chaque `build` recompile tout
- ❌ Pas de cache distribué, pas de pipeline de tâches

### Nx
- ✅ Très puissant, cache distribué, graph de dépendances avancé
- ❌ Courbe d'apprentissage plus steep que Turborepo
- ❌ Configuration plus verbeuse pour un projet de cette taille

### Turborepo + pnpm workspaces (choix retenu)
- ✅ Configuration minimale, rapide à mettre en place
- ✅ Cache intelligent : ne rebuild que ce qui a changé
- ✅ Pipeline de tâches (`build` → `lint` → `test`) déclaratif dans `turbo.json`
- ✅ Types TypeScript partagés via `packages/shared` sans publication npm
- ✅ Standard de l'industrie pour les projets Next.js/NestJS

## Conséquences

- Les types partagés (DTOs, interfaces) vivent dans `packages/shared` et sont importés directement par `apps/web` et `apps/api`.
- Le service ML Python (`ml-service/`) est hors du workspace pnpm mais dans le même repo Git pour faciliter le développement local.
- Husky + commitlint sont configurés à la racine du monorepo pour enforcer les conventional commits sur toutes les apps.
- Les GitHub Actions utilisent le cache Turborepo pour accélérer la CI.