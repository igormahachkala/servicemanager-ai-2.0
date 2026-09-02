#!/bin/bash
# Отчёт о необходимости сброса beta. Ничего не меняет, только читает.
#
# Использование:  beta-audit.sh
# Где запускать:  на машине агента. Нужны git по рабочей копии и gh:
#                 скрипт спрашивает у GitHub состояние PR. На сервере gh
#                 не установлен, там скрипт вернёт 4.
# База сравнения: origin/prod, цель origin/beta
#
# Что печатает:
#   есть ли в beta содержимое сверх prod;
#   ветки, принёсшие это содержимое, с признаками по каждой;
#   живые замки stage-busy;
#   классификацию: не мешает | в работе | удерживается | кандидат
#   на брошенное.
#
# Решение о сбросе принимает пользователь. Скрипт не судит о том,
# вернётся ли человек к задаче.
#
# Коды возврата:
#   0  отчёт составлен, сбрасывать нечего
#   1  отчёт составлен, в beta есть содержимое сверх prod
#   2  неверные аргументы
#   3  git-команда не выполнилась
#   4  gh недоступен либо не авторизован: часть про PR недостоверна
#
# Временного не создаёт, ничего не удаляет: trap не нужен.

set -euo pipefail

BASE="origin/prod"
TARGET="origin/beta"
STALE_DAYS=14          # порог пометки «кандидат на брошенное»; на факты не влияет

usage() {
  echo "Использование: $(basename "$0")" >&2
  echo "Печатает отчёт о необходимости сброса $TARGET до $BASE." >&2
}

[ $# -eq 0 ] || { usage; exit 2; }

for ref in "$BASE" "$TARGET"; do
  git rev-parse --verify --quiet "$ref" >/dev/null || {
    echo "Не найдено: $ref. Выполнить git fetch origin." >&2; exit 3; }
done

command -v gh >/dev/null 2>&1 || { echo "gh не установлен: сведения о PR получить нечем." >&2; exit 4; }
gh auth status >/dev/null 2>&1 || { echo "gh не авторизован: сведения о PR получить нечем." >&2; exit 4; }

NOW=$(date +%s)

# Возраст в днях и часах из unix-времени.
age_of() {
  local ts=$1 sec d h
  sec=$(( NOW - ts ))
  [ "$sec" -lt 0 ] && sec=0
  d=$(( sec / 86400 ))
  h=$(( (sec % 86400) / 3600 ))
  echo "${d}д ${h}ч"
}

echo "Отчёт по сбросу beta"
echo "  база    $BASE   $(git rev-parse --short "$BASE")"
echo "  цель    $TARGET   $(git rev-parse --short "$TARGET")"
echo

DIFF_COUNT=$(git diff --name-only "$BASE" "$TARGET" | wc -l | tr -d ' ') || {
  echo "git diff не выполнился для $BASE...$TARGET" >&2; exit 3; }

if [ "$DIFF_COUNT" -eq 0 ]; then
  echo "Содержимого сверх $BASE нет: сбрасывать нечего."
  echo
fi

echo "Файлов в $TARGET сверх $BASE: $DIFF_COUNT"
echo

# Ветки-источники: вторые родители слияний, не входящие в prod.
FOUND=0
while IFS='|' read -r parents subject; do
  P2=$(echo "$parents" | awk '{print $2}')
  [ -n "$P2" ] || continue
  # Слияние prod в beta: второй родитель уже в prod, содержимого сверх не приносит.
  if git merge-base --is-ancestor "$P2" "$BASE" 2>/dev/null; then
    continue
  fi

  # Имя ветки: сначала из темы слияния, затем поиском вершины в origin.
  BRANCH=$(echo "$subject" | sed -n 's|^Merge pull request #[0-9]* from [^/]*/\(.*\)$|\1|p')
  if [ -z "$BRANCH" ]; then
    BRANCH=$(git ls-remote --heads origin 2>/dev/null | awk -v sha="$P2" '$1 == sha {sub("refs/heads/", "", $2); print $2; exit}')
  fi

  FOUND=$(( FOUND + 1 ))
  if [ -z "$BRANCH" ]; then
    echo "коммит $(git rev-parse --short "$P2")   имя ветки не восстановлено"
    echo "  тема слияния       $subject"
    echo "  →  неопознанное, разбирать вручную"
    echo
    continue
  fi

  echo "$BRANCH"

  CT=$(git log -1 --format=%ct "$P2" 2>/dev/null || echo "")
  if [ -n "$CT" ]; then
    echo "  последний коммит   $(TZ=UTC git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M' "$P2") UTC   возраст $(age_of "$CT")"
  fi

  IN_ORIGIN=нет
  if [ -n "$(git ls-remote --heads origin "$BRANCH" 2>/dev/null)" ]; then IN_ORIGIN=есть; fi
  echo "  ветка в origin     $IN_ORIGIN"

  PR_BETA=$(gh pr list --head "$BRANCH" --base beta --state all --json number,state --jq '.[] | "#\(.number) \(.state)"' 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')
  PR_PROD=$(gh pr list --head "$BRANCH" --base prod --state all --json number,state --jq '.[] | "#\(.number) \(.state)"' 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')
  echo "  PR в beta          ${PR_BETA:-нет}"
  echo "  PR в prod          ${PR_PROD:-нет}"

  STAGE_OK=нет
  if [ -n "$(git ls-remote --tags origin "refs/tags/stage-ok/$BRANCH" 2>/dev/null)" ]; then
    STAGE_OK=есть
  fi
  echo "  stage-ok           $STAGE_OK"

  KEEP=нет
  if [ -n "$(git ls-remote --tags origin "refs/tags/keep/$BRANCH" 2>/dev/null)" ]; then KEEP=есть; fi
  echo "  keep               $KEEP"

  IN_PROD=нет
  if git merge-base --is-ancestor "$P2" "$BASE" 2>/dev/null; then IN_PROD=да; fi
  echo "  влита в prod       $IN_PROD"

  # Классификация.
  PR_OPEN=нет
  case "$PR_BETA $PR_PROD" in *OPEN*) PR_OPEN=да ;; esac
  STALE=нет
  if [ -n "$CT" ]; then
    AGE_DAYS=$(( (NOW - CT) / 86400 ))
    if [ "$AGE_DAYS" -ge "$STALE_DAYS" ]; then STALE=да; fi
  fi

  if [ "$IN_PROD" = "да" ]; then
    VERDICT="не мешает: содержимое уже в prod"
  elif [ "$KEEP" = "есть" ]; then
    VERDICT="удерживается тегом keep"
  elif [ "$PR_OPEN" = "да" ] || [ "$STAGE_OK" = "есть" ]; then
    VERDICT="в работе"
  elif [ "$IN_ORIGIN" = "нет" ] || [ "$STALE" = "да" ]; then
    VERDICT="кандидат на брошенное"
  else
    VERDICT="в работе"
  fi
  echo "  →  $VERDICT"
  echo
done < <(git log --merges --format='%P|%s' "$BASE..$TARGET" 2>/dev/null)

if [ "$FOUND" -eq 0 ] && [ "$DIFF_COUNT" -gt 0 ]; then
  echo "Слияний-источников не найдено: содержимое пришло прямыми коммитами в $TARGET."
  echo
fi

# Замки.
LOCK_RAW=$(git ls-remote --tags origin 'refs/tags/stage-busy' 2>/dev/null || true)
if [ -n "$LOCK_RAW" ]; then
  echo "Живой замок stage-busy: сброс запрещён, независимо от всего выше."
  echo "Разбор — блок classify в skills/_shared/contour-lock.md."
else
  echo "Живых замков stage-busy нет."
fi
echo

if [ "$DIFF_COUNT" -eq 0 ]; then
  echo "Итог: сброс не нужен."
  exit 0
fi
echo "Итог: в $TARGET есть содержимое сверх $BASE. Решение о сбросе принимает пользователь."
exit 1
