#!/usr/bin/env bash
set -euo pipefail

# This script is intended to run ON the stage server (Ubuntu in Docker).
# It pulls latest main, builds server, and restarts PM2 process.

REPO_ROOT="${REPO_ROOT:-/kh_dev/server}"      # server 폴더 위치: /kh_dev/server
BRANCH="${BRANCH:-main}"
PM2_ENV="${PM2_ENV:-stage}"

LOCK_FILE="/tmp/pnt-stage-deploy.lock"

echo "== PNT stage deploy =="
echo "Repo:   $REPO_ROOT"
echo "Branch: $BRANCH"
echo "Env:    $PM2_ENV"
echo "Time:   $(date -Is)"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "❌ REPO_ROOT is not a git repo: $REPO_ROOT"
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "❌ Another deploy is running (lock: $LOCK_FILE)"
  exit 1
fi

cd "$REPO_ROOT"

echo "→ git fetch"
git fetch --prune origin

echo "→ git checkout $BRANCH"
git checkout "$BRANCH"

echo "→ git pull (ff-only)"
git pull --ff-only origin "$BRANCH"

echo "→ build server"
# server 폴더가 루트이므로 바로 여기서 빌드

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. Please install Node.js >= 18 on stage server."
  exit 1
fi

NODE_VER="$(node -v || true)"
echo "   node: $NODE_VER"

echo "→ npm ci"
npm ci --no-audit --no-fund

echo "→ npm run build"
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 not found. Install once on stage server:"
  echo "   npm i -g pm2"
  exit 1
fi

echo "→ pm2 startOrReload (PORT=9991)"
pm2 startOrReload ecosystem.config.js --env "$PM2_ENV"

echo "→ pm2 save (optional, ignore errors)"
pm2 save || true

echo "✅ Deploy done: $(date -Is)"

