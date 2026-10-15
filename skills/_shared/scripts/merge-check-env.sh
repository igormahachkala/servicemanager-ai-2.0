#!/usr/bin/env bash
#
# merge-check-env.sh — A4 of SMA_DEVELOPMENT_ACCELERATION_PROTOCOL (DRAFT).
#
# Unblocks LOCAL backend merge-checks that fail only because backend/.env is absent.
#
# Root cause: of the backend merge-check set (prisma:generate, nest build, jest),
# only `prisma:generate` needs backend/.env, and only to supply DATABASE_URL for the
# datasource PARSE — `prisma generate` never connects. This helper supplies a safe,
# synthetic, non-connecting DATABASE_URL for those parse-only checks, and refuses
# (BLOCKED) for operations that need a real database — never substituting a dummy and
# never touching Stage/Production.
#
# It does NOT create/modify/read/symlink backend/.env, reads no secrets, does not
# change merge-checks.sh or the release protocol, and does not weaken any check:
# `prisma generate` still fully validates the schema; build and test are unchanged.
#
# PROTOCOL NOTE — NOT wired into the canonical gate. This is a standalone LOCAL
# developer-loop convenience. It is deliberately NOT integrated into
# skills/_shared/scripts/merge-checks.sh: the canonical protocol makes backend/.env a
# mandatory gate (merge-checks.md <env_file>, exit 4) and its <forbidden> block
# explicitly prohibits "Подставлять DATABASE_URL наугад" (substituting an arbitrary
# DATABASE_URL), declaring the dummy/partial substitute non-equivalent and
# developer-consent-gated. Making merge-checks pass via a synthetic URL would change
# an obligatory release gate — which requires explicit OWNER GO. Until then, use this
# helper only for local iteration, NOT as a substitute for the canonical merge-check.
#
# Subcommands:
#   value                      print the synthetic non-connecting DATABASE_URL
#   export                     print `export DATABASE_URL=…` (eval-able)
#   classify <operation>       print "no-connection" or "real-db" for a named op
#   generate [BACKEND_DIR]     run `prisma generate` with the synthetic URL (no .env,
#                              no connection); default BACKEND_DIR=backend
#   backend-checks [BACKEND_DIR]  run the no-connection backend set: prisma generate +
#                              nest build + jest, with the synthetic URL
#   require-db -- <cmd…>       run a real-DB command ONLY if SMA_MERGE_CHECK_DB_URL is
#                              set to a local test DB (never Stage/Prod); else BLOCKED
#
# Exit codes:
#   0  ok
#   1  a check failed
#   2  bad arguments / environment
#   5  BLOCKED: operation needs a real database and no authorized local DB URL was given
#
set -u

# Synthetic, obviously non-connecting DSN: loopback, port 1, self-describing name.
# Syntactically valid for Prisma's datasource parser; impossible to reach a real DB.
SYNTHETIC_URL='postgresql://preflight:preflight@127.0.0.1:1/preflight_noconnect?schema=public&connect_timeout=1'

die() { echo "merge-check-env: $1" >&2; exit "${2:-2}"; }

# Redact a connection string before any print: drop the password in the userinfo and
# any password=/pwd= query value. Never echo a full DATABASE_URL.
redact_dsn() {
  printf '%s' "$1" | sed -E 's#(://[^:/@]+):[^@]*@#\1:***@#; s#(password=)[^&[:space:]]*#\1***#g; s#(pwd=)[^&[:space:]]*#\1***#g'
}

# Extract the host of a DSN (postgresql://user:pass@HOST:port/db?...).
dsn_host() { printf '%s' "$1" | sed -E 's#^[a-z+]+://##; s#^[^@]*@##; s#[:/?].*$##; s#^\[([^]]*)\]$#\1#'; }

# require-db accepts ONLY a loopback local database. Any non-loopback host (a remote
# dev DB, and a fortiori Stage/Production) is refused — the strict allowlist replaces
# the earlier Stage/Prod blocklist.
is_loopback_dsn() {
  case "$(dsn_host "$1")" in 127.0.0.1|localhost|::1) return 0 ;; *) return 1 ;; esac
}

classify_op() {
  case "$1" in
    *generate*|*validate*|*format*|build|*nest\ build*|test|*jest*|typecheck) echo "no-connection" ;;
    *migrate*|*db\ seed*|*db:seed*|*studio*|*e2e*|*start*|*push*|*pull*|*execute*) echo "real-db" ;;
    *) echo "unknown" ;;
  esac
}

run_generate() {
  bdir="${1:-backend}"
  [ -f "$bdir/prisma/schema.prisma" ] || die "no prisma schema at $bdir/prisma/schema.prisma" 2
  [ -x "$bdir/node_modules/.bin/prisma" ] || die "prisma CLI not installed in $bdir (run worktree-prep first)" 2
  # Inject the synthetic URL into THIS process only; bypass the npm `dotenv -e .env`
  # wrapper by calling prisma directly. No .env is read or written.
  ( cd "$bdir" && DATABASE_URL="$SYNTHETIC_URL" node_modules/.bin/prisma generate --schema prisma/schema.prisma )
}

[ $# -ge 1 ] || die "usage: merge-check-env.sh {value|export|classify|generate|backend-checks|require-db} …" 2
CMD="$1"; shift || true

case "$CMD" in
  value)  printf '%s\n' "$SYNTHETIC_URL" ;;
  export) printf "export DATABASE_URL='%s'\n" "$SYNTHETIC_URL" ;;

  classify)
    [ $# -ge 1 ] || die "classify needs an operation name" 2
    k=$(classify_op "$*")
    echo "operation : $*"
    echo "class     : $k"
    case "$k" in
      no-connection) echo "note      : a synthetic DATABASE_URL suffices; use 'generate' / 'backend-checks'." ;;
      real-db)       echo "note      : needs a real database — BLOCKED without SMA_MERGE_CHECK_DB_URL (OWNER GO); never Stage/Prod." ;;
      *)             echo "note      : unknown operation; classify conservatively as real-db if it may query." ;;
    esac
    ;;

  generate)
    echo "merge-check-env: prisma generate with synthetic non-connecting DATABASE_URL (no .env, no connection)"
    run_generate "${1:-backend}" && echo "  prisma generate: OK" || die "prisma generate failed" 1
    ;;

  backend-checks)
    bdir="${1:-backend}"
    echo "merge-check-env: backend no-connection set (generate + build + test), synthetic DATABASE_URL"
    rc=0
    run_generate "$bdir" && echo "  backend: prisma generate OK" || { echo "  backend: prisma generate FAILED" >&2; rc=1; }
    ( cd "$bdir" && npm run build >/dev/null 2>&1 ) && echo "  backend: build OK" || { echo "  backend: build FAILED" >&2; rc=1; }
    ( cd "$bdir" && npm test  >/dev/null 2>&1 ) && echo "  backend: test OK"  || { echo "  backend: test FAILED"  >&2; rc=1; }
    [ "$rc" -eq 0 ] && echo "  READY: no-connection backend checks passed" || echo "  NOT READY: see failures above" >&2
    exit $rc
    ;;

  require-db)
    [ "${1:-}" = "--" ] && shift
    [ $# -ge 1 ] || die "require-db needs a command after --" 2
    url="${SMA_MERGE_CHECK_DB_URL:-}"
    if [ -z "$url" ]; then
      echo "BLOCKED: this operation needs a real database." >&2
      echo "         It is NOT run with a synthetic URL and is NEVER pointed at Stage/Production." >&2
      echo "         OWNER GO required: provide SMA_MERGE_CHECK_DB_URL for a LOCAL (loopback) test database." >&2
      exit 5
    fi
    # Strict allowlist: only a loopback host is permitted. Any non-loopback target —
    # a remote dev DB, and above all Stage/Production — is refused. The DSN is never
    # printed in full; only the host (password-redacted) appears, for diagnosis.
    if ! is_loopback_dsn "$url"; then
      echo "BLOCKED: SMA_MERGE_CHECK_DB_URL host '$(dsn_host "$url")' is not loopback — refused." >&2
      echo "         Only 127.0.0.1 / localhost / ::1 is allowed; never a remote, Stage, or Production host." >&2
      exit 5
    fi
    echo "merge-check-env: running real-DB command against an authorized LOCAL loopback database (host $(dsn_host "$url"))"
    DATABASE_URL="$url" "$@"
    ;;

  *) die "unknown subcommand: $CMD" 2 ;;
esac
