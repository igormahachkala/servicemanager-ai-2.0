#!/usr/bin/env bash
# Isolated executable regression tests for worktree-prep.sh.
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/worktree-prep.sh"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/worktree-prep-test.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"
CACHE="$TMP/cache"
BIN="$TMP/bin"
PASS=0
FAIL=0

ok() { echo "  PASS $1"; PASS=$((PASS + 1)); }
no() { echo "  FAIL $1"; FAIL=$((FAIL + 1)); }
has() { printf '%s\n' "$OUT" | grep -Fq "$1" && ok "$2" || { no "$2"; echo "$OUT"; }; }
cache_count() { find "$CACHE" -mindepth 1 -maxdepth 1 -type d ! -name '.tmp-*' | wc -l | tr -d ' '; }
run_prep() {
  set +e
  OUT=$(PATH="$BIN:/usr/bin:/bin" SMA_DEP_CACHE="$CACHE" \
    FAKE_NODE_VERSION="${FAKE_NODE_VERSION:-20.0.0}" \
    FAKE_NPM_VERSION="${FAKE_NPM_VERSION:-10.0.0}" \
    FAKE_PLATFORM="${FAKE_PLATFORM:-darwin}" \
    FAKE_ARCH="${FAKE_ARCH:-arm64}" \
    bash "$SCRIPT" "$REPO" 2>&1)
  RC=$?
  set -e
}

set -e
mkdir -p "$REPO/backend/prisma" "$REPO/web" "$REPO/skills/_shared" "$BIN"
printf '{}\n' > "$REPO/backend/package-lock.json"
printf '{}\n' > "$REPO/web/package-lock.json"
printf '{}\n' > "$REPO/web/package.json"
printf 'datasource db { provider = "postgresql" url = env("DATABASE_URL") }\n' > "$REPO/backend/prisma/schema.prisma"

cat > "$BIN/node" <<'NODE'
#!/usr/bin/env bash
case "$2" in
  process.versions.node) printf '%s\n' "${FAKE_NODE_VERSION:-20.0.0}" ;;
  process.platform) printf '%s\n' "${FAKE_PLATFORM:-darwin}" ;;
  process.arch) printf '%s\n' "${FAKE_ARCH:-arm64}" ;;
  *) exit 2 ;;
esac
NODE
cat > "$BIN/npm" <<'NPM'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then printf '%s\n' "${FAKE_NPM_VERSION:-10.0.0}"; exit 0; fi
if [ "${1:-}" = "ci" ]; then
  mkdir -p node_modules/.bin
  if [ -d prisma ]; then
    cat > node_modules/.bin/prisma <<'PRISMA'
#!/usr/bin/env bash
exit 0
PRISMA
    chmod +x node_modules/.bin/prisma
  fi
  exit 0
fi
exit 2
NPM
chmod +x "$BIN/node" "$BIN/npm"

git -C "$REPO" init -q
git -C "$REPO" config user.email test@example.invalid
git -C "$REPO" config user.name test
git -C "$REPO" add .
git -C "$REPO" commit -qm fixture

echo "== A2 worktree-prep self-test =="

run_prep
[ "$RC" -eq 0 ] && ok "initial preparation" || { no "initial preparation"; echo "$OUT"; }
has "Backend dependencies  : installed" "backend installed"
has "Frontend dependencies : installed" "frontend installed"
[ "$(cache_count)" -eq 2 ] && ok "two area caches created" || no "two area caches created"

rm -rf "$REPO/backend/node_modules" "$REPO/web/node_modules"
run_prep
[ "$RC" -eq 0 ] && ok "compatible cache reuse" || no "compatible cache reuse"
has "Backend dependencies  : cache-hit" "backend cache hit"
has "Frontend dependencies : cache-hit" "frontend cache hit"

FAKE_NODE_VERSION=22.0.0 run_prep
has "Backend dependencies  : installed" "Node version mismatch rebuilds"
[ "$(cache_count)" -eq 4 ] && ok "Node version has distinct cache" || no "Node version has distinct cache"

FAKE_NODE_VERSION=20.0.0 FAKE_NPM_VERSION=11.0.0 run_prep
has "Backend dependencies  : installed" "npm version mismatch rebuilds"
[ "$(cache_count)" -eq 6 ] && ok "npm version has distinct cache" || no "npm version has distinct cache"

FAKE_NPM_VERSION=10.0.0 FAKE_PLATFORM=linux run_prep
has "Backend dependencies  : installed" "platform mismatch rebuilds"
[ "$(cache_count)" -eq 8 ] && ok "platform has distinct cache" || no "platform has distinct cache"

FAKE_PLATFORM=darwin FAKE_ARCH=x64 run_prep
has "Backend dependencies  : installed" "architecture mismatch rebuilds"
[ "$(cache_count)" -eq 10 ] && ok "architecture has distinct cache" || no "architecture has distinct cache"

printf 'incompatible-key\n' > "$REPO/backend/node_modules/.sma-lockhash"
run_prep
has "Backend dependencies  : cache-hit" "incompatible worktree marker is not reused"

echo
echo "== results: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
