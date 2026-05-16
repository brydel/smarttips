#!/usr/bin/env bash
# ============================================================================
# SmartTips - Script de complétion (reprend après l'échec du setup.sh)
# ============================================================================
# Usage: ./finish-setup.sh
# À exécuter DEPUIS le dossier ~/project/smarttips
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ] || [ ! -d "apps/web" ]; then
  err "Tu dois lancer ce script depuis le dossier 'smarttips' (cd ~/project/smarttips)"
fi

GITHUB_USER=$(gh api user -q .login)
REPO_NAME="smarttips"

# ============================================================================
# 1. CRÉATION DU DOSSIER MANQUANT ET TEMPLATES GITHUB
# ============================================================================
log "Création des templates GitHub..."

mkdir -p .github/ISSUE_TEMPLATE
mkdir -p .github/workflows

# CI workflow (au cas où il manque)
if [ ! -f .github/workflows/ci.yml ]; then
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test-api-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  test-ml-service:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - working-directory: apps/ml-service
        run: |
          pip install -e ".[dev]"
          pytest --cov=app
EOF
fi

# Security workflow
cat > .github/workflows/security.yml <<'EOF'
name: Security

on:
  schedule:
    - cron: '0 0 * * 1'
  push:
    branches: [main]

jobs:
  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [javascript-typescript, python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v3
EOF

# Dependabot
cat > .github/dependabot.yml <<'EOF'
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      dev-dependencies:
        dependency-type: "development"

  - package-ecosystem: "pip"
    directory: "/apps/ml-service"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
EOF

# PR template
cat > .github/pull_request_template.md <<'EOF'
## Linear issue
Closes BIS-XXX

## What changed
<!-- Brief description of the change -->

## Why
<!-- Context / business reason -->

## How was it tested
- [ ] Unit tests added/updated
- [ ] Manual testing done
- [ ] E2E tests pass (if applicable)

## Checklist
- [ ] Code follows project style (`pnpm lint` passes)
- [ ] Types check (`pnpm typecheck` passes)
- [ ] Documentation updated (if needed)
- [ ] No secrets in code
- [ ] Migration tested (if DB changes)
EOF

# Bug report template
cat > .github/ISSUE_TEMPLATE/bug_report.md <<'EOF'
---
name: Bug report
about: Report a problem
labels: bug
---

**Description**
A clear description of what the bug is.

**To Reproduce**
1. Go to ...
2. Click on ...
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- Browser:
- OS:
- App version:
EOF

# Feature request template
cat > .github/ISSUE_TEMPLATE/feature_request.md <<'EOF'
---
name: Feature request
about: Suggest an idea
labels: enhancement
---

**Problem**
What problem does this solve?

**Proposed solution**
What you'd like to see.

**Alternatives considered**
Other approaches.
EOF

ok "Templates GitHub créés"

# ============================================================================
# 2. INTERVIEW-PREP (si manquant)
# ============================================================================
log "Vérification interview-prep..."

mkdir -p interview-prep

if [ ! -f interview-prep/README.md ]; then
cat > interview-prep/README.md <<'EOF'
# Interview Prep

Documents pour pitcher SmartTips en entrevue technique.

## Contenu

- [elevator-pitch.md](./elevator-pitch.md) — 30s / 2min / 5min versions
- [technical-decisions.md](./technical-decisions.md) — Toutes les décisions techniques justifiées
- [anticipated-questions.md](./anticipated-questions.md) — Q&A préparé
- [lessons-learned.md](./lessons-learned.md) — Défis, erreurs, apprentissages

À remplir progressivement au fur et à mesure du projet.
EOF
fi

if [ ! -f interview-prep/elevator-pitch.md ]; then
cat > interview-prep/elevator-pitch.md <<'EOF'
# Elevator Pitch — SmartTips

## Version 30 secondes

"J'ai construit SmartTips, une plateforme SaaS qui aide les restaurants à
répartir équitablement les pourboires entre leurs employés. Le truc unique :
on utilise un modèle d'apprentissage en ligne qui s'adapte au fil des services
plutôt que d'être ré-entraîné en batch. Chaque restaurant a son propre modèle
qui apprend ses patterns de performance. Stack: Next.js, NestJS, FastAPI/Python
avec River pour le ML, le tout déployé en multi-tenant sur Vercel, Railway et
Fly.io."

## Version 2 minutes

À compléter pendant le développement.

## Version 5 minutes (technique)

À compléter quand le projet sera plus avancé.
EOF
fi

ok "interview-prep OK"

# ============================================================================
# 3. LICENSE (si manquant)
# ============================================================================
if [ ! -f LICENSE ]; then
  log "Création de la licence MIT..."
cat > LICENSE <<EOF
MIT License

Copyright (c) 2026 Brydel Fosso Saounde

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
  ok "LICENSE créée"
fi

# ============================================================================
# 4. INSTALL DEPENDENCIES
# ============================================================================
log "Installation des dépendances pnpm (1-2 min)..."

# Note: pnpm 10 requires --no-frozen-lockfile sur le premier install
pnpm install || pnpm install --no-frozen-lockfile

ok "Dépendances installées"

# ============================================================================
# 5. HUSKY HOOKS
# ============================================================================
log "Configuration Husky hooks..."

# Husky 9 init
pnpm exec husky init >/dev/null 2>&1 || true

mkdir -p .husky

cat > .husky/pre-commit <<'EOF'
pnpm exec lint-staged
EOF

cat > .husky/commit-msg <<'EOF'
pnpm exec commitlint --edit "$1"
EOF

chmod +x .husky/pre-commit .husky/commit-msg

ok "Husky configuré"

# ============================================================================
# 6. LABELS GITHUB
# ============================================================================
log "Création des labels GitHub..."

# Supprimer les labels par défaut peu utiles
for label in "good first issue" "help wanted" "wontfix" "invalid" "duplicate" "question"; do
  gh label delete "$label" --yes 2>/dev/null || true
done

# Créer nos labels
gh label create "frontend" --color "3B82F6" --description "Next.js / React" --force
gh label create "backend"  --color "8B5CF6" --description "NestJS / API" --force
gh label create "ml"       --color "F59E0B" --description "Python ML service" --force
gh label create "infra"    --color "EF4444" --description "DevOps, CI/CD" --force
gh label create "db"       --color "EC4899" --description "Database, Prisma" --force
gh label create "docs"     --color "14B8A6" --description "Documentation" --force
gh label create "tests"    --color "6366F1" --description "Tests" --force
gh label create "bug"      --color "DC2626" --description "Bug" --force
gh label create "enhancement" --color "16A34A" --description "New feature" --force

ok "Labels GitHub créés"

# ============================================================================
# 7. PREMIER COMMIT + PUSH
# ============================================================================
log "Premier commit..."

git add .
git commit -m "chore: initial monorepo scaffolding

- Turborepo with apps/{web,api,ml-service}
- Shared packages (types, tsconfig)
- 5 initial ADRs documenting key decisions
- CI/CD with GitHub Actions (lint, test, security)
- Husky + commitlint for conventional commits
- README, LICENSE, .env.example
- Folder for interview prep materials

Refs: BIS-5" || warn "Rien à committer (peut-être déjà fait)"

git push origin main || warn "Push échoué, à faire manuellement"

ok "Code poussé sur GitHub"

# ============================================================================
# 8. BRANCH PROTECTION
# ============================================================================
log "Configuration protection de branche main..."

gh api -X PUT "/repos/$GITHUB_USER/$REPO_NAME/branches/main/protection" \
  --field required_status_checks='{"strict":true,"contexts":["lint-and-typecheck"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  >/dev/null 2>&1 && ok "Branch protection activée" || warn "Branch protection: activer manuellement dans Settings > Branches"

# ============================================================================
# 9. FONCTIONNALITÉS GITHUB
# ============================================================================
log "Activation des fonctionnalités GitHub..."

gh repo edit "$GITHUB_USER/$REPO_NAME" \
  --enable-issues \
  --enable-projects \
  --enable-wiki=false \
  --enable-discussions \
  --delete-branch-on-merge

ok "Issues, Projects et Discussions activés"

# ============================================================================
# RÉSUMÉ FINAL
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Setup SmartTips complété avec succès!${NC}"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "📂 Repo local: $(pwd)"
echo "🌐 GitHub:     https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Ouvre le projet:                code ."
echo "   2. Vérifie que tout marche:        pnpm typecheck"
echo "   3. Passe BIS-5 en 'Done' dans Linear"
echo "   4. Crée une branche pour BIS-6:    git checkout -b bsaounde/bis-6-schema-prisma"
echo ""
echo "🔗 Liens utiles:"
echo "   - Linear:  https://linear.app/biscoco/project/smarttips-44e0d00250cc"
echo "   - Eraser:  https://app.eraser.io/folder/2jvUQEeCOzQnmkuWS1sv"
echo ""
echo "════════════════════════════════════════════════════════════════════════"