# ADR-004 : Service ML séparé (FastAPI + Python)

## Statut
Accepted

## Contexte

Le cœur différenciateur de SmartTips est son modèle de machine learning online qui apprend les patterns de contribution de chaque employé. Il faut décider où et comment héberger ce modèle : intégré dans le backend NestJS existant ou dans un service séparé.

## Décision

Le modèle ML est implémenté dans un **microservice Python séparé** exposant une API REST avec FastAPI, déployé indépendamment sur Fly.io.

Endpoints principaux :
- `POST /predict` → score de contribution prédit pour un employé
- `POST /train` → mise à jour du modèle avec les données d'un shift fermé
- `GET /health` → healthcheck + métriques du modèle
- `GET /metrics/{tenantId}` → MAE, RMSE, R² par tenant

## Alternatives considérées

### ML dans NestJS via TensorFlow.js ou ONNX
- ✅ Un seul service à déployer et opérer
- ✅ Pas de communication réseau inter-service
- ❌ L'écosystème ML Python (River, scikit-learn, numpy) est incomparablement plus riche
- ❌ River n'a pas d'équivalent JavaScript mature pour l'online learning
- ❌ Performance inférieure pour les calculs numériques intensifs

### Job BullMQ dans NestJS (worker dédié ML)
- ✅ Reste dans l'écosystème Node.js
- ✅ Profite de la queue Redis existante
- ❌ Mêmes limitations que l'option précédente sur l'écosystème Python
- ❌ Couplage fort avec le service principal

### Service ML Python séparé (choix retenu)
- ✅ Accès à tout l'écosystème Python : River, scikit-learn, pandas, numpy
- ✅ Déploiement indépendant : on peut scaler le ML sans toucher à l'API
- ✅ Isolation des pannes : si le ML service est down, l'API tombe en fallback sur les règles métier
- ✅ Démonstration d'une architecture microservices réelle (valeur portfolio)
- ⚠️ Latence réseau inter-service → mitigée par retry + circuit breaker dans NestJS
- ⚠️ Un service de plus à opérer → Fly.io free tier suffisant pour la démo

## Conséquences

- NestJS communique avec le ML service via HTTP interne (module `MlClientModule`).
- Circuit breaker implémenté : si le ML service est indisponible, la répartition tombe en mode règles (heures × coefficient de rôle) sans erreur visible pour l'utilisateur.
- Auth interne entre NestJS et ML service via shared secret (`ML_INTERNAL_SECRET`) en variable d'environnement.
- Les modèles River par tenant sont persistés sur Cloudflare R2 (sérialisation pickle) pour survivre aux redémarrages du service.
- Déploiement : Fly.io (ML service) + Railway (API NestJS) + Vercel (frontend).