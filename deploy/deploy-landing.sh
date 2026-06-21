#!/usr/bin/env bash
# Build the landing page and publish it to the nginx web root.
# Run on the server (or anywhere with the repo + Node) from the repo:
#   ./deploy/deploy-landing.sh
#
# Requires landing/.env with PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY
# (publishable key only). Without it the build falls back to committed JSON.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/landing"

if [ ! -f .env ]; then
  echo "WARNING: landing/.env missing — live data will fall back to JSON." >&2
fi

npm ci
npm run build

sudo mkdir -p /var/www/landing
sudo rsync -a --delete dist/ /var/www/landing/
echo "✓ Landing published to /var/www/landing"
