#!/usr/bin/env bash
# deploy.sh — Build w13-dealflow and deploy to GitHub Pages (gh-pages branch)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[DEPLOY] Starting deployment for w13-dealflow"

# ── 1. Export latest dealflow data from vault ───────────────────────────────
echo "[DEPLOY] Exporting dealflow data..."
node scripts/export_data.js

# ── 2. Build React app ─────────────────────────────────────────────────────
echo "[DEPLOY] Building React app..."
npm run build

# ── 3. Merge dist/ into public/ for deployment ──────────────────────────────
echo "[DEPLOY] Merging dist/ → public/..."
# Copy dist assets into public/assets
mkdir -p public/assets
cp dist/assets/*.js public/assets/
cp dist/assets/*.css public/assets/
# Copy dist/index.html as public/index.html (the React entry point)
cp dist/index.html public/index.html

# ── 4. Commit and push to gh-pages ─────────────────────────────────────────
echo "[DEPLOY] Committing and pushing to gh-pages..."
git add public/data/ public/index.html public/assets/
git status --short

COMMIT_MSG="Dealflow data $(date +'%Y-%m-%d') [skip ci]"
if git diff --cached --quiet; then
  echo "[DEPLOY] No data changes — skipping commit"
else
  git commit -m "$COMMIT_MSG"
  git push origin gh-pages
  echo "[DEPLOY] Deployed to GitHub Pages!"
fi
