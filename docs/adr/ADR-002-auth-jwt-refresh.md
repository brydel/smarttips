# ADR-002 : Auth JWT avec refresh tokens stockés en base de données

## Statut
Accepted

## Contexte

SmartTips nécessite un système d'authentification pour trois types d'utilisateurs : OWNER (gérant), MANAGER, et EMPLOYEE. L'auth doit être sécurisée, sans dépendance externe payante, et permettre la révocation de sessions (ex. : employé licencié).

## Décision

Utilisation de **JWT (access token court + refresh token long) avec les refresh tokens hashés stockés en base de données** (table `RefreshToken`).

- Access token : durée de vie 15 minutes, stocké en mémoire React (pas en localStorage)
- Refresh token : durée de vie 7 jours, stocké en cookie httpOnly, hashé en BD avec bcrypt
- Auto-refresh transparent côté frontend via intercepteur Axios (file d'attente + mutex)

## Alternatives considérées

### Sessions serveur (express-session + Redis)
- ✅ Révocation immédiate possible
- ✅ Simple à implémenter
- ❌ Stateful : chaque requête doit interroger Redis → latence ajoutée
- ❌ Horizontal scaling plus complexe (sticky sessions ou Redis partagé obligatoire)

### Clerk / Auth0 (service tiers)
- ✅ Zéro code auth à écrire, MFA inclus
- ✅ Dashboard de gestion des users
- ❌ Dépendance externe (vendor lock-in)
- ❌ Coût non nul à l'échelle production
- ❌ Perte pédagogique : on n'apprend pas le flux OAuth/JWT réel
- ❌ Moins impressionnant en entrevue technique

### JWT access token uniquement (sans refresh)
- ✅ Implémentation la plus simple
- ❌ Token de longue durée → fenêtre d'attaque large si volé
- ❌ Impossible de révoquer une session spécifique

### JWT + refresh tokens en BD (choix retenu)
- ✅ Stateless pour les access tokens (performance)
- ✅ Révocation possible via suppression du refresh token en BD
- ✅ Fenêtre d'attaque limitée (access token 15 min)
- ✅ Contrôle total, coût $0, valeur pédagogique maximale
- ⚠️ Implémentation plus complexe (intercepteur Axios avec mutex, rotation des refresh tokens)

## Conséquences

- La table `RefreshToken` stocke : `id`, `tokenHash`, `userId`, `tenantId`, `expiresAt`, `revokedAt`, `createdAt`.
- Rotation des refresh tokens : à chaque utilisation, l'ancien token est révoqué et un nouveau est émis.
- Le frontend utilise un mutex pour éviter les appels `/auth/refresh` parallèles sur expiration simultanée.
- Cookie `SameSite=None; Secure` en production (cross-domain Vercel ↔ Railway) — à revisiter si on passe sur le même domaine.
- `DIRECT_URL` Neon à ajouter dans Railway pour que les migrations Prisma fonctionnent en production.