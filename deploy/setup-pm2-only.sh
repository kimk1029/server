#!/usr/bin/env bash
# PM2 설치 및 pnt-stage 앱 실행 (풀 배포 없이)
# 사용법: bash deploy/setup-pm2-only.sh
#
# ※ 프로세스가 자동 재시작되면: systemctl stop pnt-stage (또는 해당 서비스) 먼저 실행

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/kh_dev/server}"
PM2_ENV="${PM2_ENV:-stage}"

echo "== PM2 설치 및 pnt-stage 실행 =="

# nvm 로드 (있으면)
for nvm_path in "$HOME/.nvm/nvm.sh" "/root/.nvm/nvm.sh"; do
  if [ -s "$nvm_path" ]; then
    export NVM_DIR="$(dirname "$nvm_path")"
    source "$nvm_path"
    nvm use 21 2>/dev/null || nvm use 20 2>/dev/null || nvm use default 2>/dev/null || true
    break
  fi
done

NODE_PATH="$(command -v node 2>/dev/null || echo '')"
NPM_PATH="$(command -v npm 2>/dev/null || echo '')"

if [ -z "$NODE_PATH" ] || [ -z "$NPM_PATH" ]; then
  echo "❌ node/npm not found. Install Node.js first."
  exit 1
fi

# PM2 설치
if ! command -v pm2 >/dev/null 2>&1; then
  echo "→ pm2 installing..."
  $NPM_PATH install -g pm2
  export PATH="$(dirname "$NODE_PATH"):$PATH"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 install failed"
  exit 1
fi

echo "   pm2: $(pm2 -v)"

# 기존 node (dist/index.js) 프로세스 종료
echo "→ Stopping existing node server (if any)..."
pkill -f "node.*$REPO_ROOT/dist/index.js" 2>/dev/null || true
sleep 2

cd "$REPO_ROOT"

if [ ! -f "dist/index.js" ]; then
  echo "❌ dist/index.js not found. Run: npm run build"
  exit 1
fi

echo "→ pm2 startOrReload ecosystem.config.js --env $PM2_ENV"
pm2 startOrReload ecosystem.config.js --env "$PM2_ENV"

pm2 save 2>/dev/null || true

echo ""
echo "✅ Done. Check: pm2 list"
pm2 list
