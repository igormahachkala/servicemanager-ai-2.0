#!/usr/bin/env bash
#
# worktree-prep.sh — A2 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# Prepare an EXISTING ServiceManager.AI git worktree for development/testing:
# give it its OWN, correct backend & frontend dependencies and an up-to-date
# Prisma client, fast, by reusing an immutable lockfile-keyed dependency cache —
# never a shared mutable node_modules, and never a stale Prisma client.
#
# It reads git state (branch/HEAD) but NEVER changes it; makes no commit/push,
# no deploy, no DB connection or mutation, no migration, reads no secrets, and
# does not copy .env files. The only thing it writes outside the worktree is the
# designated dependency cache (default ~/.cache/sma-worktree-deps, override with
# $SMA_DEP_CACHE). It does not touch the active release protocol.
#
# Safety model for concurrent agents:
#   - Each worktree gets its OWN node_modules (a real copy or a fresh install),
#     never a symlink into a shared tree. A symlinked node_modules is treated as
#     unsafe shared state and replaced with an owned copy.
#   - The cache is immutable per (area, package-lock hash, Node, npm, platform,
#     architecture): we copy FROM it and
#     only ever ADD a new key, atomically (build in a temp dir, then mv if absent).
#   - The Prisma client is (re)generated into the worktree's own node_modules
#     whenever the worktree's schema hash differs from the client's stamped hash,
#     so a schema change (e.g. a new enum value) never yields stale-client errors.
#
# Usage:   worktree-prep.sh <worktree-path>
# Env:     SMA_DEP_CACHE   dependency cache root (default ~/.cache/sma-worktree-deps)
#
# Exit codes:
#   0  READY FOR TESTING
#   1  preparation incomplete (an install/generate step failed)
#   2  bad arguments / not a registered worktree / not a ServiceManager.AI repo
#   3  required tool missing (git / npm)
#
set -u

CACHE_ROOT="${SMA_DEP_CACHE:-$HOME/.cache/sma-worktree-deps}"
# Actions are collected in a tempfile so entries written inside command-substitution
# subshells (prepare_area) survive into the final report.
ACTIONS_FILE=$(mktemp "${TMPDIR:-/tmp}/wtprep.XXXXXX")
trap 'rm -f "$ACTIONS_FILE"' EXIT
START=$(date +%s)

die() { echo "worktree-prep: $1" >&2; exit "${2:-2}"; }
log() { echo "      - $1" >> "$ACTIONS_FILE"; }

# portable sha256 → first 16 hex
sha16() { { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1" 2>/dev/null; } | cut -c1-16; }

[ $# -ge 1 ] || die "usage: worktree-prep.sh <worktree-path>" 2
WT=$1
command -v git >/dev/null 2>&1 || die "git not found" 3
command -v npm >/dev/null 2>&1 || die "npm not found" 3
command -v node >/dev/null 2>&1 || die "node not found" 3
[ -d "$WT" ] || die "path does not exist: $WT" 2

# 2a. Registered git worktree?
WT_ABS=$(cd "$WT" 2>/dev/null && pwd) || die "cannot enter path: $WT" 2
git -C "$WT_ABS" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git worktree: $WT_ABS" 2
if ! git -C "$WT_ABS" worktree list --porcelain 2>/dev/null | grep -qx "worktree $(git -C "$WT_ABS" rev-parse --show-toplevel)"; then
  die "path is not a registered git worktree: $WT_ABS" 2
fi
TOP=$(git -C "$WT_ABS" rev-parse --show-toplevel)

NODE_VERSION=$(node -p 'process.versions.node' 2>/dev/null) || die "cannot determine Node version" 3
NPM_VERSION=$(npm --version 2>/dev/null) || die "cannot determine npm version" 3
NODE_PLATFORM=$(node -p 'process.platform' 2>/dev/null) || die "cannot determine Node platform" 3
NODE_ARCH=$(node -p 'process.arch' 2>/dev/null) || die "cannot determine Node architecture" 3
RUNTIME_ID="node=$NODE_VERSION;npm=$NPM_VERSION;platform=$NODE_PLATFORM;arch=$NODE_ARCH"
RUNTIME16=$(printf '%s' "$RUNTIME_ID" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-16)
[ -n "$RUNTIME16" ] || die "cannot hash runtime identity" 3

# 2b. Belongs to ServiceManager.AI? (origin URL or the repo signature)
ORIGIN=$(git -C "$TOP" config --get remote.origin.url 2>/dev/null || true)
if ! printf '%s' "$ORIGIN" | grep -q "servicemanager-ai"; then
  [ -f "$TOP/backend/prisma/schema.prisma" ] && [ -f "$TOP/web/package.json" ] && [ -d "$TOP/skills/_shared" ] \
    || die "not a ServiceManager.AI repository: $TOP" 2
fi

# 2c. Branch + HEAD (read-only).
BRANCH=$(git -C "$TOP" rev-parse --abbrev-ref HEAD 2>/dev/null)
HEAD_SHA=$(git -C "$TOP" rev-parse HEAD 2>/dev/null)

mkdir -p "$CACHE_ROOT" 2>/dev/null || die "cannot create dependency cache: $CACHE_ROOT" 1

# ---- per-area dependency preparation ---------------------------------------
# Echoes a one-word status for the report: reused | cache-hit | installed | missing | failed
prepare_area() {
  area=$1
  adir="$TOP/$area"
  [ -f "$adir/package-lock.json" ] || { echo "n/a"; return 0; }
  lock16=$(sha16 "$adir/package-lock.json")
  cache_key="${lock16}-${RUNTIME16}"
  nm="$adir/node_modules"
  marker="$nm/.sma-lockhash"

  # A symlinked node_modules = unsafe shared state → never reuse, always replace with an owned copy.
  if [ -L "$nm" ]; then
    log "$area: replaced symlinked (shared) node_modules with an owned copy"
    rm -f "$nm"
  elif [ -d "$nm" ] && [ -f "$marker" ] && [ "$(cat "$marker" 2>/dev/null)" = "$cache_key" ]; then
    echo "reused"; return 0          # own, compatible deps already present
  elif [ -d "$nm" ]; then
    # present but incompatible or unstamped — never silently reuse.
    log "$area: existing node_modules incompatible with package-lock ($lock16) — rebuilding"
    rm -rf "$nm"
  fi

  cache="$CACHE_ROOT/${area}-${cache_key}"
  if [ -d "$cache/node_modules" ] && [ -f "$cache/node_modules/.sma-lockhash" ] \
      && [ "$(cat "$cache/node_modules/.sma-lockhash" 2>/dev/null)" = "$cache_key" ]; then
    cp -R "$cache/node_modules" "$nm" || { echo "failed"; return 1; }
    echo "$cache_key" > "$marker"
    log "$area: dependencies copied from cache ($cache_key)"
    echo "cache-hit"; return 0
  fi

  # No compatible cache → clean install in the worktree, then populate the cache atomically.
  ( cd "$adir" && npm ci --no-audit --no-fund >/dev/null 2>&1 ) || { echo "failed"; return 1; }
  echo "$cache_key" > "$marker"
  log "$area: npm ci (no compatible cache for $cache_key)"
  if [ ! -d "$cache/node_modules" ]; then
    tmp="$CACHE_ROOT/.tmp-${area}-${cache_key}-$$"
    rm -rf "$tmp"; mkdir -p "$tmp"
    if cp -R "$nm" "$tmp/node_modules" 2>/dev/null; then
      [ -d "$cache" ] || mv "$tmp" "$cache" 2>/dev/null || true   # first writer wins; others discard
    fi
    rm -rf "$tmp" 2>/dev/null || true
    log "$area: populated dependency cache ($cache_key)"
  fi
  echo "installed"
}

BE_STATUS=$(prepare_area backend); BE_RC=$?
FE_STATUS=$(prepare_area web);     FE_RC=$?

# ---- Prisma client (backend only): regenerate when schema changed -----------
PRISMA_STATUS="n/a"
schema="$TOP/backend/prisma/schema.prisma"
if [ -f "$schema" ] && [ -d "$TOP/backend/node_modules" ] && [ "$BE_STATUS" != "failed" ]; then
  schema16=$(sha16 "$schema")
  cstamp="$TOP/backend/node_modules/.prisma/.sma-schemahash"
  if [ -f "$cstamp" ] && [ "$(cat "$cstamp" 2>/dev/null)" = "$schema16" ]; then
    PRISMA_STATUS="current ($schema16)"
  else
    # generate reads the schema only; it does NOT connect. A throwaway, non-connecting
    # DATABASE_URL is supplied purely so the datasource block parses — no .env, no secret.
    if ( cd "$TOP/backend" && DATABASE_URL="postgresql://preflight:preflight@127.0.0.1:1/none" \
          node_modules/.bin/prisma generate --schema prisma/schema.prisma >/dev/null 2>&1 ); then
      mkdir -p "$TOP/backend/node_modules/.prisma" 2>/dev/null || true
      echo "$schema16" > "$cstamp"
      PRISMA_STATUS="regenerated ($schema16)"
      log "backend: prisma client regenerated for current schema"
    else
      PRISMA_STATUS="FAILED to regenerate"
    fi
  fi
fi

DUR=$(( $(date +%s) - START ))

# lockfile compatibility summary
compat() { case "$1" in reused|cache-hit|installed) echo "compatible";; n/a) echo "n/a";; *) echo "INCOMPATIBLE";; esac; }

READY="YES"
[ "$BE_RC" -ne 0 ] && READY="NO"
[ "$FE_RC" -ne 0 ] && READY="NO"
[ "$PRISMA_STATUS" = "FAILED to regenerate" ] && READY="NO"

echo "WORKTREE PREPARATION"
echo
echo "  Worktree path         : $TOP"
echo "  Branch                : $BRANCH"
echo "  HEAD SHA              : $HEAD_SHA"
echo "  Runtime identity      : $RUNTIME_ID"
echo "  Runtime cache key     : $RUNTIME16"
echo "  Backend dependencies  : $BE_STATUS"
echo "  Frontend dependencies : $FE_STATUS"
echo "  Lockfile compatibility: backend=$(compat "$BE_STATUS"), web=$(compat "$FE_STATUS")"
echo "  Prisma client status  : $PRISMA_STATUS"
echo "  Dependency cache      : $CACHE_ROOT"
if [ -s "$ACTIONS_FILE" ]; then echo "  Actions performed     :"; cat "$ACTIONS_FILE"; else echo "  Actions performed     :"; echo "      - none (already prepared)"; fi
echo "  Duration              : ${DUR}s"
echo
echo "  READY FOR TESTING     : $READY"
echo
echo "  (Prep only — no git branch change, no deploy, no DB, no secrets, no protocol change.)"
[ "$READY" = "YES" ] && exit 0 || exit 1
