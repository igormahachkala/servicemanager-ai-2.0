#!/bin/bash
# Занятие контура замком. Проверяет занятость, ставит свой замок, разбирает
# чужой. Слияние PR не выполняет: оно остаётся отдельным вызовом агента.
#
# Использование:  lock-acquire.sh <контур> <ветка задачи> <номер PR>
#                 занять контур
#
#                 lock-acquire.sh --owned <контур> <ветка задачи>
#                 проверить, что замок стоит и он ваш. Этот режим ставится
#                 слева от слияния: gh pr merge выполняется, только если
#                 проверка вернула 0.
#
#                 контур: stage | production
# Где запускать:  на машине агента. Нужен git по рабочей копии; gh нужен
#                 только для разбора чужого замка и его отсутствие
#                 не мешает занять свободный контур.
#
# Коды возврата:
#   0  контур ваш: замок поставлен либо уже стоял и ветка в нём ваша
#   1  контур занят другим агентом: разбор напечатан, дальше не идти
#   2  неверные аргументы
#   3  git-команда не выполнилась
#   5  контур заняли между проверкой и постановкой: повторить позже
#
# Механизм: skills/_shared/contour-lock.md
# Разбор чужого замка и редкие отказы:
#   skills/_shared/references/contour-lock-cases.md
# Временного не создаёт, ничего не удаляет, кроме своего локального тега
# при отказе push.

set -euo pipefail

usage() {
  echo "Использование:" >&2
  echo "  $(basename "$0") <stage|production> <ветка задачи> <номер PR>   занять контур" >&2
  echo "  $(basename "$0") --owned <stage|production> <ветка задачи>      замок стоит и он ваш?" >&2
}

MODE=acquire
if [ "${1:-}" = "--owned" ]; then
  MODE=owned
  shift
  [ $# -eq 2 ] || { usage; exit 2; }
  CONTOUR="$1"
  BRANCH="$2"
  PR=""
else
  [ $# -eq 3 ] || { usage; exit 2; }
  CONTOUR="$1"
  BRANCH="$2"
  PR="$3"
fi

case "$CONTOUR" in
  stage)      TAG="stage-busy"; WORKDIR="/opt/sma-beta"; THRESHOLD_H=4 ;;
  production) TAG="prod-busy";  WORKDIR="/opt/sma-prod"; THRESHOLD_H=2 ;;
  *) echo "Неизвестный контур: $CONTOUR. Ожидается stage либо production." >&2; usage; exit 2 ;;
esac

[ -n "$BRANCH" ] || { echo "Пустое имя ветки." >&2; exit 2; }
[ "$MODE" = "owned" ] || [ -n "$PR" ] || { echo "Пустой номер PR." >&2; exit 2; }

# Режим проверки владения. Ставится слева от слияния.
if [ "$MODE" = "owned" ]; then
  git fetch --prune --prune-tags origin >/dev/null 2>&1 || {
    echo "git fetch не выполнился." >&2; exit 3; }
  if [ -z "$(git ls-remote --tags origin "refs/tags/$TAG" 2>/dev/null || true)" ]; then
    echo "Замка $TAG нет: контур не занят вами, сливать нельзя." >&2
    exit 1
  fi
  git fetch origin "tag $TAG" >/dev/null 2>&1 || true
  OWNER=$(git tag -l --format='%(contents)' "$TAG" 2>/dev/null | awk -F': ' '/^branch: /{print $2; exit}')
  if [ "$OWNER" = "$BRANCH" ]; then
    exit 0
  fi
  echo "Замок $TAG принадлежит ветке ${OWNER:-неизвестной}, а не $BRANCH: сливать нельзя." >&2
  exit 1
fi

# Вычистить локальные теги, снятые в origin: иначе постановка упрётся
# в собственный мусор, блок stale_local_tags справочника
# skills/_shared/references/contour-lock-cases.md.
git fetch --prune --prune-tags origin >/dev/null 2>&1 || {
  echo "git fetch не выполнился." >&2; exit 3; }

REMOTE=$(git ls-remote --tags origin "refs/tags/$TAG" 2>/dev/null || true)

if [ -n "$REMOTE" ]; then
  git fetch origin "tag $TAG" >/dev/null 2>&1 || true
  BODY=$(git tag -l --format='%(contents)' "$TAG" 2>/dev/null || true)
  OWNER=$(echo "$BODY" | awk -F': ' '/^branch: /{print $2; exit}')

  if [ "$OWNER" = "$BRANCH" ]; then
    echo "Замок уже стоит и он ваш: ветка $BRANCH. Ставить заново не нужно."
    exit 0
  fi

  echo "Контур $CONTOUR занят другим агентом."
  echo
  echo "$BODY" | sed 's/^/  /'
  CREATED=$(git for-each-ref --format='%(creatordate:iso)' "refs/tags/$TAG" 2>/dev/null || echo "")
  CREATED_TS=$(git for-each-ref --format='%(creatordate:raw)' "refs/tags/$TAG" 2>/dev/null | awk '{print $1}')
  if [ -n "$CREATED_TS" ]; then
    SEC=$(( $(date +%s) - CREATED_TS ))
    [ "$SEC" -lt 0 ] && SEC=0
    echo "  поставлен          $CREATED"
    echo "  возраст            $(( SEC / 86400 ))д $(( (SEC % 86400) / 3600 ))ч"
    if [ $(( SEC / 3600 )) -ge "$THRESHOLD_H" ]; then
      echo "  порог $THRESHOLD_H ч          превышен: похоже на брошенный"
    fi
  fi

  if [ -n "$OWNER" ]; then
    if [ -n "$(git ls-remote --heads origin "$OWNER" 2>/dev/null)" ]; then
      echo "  ветка в origin     есть"
    else
      echo "  ветка в origin     нет: замок мусорный, задача закрыта"
    fi
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
      PRS=$(gh pr list --head "$OWNER" --state all --json number,state --jq '.[] | "#\(.number) \(.state)"' 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')
      echo "  PR владельца       ${PRS:-нет}"
    else
      echo "  PR владельца       не проверено: gh недоступен"
    fi
  fi

  DEPLOYED=$(ssh sma "cd $WORKDIR && git rev-parse --short HEAD" 2>/dev/null || echo "")
  [ -n "$DEPLOYED" ] && echo "  развёрнуто         $DEPLOYED"

  echo
  echo "Чужой замок не снимать. Показать это пользователю и ждать решения."
  echo "Снятие по его команде выполняется блоком lock_void справочника"
  echo "skills/_shared/references/contour-lock-cases.md."
  exit 1
fi

git tag -a "$TAG" -m "Контур занят
branch: $BRANCH
pr: $PR
agent: $(hostname -s) / $BRANCH
date: $(date -u +%FT%TZ)" || { echo "git tag не выполнился." >&2; exit 3; }

if git push origin "$TAG" >/dev/null 2>&1; then
  echo "Контур $CONTOUR занят: замок $TAG поставлен на ветку $BRANCH, PR #$PR."
  exit 0
fi

git tag -d "$TAG" >/dev/null 2>&1 || true
echo "Контур заняли между проверкой и постановкой: push тега $TAG отклонён." >&2
echo "Свой локальный тег удалён. Повторить позже." >&2
exit 5
