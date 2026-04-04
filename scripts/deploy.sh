#!/usr/bin/env bash
# deploy.sh — runs daily dealflow scan + exports + deploys to GitHub Pages
set -e

SITE_DIR="$HOME/Sites/w13-dealflow"
VAULT_SCRIPTS="$HOME/Documents/Obsidian Vault/Brain/scripts"
GH_TOKEN_FILE="$HOME/.config/vault-backup/github_token"

echo "[W13 DEPLOY] $(date)"

# 1. Run dealflow scan
echo "[DEPLOY] Running dealflow scan..."
python3 "$VAULT_SCRIPTS/dealflow_daily.py" > /dev/null 2>&1

# 2. Export data to site
echo "[DEPLOY] Exporting data..."
cd "$SITE_DIR"
node scripts/export_data.js > /dev/null 2>&1

# 3. Commit + push (pushes to gh-pages if on main, or just commits)
git add data/today.json data/archive.json index.html
if git diff --cached --quiet; then
    echo "[DEPLOY] No data changes — skipping push"
else
    git commit -m "W13 Dealflow $(date '+%Y-%m-%d') — auto-deploy"
    export GH_TOKEN=$(cat "$GH_TOKEN_FILE")
    export GITHUB_TOKEN=$(cat "$GH_TOKEN_FILE")
    git push origin gh-pages 2>&1 | tail -2
    echo "[DEPLOY] Pushed to GitHub Pages"
fi
