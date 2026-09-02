#!/bin/bash
# Проверки на результате слияния: локальные наборы по областям и разбор
# конфигурации compose на сервере.
#
# Запускается, когда рабочая копия уже переведена в отсоединённое состояние
# на FETCH_HEAD (шаг «получить результат слияния»). В любом исходе
# возвращает копию в ветку задачи и убирает временный worktree на сервере.
#
# Использование:
#   merge-checks.sh <stage|production> <номер PR> <ветка задачи> <область>...
#
# Коды возврата:
#   0  все наборы прошли
#   1  набор не прошёл, в выводе какой именно
#   2  неверные аргументы или неизвестный контур
#   3  нет доступа к серверу
#   4  нет backend/.env, набор backend невыполним
#   6  уборка не удалась: временный worktree остался на сервере

set -uo pipefail

usage() {
  cat >&2 <<USAGE
Использование: $(basename "$0") <stage|production> <номер PR> <ветка задачи> <область>...
Области: backend frontend agent-runner scripts infra none skills
Пример:  $(basename "$0") stage 42 fix/tema-001 backend frontend
USAGE
}

[ $# -ge 4 ] || { usage; exit 2; }

CONTOUR="$1"; PR="$2"; BRANCH="$3"; shift 3
AREAS="$*"

case "$CONTOUR" in
  stage)
    WORKDIR="/opt/sma-beta"
    COMPOSE_VERIFY="-f /tmp/verify-$PR/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml"
    ;;
  production)
    WORKDIR="/opt/sma-prod"
    COMPOSE_VERIFY="-f /tmp/verify-$PR/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml"
    ;;
  *) echo "Неизвестный контур: $CONTOUR. Допустимо stage или production." >&2; usage; exit 2 ;;
esac

case "$PR" in
  ''|*[!0-9]*) echo "Номер PR должен быть числом, получено: $PR" >&2; exit 2 ;;
esac

git rev-parse --verify --quiet "$BRANCH" >/dev/null || {
  echo "Ветка задачи не найдена: $BRANCH" >&2; exit 2; }

has_area() { case " $AREAS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

WORKTREE_CREATED=0
FAILED=""

# Уборка в любом исходе, включая прерывание: временный worktree удаляется,
# копия возвращается в ветку задачи. Иначе повторный прогон с тем же номером
# PR откажет — путь /tmp/verify-N занят, — а копия останется отсоединённой,
# и следующий коммит потеряется.
cleanup() {
  rc=$?
  # Снять обработчики первым делом: иначе exit в конце этой функции
  # запустит trap EXIT, и уборка выполнится второй раз — worktree
  # уже удалён, git ответит отказом, и скрипт ложно сообщит о неудаче.
  trap - EXIT INT TERM
  if [ "$WORKTREE_CREATED" = "1" ]; then
    if ssh sma "cd $WORKDIR && git worktree remove --force /tmp/verify-$PR" 2>/dev/null; then
      echo "  убран временный worktree /tmp/verify-$PR"
    else
      echo "УБОРКА НЕ УДАЛАСЬ: /tmp/verify-$PR остался на сервере." >&2
      echo "Удалить вручную: ssh sma 'cd $WORKDIR && git worktree remove --force /tmp/verify-$PR'" >&2
      [ "$rc" = "0" ] && rc=6
    fi
  fi
  git switch "$BRANCH" >/dev/null 2>&1 \
    && echo "  рабочая копия возвращена в ветку $BRANCH" \
    || echo "ВНИМАНИЕ: не удалось вернуться в ветку $BRANCH, копия отсоединена." >&2
  exit "$rc"
}
# Сигналы обрабатываются отдельно: прерванный прогон обязан вернуть
# ненулевой код, иначе агент сочтёт проверки пройденными. 130 и 143 —
# обычные коды для SIGINT и SIGTERM.
trap cleanup EXIT
trap 'echo "Прервано сигналом INT." >&2; exit 130' INT
trap 'echo "Прервано сигналом TERM." >&2; exit 143' TERM

run() {
  label="$1"; shift
  echo "-- $label"
  if "$@"; then
    echo "   ок"
  else
    echo "   ОТКАЗ: $label" >&2
    FAILED="$FAILED
$label"
  fi
}

# ── зависимости: ставятся только для задетых областей ──────────────────
prepare() {
  dir="$1"; area="$2"
  has_area "$area" || return 0
  [ -d "$dir/node_modules" ] && return 0
  echo "-- зависимости $dir"
  npm ci --prefix "$dir" >/dev/null 2>&1 \
    && echo "   поставлены" \
    || { echo "   ОТКАЗ: npm ci --prefix $dir" >&2; FAILED="$FAILED
npm ci --prefix $dir"; }
}

# ── локальные наборы ───────────────────────────────────────────────────
if has_area backend; then
  # prisma:generate идёт через dotenv -e .env, файл агент не создаёт
  # и значение не подбирает: см. блок env_file в merge-checks.md
  [ -f backend/.env ] || {
    echo "Нет backend/.env, набор backend невыполним." >&2
    echo "prisma:generate идёт через dotenv и требует DATABASE_URL." >&2
    echo "Значение даёт разработчик. Файл не создавать и значение не подбирать." >&2
    exit 4; }
  prepare backend backend
  run "backend: prisma:generate" npm --prefix backend run prisma:generate
  run "backend: build"           npm --prefix backend run build
  run "backend: test"            npm --prefix backend test
fi

if has_area frontend; then
  prepare web frontend
  run "frontend: build" npm --prefix web run build
fi

if has_area agent-runner; then
  prepare agent-runner agent-runner
  run "agent-runner: typecheck" npm --prefix agent-runner run typecheck
  run "agent-runner: build"     npm --prefix agent-runner run build
fi

if has_area scripts; then
  # Файлы берутся из diff ветки, но проверяются в рабочей копии. Копия
  # должна стоять на результате слияния: иначе файла на диске нет,
  # проверка молча пропустится и скрипт отчитается успехом.
  MISSING=""
  CHECKED=0
  # :(glob) обязателен: без него git не раскрывает * в pathspec
  # и скрипты скилов в набор не попадают
  for f in $(git diff --name-only "origin/prod...$BRANCH" -- scripts/ ':(glob)skills/*/scripts/*'); do
    if [ -f "$f" ]; then
      run "scripts: bash -n $f" bash -n "$f"
      CHECKED=$((CHECKED + 1))
    else
      MISSING="$MISSING $f"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "Файлы есть в diff ветки, но отсутствуют в рабочей копии:$MISSING" >&2
    echo "Копия не на результате слияния. Выполнить шаг «получить результат" >&2
    echo "слияния» и запустить проверки заново." >&2
    exit 2
  fi
  [ "$CHECKED" = "0" ] && echo "-- scripts: изменённых файлов нет"
fi

if has_area backend || has_area infra || has_area scripts || has_area skills; then
  run "deploy metadata safety" bash scripts/verify-deploy-metadata-safety.sh
fi

# ── разбор конфигурации compose на сервере ─────────────────────────────
if has_area infra; then
  ssh -o BatchMode=yes -o ConnectTimeout=10 sma true 2>/dev/null || {
    echo "Нет доступа к серверу по ssh sma." >&2; exit 3; }

  echo "-- сервер: получить результат слияния PR $PR"
  ssh sma "cd $WORKDIR && git fetch origin refs/pull/$PR/merge" || {
    echo "   ОТКАЗ: git fetch refs/pull/$PR/merge на сервере" >&2; exit 1; }

  ssh sma "cd $WORKDIR && git worktree add /tmp/verify-$PR FETCH_HEAD" || {
    echo "   ОТКАЗ: git worktree add /tmp/verify-$PR" >&2; exit 1; }
  WORKTREE_CREATED=1
  echo "   создан /tmp/verify-$PR"

  # -q оставляет только ошибки: полный вывод config печатает значения переменных
  echo "-- сервер: разбор конфигурации compose"
  if ssh sma "docker compose -p sma-service $COMPOSE_VERIFY config -q"; then
    echo "   ок"
  else
    echo "   ОТКАЗ: docker compose config" >&2
    FAILED="$FAILED
docker compose config на сервере"
  fi
fi

# ── итог ───────────────────────────────────────────────────────────────
if has_area none; then
  if [ -z "$AREAS" ] || [ "$(echo "$AREAS" | tr ' ' '\n' | grep -vcE '^none$')" = "0" ]; then
    echo "Автоматических проверок нет: области $AREAS."
  fi
fi

if [ -n "$FAILED" ]; then
  echo >&2
  echo "Не прошли:" >&2
  printf '%s\n' "$FAILED" | sed '/^$/d; s/^/  /' >&2
  exit 1
fi

echo "Все наборы прошли."
exit 0
