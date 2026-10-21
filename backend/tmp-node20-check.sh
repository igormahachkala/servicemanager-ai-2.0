#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" --no-use
nvm install 20
nvm alias default 20
cd /home/igor/projects/sma-service/backend
nvm use 20
node -v
npm -v
npx prisma generate
npm run build
