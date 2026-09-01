#!/bin/bash
# Определение областей изменения по списку изменённых файлов.
# Правила перенесены без изменений из area-map.md, который до 1 сентября 2026
# лежал в skills/_shared/. Исходник: _claude/tasks/git-flow/_file_history/area-map.md
#
# Использование:  area-map.sh <ветка задачи>
# База сравнения: origin/prod
# Ссылка задачи:  сначала локальная <ветка>, при её отсутствии origin/<ветка>
#
# Вывод:  areas: backend frontend
#         flags: has_migration
#
# Коды возврата:
#   0  области определены
#   1  неизвестный путь: перечислены в выводе, поток останавливается
#   2  неверные аргументы
#   3  git-команда не выполнилась
#   5  изменений относительно базы нет: ветка уже влита либо пуста

set -euo pipefail

BASE="origin/prod"

usage() {
  echo "Использование: $(basename "$0") <ветка задачи>" >&2
  echo "Определяет области изменения ветки относительно $BASE." >&2
}

[ $# -eq 1 ] || { usage; exit 2; }
BRANCH="$1"

git rev-parse --verify --quiet "$BASE" >/dev/null || {
  echo "Не найдено: $BASE. Выполнить git fetch origin." >&2; exit 3; }
# Ссылка задачи: сначала локальная ветка, при её отсутствии origin/<ветка>.
# Порядок обязателен. Область определяется до публикации ветки, шаг 2 скила:
# origin/<ветка> в этот момент либо отсутствует, либо указывает на прежнее
# состояние. Обратный порядок вернул бы неполный список областей с кодом 0,
# без признака ошибки.
# Запасной разбор нужен для клона на сервере: git fetch создаёт только ссылки
# origin/<имя>, локальных веток задач там нет.
REF="$BRANCH"
git rev-parse --verify --quiet "$REF" >/dev/null || REF="origin/$BRANCH"
git rev-parse --verify --quiet "$REF" >/dev/null || {
  echo "Ветка не найдена ни как $BRANCH, ни как origin/$BRANCH" >&2; exit 3; }
[ "$REF" = "$BRANCH" ] || echo "Локальной ветки $BRANCH нет, взята $REF" >&2

# core.quotepath=false: иначе пути с кириллицей приходят в кавычках
# и с восьмеричным экранированием, и правила по ним не срабатывают
FILES="$(git -c core.quotepath=false diff --name-only "$BASE...$REF")" || {
  echo "git diff не выполнился для $BASE...$REF" >&2; exit 3; }

if [ -z "$FILES" ]; then
  echo "Изменений относительно $BASE нет: ветка $REF уже влита либо пуста." >&2
  echo "Разворачивать нечего. Остановиться и сообщить пользователю." >&2
  exit 5
fi

# Область одного пути. Порядок ветвей задаёт старшинство:
# более точное правило стоит выше и побеждает.
area_of() {
  case "$1" in
    test/docker-compose.test.yml)  echo infra ;;
    docs/nginx-*.conf)             echo nginx ;;
    backend/*)                     echo backend ;;
    web/*)                         echo frontend ;;
    agent-runner/*)                echo agent-runner ;;
    scripts/*)                     echo scripts ;;
    skills/*/scripts/*)            echo scripts ;;
    skills/*)                      echo skills ;;
    .claude/skills/*)              echo skills ;;
    .claude/*)                     echo none ;;
    docs_pdf/*)                    echo none ;;
    docs/*)                        echo none ;;
    .cursor/*)                     echo none ;;
    .gitignore|.cursorignore)      echo none ;;
    child|child/*|.npm-cache/*)    echo none ;;
    docker-compose*.yml)           echo infra ;;
    *.md)                          echo none ;;
    *)                             echo UNKNOWN ;;
  esac
}

AREAS=""
UNKNOWN=""
HAS_MIGRATION=""
NEEDS_REBUILD=""

add_area() {
  case " $AREAS " in *" $1 "*) ;; *) AREAS="$AREAS $1" ;; esac
}

# читается построчно: имя файла может содержать пробел
while IFS= read -r f; do
  [ -n "$f" ] || continue
  a="$(area_of "$f")"
  if [ "$a" = "UNKNOWN" ]; then
    UNKNOWN="$UNKNOWN
$f"
  else
    add_area "$a"
  fi

  case "$f" in
    backend/prisma/schema.prisma|backend/prisma/migrations/*)
      HAS_MIGRATION="has_migration" ;;
  esac
  case "$f" in
    backend/Dockerfile|web/Dockerfile|*/docker-entrypoint.sh)
      NEEDS_REBUILD="needs_rebuild" ;;
  esac
done <<EOF
$FILES
EOF

if [ -n "$UNKNOWN" ]; then
  echo "Неизвестный путь, область не определена:" >&2
  printf '%s\n' "$UNKNOWN" | sed '/^$/d; s/^/  /' >&2
  echo "Остановиться и спросить пользователя, к какой области отнести." >&2
  exit 1
fi

# none учитывается только если других совпадений нет
case " $AREAS " in
  *" none "*)
    OTHER=""
    for a in $AREAS; do [ "$a" = "none" ] || OTHER="$OTHER $a"; done
    [ -n "$OTHER" ] && AREAS="$OTHER"
    ;;
esac

echo "areas:$AREAS"
echo "flags: $HAS_MIGRATION $NEEDS_REBUILD" | sed 's/  */ /g; s/ *$//'
