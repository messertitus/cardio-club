#!/usr/bin/env bash
# Build the PWA (Expo web export) and publish it to the nginx web root.
# Run on the server from the repo:
#   ./deploy/deploy-app.sh
#
# Requires .env at the repo root with EXPO_PUBLIC_SUPABASE_URL,
# EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY and EXPO_PUBLIC_VAPID_PUBLIC_KEY
# (the VAPID key is baked in at build time — see docs/push-setup.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm ci
npm run export:web

sudo mkdir -p /var/www/messers-cardio-club
sudo rsync -a --delete dist/ /var/www/messers-cardio-club/
echo "✓ App published to /var/www/messers-cardio-club"
