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

git_retry() {
  local n=0
  local max=3
  local delay=3
  until "$@"; do
    n=$((n+1))
    if [ "$n" -ge "$max" ]; then
      echo "❌ git command failed after ${max} attempts: $*"
      return 1
    fi
    echo "⚠️  git failed (attempt $n/$max). retry in ${delay}s..."
    sleep "$delay"
    delay=$((delay*2))
  done
}

# GitHub쪽 일시적인 408(타임아웃) 완화 옵션
GIT_NET_OPTS=(-c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 -c http.version=HTTP/1.1)
export GIT_TERMINAL_PROMPT=0

echo "→ git fetch"
git_retry git "${GIT_NET_OPTS[@]}" fetch --prune origin

echo "→ git checkout $BRANCH"
git_retry git checkout "$BRANCH"

# ✅ 배포는 원격을 "정답"으로 보고 강제 동기화 (로컬 수정을 남기면 다음 배포가 계속 깨짐)
echo "→ git reset --hard origin/$BRANCH"
git_retry git "${GIT_NET_OPTS[@]}" reset --hard "origin/$BRANCH"

echo "→ git clean (safe)"
git clean -fd >/dev/null 2>&1 || true

echo "→ build server"
# server 폴더가 루트이므로 바로 여기서 빌드

# Node.js 경로 찾기 (nvm, 직접 설치, system 등)
NODE_PATH=""
NPM_PATH=""

# 1. nvm 사용 시 (여러 위치 확인)
NVM_PATHS=(
  "$HOME/.nvm/nvm.sh"
  "/root/.nvm/nvm.sh"
  "/usr/local/nvm/nvm.sh"
  "/opt/nvm/nvm.sh"
)

NVM_LOADED=false
for nvm_path in "${NVM_PATHS[@]}"; do
  if [ -s "$nvm_path" ]; then
    echo "   → Loading nvm from $nvm_path..."
    export NVM_DIR="$(dirname "$nvm_path")"
    source "$nvm_path"
    NVM_LOADED=true
    
    # nvm이 로드되면 최신 Node.js 사용 (21이 있으면 그것 사용)
    if nvm list 21 >/dev/null 2>&1; then
      nvm use 21 2>/dev/null || true
    elif nvm list 20 >/dev/null 2>&1; then
      nvm use 20 2>/dev/null || true
    elif nvm list 18 >/dev/null 2>&1; then
      nvm use 18 2>/dev/null || true
    else
      nvm use default 2>/dev/null || nvm use node 2>/dev/null || true
    fi
    
    # nvm이 로드된 후 PATH 확실히 업데이트
    if [ -n "$NVM_DIR" ]; then
      CURRENT_NODE="$(nvm current 2>/dev/null || echo '')"
      if [ -n "$CURRENT_NODE" ] && [ "$CURRENT_NODE" != "none" ]; then
        NVM_NODE_PATH="$NVM_DIR/versions/node/$CURRENT_NODE/bin"
        if [ -d "$NVM_NODE_PATH" ]; then
          export PATH="$NVM_NODE_PATH:$PATH"
          echo "   → nvm PATH updated: $NVM_NODE_PATH"
        fi
      fi
    fi
    break
  fi
done

# 2. PATH에서 찾기 (nvm 로드 후)
if command -v node >/dev/null 2>&1; then
  NODE_PATH="$(command -v node)"
  NPM_PATH="$(command -v npm || echo '')"
elif [ -f "/usr/local/bin/node" ]; then
  NODE_PATH="/usr/local/bin/node"
  NPM_PATH="/usr/local/bin/npm"
elif [ -f "/usr/bin/node" ]; then
  NODE_PATH="/usr/bin/node"
  NPM_PATH="/usr/bin/npm"
fi

if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
  echo "❌ node not found. Please install Node.js >= 18 on stage server."
  echo "   Install guide:"
  echo "     curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
  echo "     apt-get install -y nodejs"
  exit 1
fi

# Node.js 버전 확인
NODE_VER="$($NODE_PATH -v 2>/dev/null || echo 'unknown')"
NODE_MAJOR="$($NODE_PATH -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo '0')"

echo "   node: $NODE_VER ($NODE_PATH)"

if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "⚠️  Warning: Node.js version is $NODE_VER (requires >= 18)"
fi

# npm 경로 찾기
if [ -z "$NPM_PATH" ] || [ ! -f "$NPM_PATH" ]; then
  # npm이 없으면 node와 같은 디렉토리에서 찾기
  NPM_DIR="$(dirname "$NODE_PATH")"
  if [ -f "$NPM_DIR/npm" ]; then
    NPM_PATH="$NPM_DIR/npm"
  elif command -v npm >/dev/null 2>&1; then
    NPM_PATH="$(command -v npm)"
  else
    echo "❌ npm not found."
    echo "   Node.js path: $NODE_PATH"
    echo "   Please install npm on stage server:"
    echo "     Option 1 (if using nvm): nvm install --latest-npm"
    echo "     Option 2 (system): apt-get update && apt-get install -y npm"
    echo "     Option 3 (with NodeSource): curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs"
    exit 1
  fi
fi

# npm 실행 가능한지 확인
if ! "$NPM_PATH" -v >/dev/null 2>&1; then
  echo "❌ npm is found but not executable: $NPM_PATH"
  exit 1
fi

echo "   npm:  $($NPM_PATH -v 2>/dev/null || echo 'unknown') ($NPM_PATH)"

echo "→ npm ci"
$NPM_PATH ci --no-audit --no-fund

echo "→ npm run build"
$NPM_PATH run build

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

