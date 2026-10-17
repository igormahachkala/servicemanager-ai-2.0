<!-- Откат слияния из beta. Читается из sma-deploy-stage, когда приёмка
     не прошла и пользователь выбрал откат, когда после stage-ok отказались
     от Production, и из rollback Production, когда откатывают и prod. -->

<purpose>
Убрать из beta код задачи сдвигом указателя refs/heads/beta на предка.
После этого коммиты ветки задачи больше не предки beta, и агент может
снять stage-busy. Откат нужен, когда исправление в рамках текущих работ
не делается. Исправление под тем же замком идёт новым PR той же ветки
поверх живого слияния, без отката.
</purpose>

<beta_pointer_rollback>

<when>
Пользователь выбрал откат после отказа приёмки на Stage.
Пользователь отказался от Production после stage-ok.
Слияние в prod не состоялось, а в beta фича есть, и пользователь
выбрал не повторять слияние, а убрать фичу.
Откат Production: после фаз 1 и 2 убрать то же содержимое из beta.
</when>

<lock>
Замок stage-busy на время сдвига остаётся. Снимать его до того, как
каталог /opt/sma-beta стоит на цели сдвига, нельзя.
</lock>

<record>
При переносе или восстановлении stage-ok сохранять полный контракт приёмки:
branch_sha, stage_sha и вычисленный stage_tree. После отката старый stage-ok
нельзя считать действительным для нового Stage-коммита; его удаляют либо
пересоздают только после новой приёмки с новым stage_tree.

После успешного gh pr merge шага 7 sma-deploy-stage записываются оба SHA:

git fetch origin beta
git rev-parse origin/beta
git rev-parse origin/beta^1
git rev-parse -q --verify origin/beta^2

Первая команда даёт M, коммит слияния. Вторая даёт P, первого родителя.
По умолчанию цель сдвига — P. Последняя команда обязана что-то напечатать:
слияние в beta идёт с --merge, у M есть второй родитель. Нет второго
родителя — остановиться и показать SHA. Сдвигать указатель по нему нельзя,
пока не ясно, что это за коммит.
</record>

<target>
Цель сдвига — коммит-предок текущей origin/beta.
По умолчанию цель — P из записи шага 7.
Пользователь может назвать другого предка. Тогда цель — названный SHA,
и он обязан быть предком текущего origin/beta.
</target>

<before_push>
Перед push заново сделать git fetch origin. NOW — свежий
git rev-parse origin/beta. Показать пользователю оба вывода:

git log --oneline &lt;цель&gt;..origin/beta
git diff --stat &lt;цель&gt; origin/beta

Диапазон состоит из одного слияния этой ветки задачи. Второго вопроса нет.
Согласие уже дано выбором отката.

В диапазоне есть что-то ещё. Остановиться и показать оба вывода. Push
выполняется только после того, как пользователь в ответе назвал этот SHA
цели и этот SHA NOW. Молчаливое согласие не считается.

Чужое слияние в диапазоне само по себе push не разрешает. Признак чужого
слияния — merge-коммит, чей второй родитель не является вершиной ветки
задачи и не является её предком.

beta между показом лога и push ушла вперёд. --force-with-lease отказывает.
Повторять ту же команду нельзя. Снова fetch, снова оба вывода, снова ждать
названный NOW.
</before_push>

<command>
git fetch origin
NOW=$(git rev-parse origin/beta)
git merge-base --is-ancestor &lt;цель&gt; "$NOW"
git push --force-with-lease=refs/heads/beta:"$NOW" origin &lt;цель&gt;:refs/heads/beta
git fetch origin beta
git rev-parse origin/beta
</command>

Критерий последней команды — SHA равен цели.
Ожидаемое значение lease — тот NOW, который только что показали.
Записанный на шаге 7 M годится как lease только если свежий origin/beta
всё ещё равен M. Флаг --force без lease не использовать.

Локальную ветку beta переставлять не нужно. Обновляется ref на origin.
Так не упираемся в cannot force update the branch used by worktree.

Это третья прямая запись в beta, см. branch_status в sma-code-delivery.
PR и ветки revert/beta-…, unrevert/beta-… для отката beta не создаются.
Код задачи в beta по-прежнему только через PR. Сдвиг указателя назад —
служебная запись, как сброс, и через PR force-with-lease не делается.

<after>
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; test -z "$(git status --porcelain)"'
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; git fetch --prune origin &amp;&amp; git rev-parse origin/beta'
ssh sma-spare 'cd /opt/sma-beta &amp;&amp; git checkout beta &amp;&amp; git reset --hard origin/beta'
</after>

Критерий rev-parse на сервере — SHA равен цели. Грязный git status
останавливает шаг. reset --hard по грязному каталогу не запускать.
git pull --ff-only после сдвига не выполняется: движение не является
fast-forward.

<redeploy if="область требовала подъёма контейнеров">
Повторить пересборку и up -d шага 8 sma-deploy-stage, с --no-deps,
stage_postgres не трогать. Для none, scripts, skills, nginx контейнеры
не поднимать. Fetch и reset в каталоге обязательны.
</redeploy>

<check>
git fetch origin
git rev-parse origin/beta
git merge-base --is-ancestor origin/&lt;ветка задачи&gt; origin/beta
git diff --quiet &lt;цель&gt; origin/beta

rev-parse равен цели. merge-base --is-ancestor возвращает не ноль:
ветка задачи больше не предок beta. Это признак, что повторный PR её
привезёт. Пустой git diff против цели подтверждает, что уехало ровно
показанное дерево.

Пустой git diff origin/prod origin/beta после этой операции не обязателен.
Цель может не совпадать с origin/prod.
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
beta_was: &lt;NOW&gt;
beta_now: &lt;цель&gt;
причина: &lt;отказ приёмки | отказ от Production | откат Production&gt;
дата: &lt;дата&gt;"
git push origin reverted/&lt;ветка&gt;

git tag -d stage-ok/&lt;ветка&gt;
git push origin :refs/tags/stage-ok/&lt;ветка&gt;

Сначала новый тег, потом снять прежний. В теле нет строки revert:.
Старые теги reverted/… со строкой revert: не переписывать.
</tag_void>

<return>
Содержимое в beta возвращает обычный круг sma-deploy-stage с PR исходной
ветки задачи в beta. Замок занимает шаг 7 этого круга. Отдельной постановки
замка под служебный PR нет.

Повторное слияние без новых коммитов тоже возвращает содержимое.
stage-ok по-прежнему ставится на вершину исходной feat-ветки.
Теги stage-ok/revert/… и stage-ok/unrevert/… не создавать.
</return>

<forbidden>
<f>git revert -m 1 по ветке beta.</f>
<f>Создавать ветки revert/beta-… или unrevert/beta-….</f>
<f>Снимать stage-busy до reset --hard в /opt/sma-beta и проверки SHA.</f>
<f>Откатывать указатель beta ради исправления, которое идёт под тем же
stage-busy.</f>
<f>Подтягивать каталог после сдвига через git pull --ff-only.</f>
<f>Сбрасывать beta = prod вместо отката указателя, пока стоит stage-busy.</f>
<f>Оставлять stage-ok после отката указателя beta.</f>
<f>Применять тот же сдвиг указателя к ветке prod.</f>
</forbidden>

</beta_pointer_rollback>
