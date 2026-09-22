<!-- Откат слияния из beta. Читается из sma-deploy-stage, когда приёмка
     не прошла и пользователь выбрал откат, когда после stage-ok отказались
     от Production, и из rollback Production, когда откатывают и prod. -->

<purpose>
Убрать из beta код задачи ревёртом слияния. После этого в beta нет кода,
которого нет в prod, и агент может снять stage-busy.
Чинить отказ приёмки вторым слиянием той же ветки нельзя.
</purpose>

<beta_revert>

<when>
Пользователь выбрал откат после отказа приёмки на Stage.
Пользователь отказался от Production после stage-ok.
Слияние в prod не состоялось, а в beta фича есть, и пользователь
выбрал не повторять слияние, а убрать фичу.
Откат Production: после фаз 1 и 2 убрать то же содержимое из beta.
</when>

<lock>
Замок stage-busy на время ревёрта остаётся. Снимать его до того, как
каталог /opt/sma-beta стоит на откаченном beta, нельзя.
</lock>

<record>
SHA коммита слияния в beta записывается сразу после успешного
gh pr merge шага 7 sma-deploy-stage:

git fetch origin beta
git rev-parse origin/beta

Это M. Без него revert -m 1 не к чему применить.
</record>

<command>
git fetch origin
git switch -c revert/beta-&lt;тема&gt; origin/beta
git revert -m 1 &lt;M&gt; --no-edit
git push -u origin revert/beta-&lt;тема&gt;
gh pr create --base beta --head revert/beta-&lt;тема&gt; \
  --title "revert: &lt;тема&gt; from beta" \
  --body "Ревёрт слияния в beta. &lt;почему: отказ приёмки | отказ от Production | откат Production | слияние в prod не повторяем&gt;"
skills/_shared/scripts/lock-acquire.sh --owned stage &lt;ветка задачи&gt; \
  &amp;&amp; gh pr merge &lt;номер revert-PR&gt; --merge --delete-branch=false
</command>

<why_pr>
Код задачи в beta только через PR. Прямой push и сброс beta здесь
не применяются: замок stage-busy запрещает сброс, а ревёрт точечно
убирает одно слияние.
</why_pr>

<explain flag="-m 1">
Отменяется коммит слияния, у него два родителя. -m 1 оставляет первого —
состояние beta до слияния задачи.
</explain>

<after>
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; test -z "$(git status --porcelain)"'
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; git fetch --prune --prune-tags origin'
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; git checkout beta'
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; git pull --ff-only'
</after>
<redeploy if="область требовала подъёма контейнеров">
Повторить пересборку и up -d шага 8 sma-deploy-stage, с --no-deps,
stage_postgres не трогать. Для none, scripts, skills, nginx контейнеры
не поднимать, git pull обязателен.
</redeploy>

<check>
git fetch origin
git merge-base --is-ancestor origin/&lt;ветка задачи&gt; origin/beta
Код возврата 0 сам по себе не доказывает, что содержимое на месте:
коммиты ветки остаются предками после ревёрта. Проверка дерева:

git diff --quiet origin/prod origin/beta

Пустой diff — в beta сверх prod ничего нет, либо показать пользователю
git diff --name-only origin/prod origin/beta и разобрать, что осталось.
</check>

<then>
Снять stage-busy, блок release общего файла
skills/_shared/contour-lock.md, путь 2. Если стоял prod-busy этой же
ветки и слияния в prod не было либо оно тоже откачено, снять и его.
</then>

<tag_void if="стоит stage-ok/&lt;ветка&gt;">
Тег допускает к Production код, который из beta убирается. Оставить
нельзя: сверки шага 0 sma-deploy-prod пройдут, а сброс beta заблокируется
навсегда.

git tag -a reverted/&lt;ветка&gt; &lt;коммит исходного тега&gt; -m "Слияние откачено из beta
branch: &lt;ветка задачи&gt;
revert: &lt;SHA revert-коммита&gt;
причина: &lt;отказ приёмки | отказ от Production | откат Production&gt;
дата: &lt;дата&gt;"
git push origin reverted/&lt;ветка&gt;

git tag -d stage-ok/&lt;ветка&gt;
git push origin :refs/tags/stage-ok/&lt;ветка&gt;

Сначала новый тег, потом снять прежний.
</tag_void>

<return>
Содержимое в beta возвращает unrevert, то есть revert коммита ревёрта.
Повторное слияние той же feat-ветки без unrevert содержимое не возвращает.

<command>
git fetch origin
git switch -c unrevert/beta-&lt;тема&gt; origin/beta
git revert &lt;SHA коммита ревёрта в beta&gt; --no-edit
git push -u origin unrevert/beta-&lt;тема&gt;
gh pr create --base beta --head unrevert/beta-&lt;тема&gt; \
  --title "unrevert: &lt;тема&gt; on beta" \
  --body "Возврат содержимого в beta после ревёрта. Исходная ветка: &lt;ветка задачи&gt;."
</command>

После этого PR, если на исходной feat-ветке есть новые коммиты, их PR
в beta готовится следом. Оба PR сливаются подряд.

<lock>
Замок stage-busy ставится заново до gh pr merge unrevert-PR.
В теле поле branch равно исходной feat-ветке, не unrevert/….
После stage-ok замок не снимается, шаг 12 sma-deploy-stage.

skills/_shared/scripts/lock-acquire.sh --owned stage &lt;ветка задачи&gt; \
  &amp;&amp; gh pr merge &lt;номер unrevert-PR&gt; --merge --delete-branch=false
</lock>
</return>

<forbidden>
<f>Снимать stage-busy до pull в /opt/sma-beta и проверки, что ревёрт на контуре.</f>
<f>Сливать ветку задачи в beta повторно без unrevert.</f>
<f>Сбрасывать beta = prod, пока стоит stage-busy.</f>
<f>Оставлять stage-ok после ревёрта из beta.</f>
</forbidden>

</beta_revert>
