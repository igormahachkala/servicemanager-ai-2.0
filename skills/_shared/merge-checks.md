<!-- Общий файл: sma-deploy-stage и sma-deploy-prod.
     Блоки с contour относятся только к названному контуру.
     Команды приведены готовыми строками: собирать из частей не требуется.
     Наборов файлов -f разное число: два на Stage, три в Production. -->

<contents>
  constraint     обязательность прогона в Production
  prepare_local  зависимости и файл окружения
  local          наборы проверок по областям
  remote         проверка конфигурации compose на сервере
  always_after   возврат в ветку задачи
  on_failure     что делать при отказе, по контурам
</contents>

<merge_checks>

<constraint contour="production">
Прогон обязателен, даже если те же проверки прошли в sma-deploy-stage.
Состояние другое.
</constraint>

<prepare_local>
<when>Перед первым запуском набора backend, frontend или agent-runner.</when>
<check by_area="true">
область backend    → test -d backend/node_modules
область frontend   → test -d web/node_modules
область agent-runner → test -d agent-runner/node_modules
</check>
<on_missing by_area="true">
область backend    → npm ci --prefix backend
область frontend   → npm ci --prefix web
область agent-runner → npm ci --prefix agent-runner
</on_missing>
<constraint>
Ставить зависимости только тех каталогов, чьи области задеты. Лишний npm ci
занимает минуты и ничего не проверяет.
</constraint>
<why>
Зависимости ставятся из package-lock.json, секретов не требуют, это работа
агента. Без них nest build, jest и typecheck упадут не по вине проверяемого
кода, и агент решит, что сломана задача.
</why>
<env_file>
Набор backend требует файла backend/.env с переменной DATABASE_URL:
npm run prisma:generate — это dotenv -e .env -- npx prisma generate.
Агент этот файл не создаёт и значения не подбирает.

Без файла набор backend локально не проходит целиком:
  prisma:generate      — падает на dotenv, файла нет;
  build                — от файла не зависит;
  test                 — пойдёт на несгенерированном клиенте Prisma,
                         результат недостоверен.

Нет файла — остановиться и сообщить разработчику. Единственный полный
выход: разработчик даёт значение DATABASE_URL для локальной проверки.

Частичная замена, только с согласия разработчика: проверить схему
внутри контейнера на контуре.
<on contour="stage">
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml exec -T stage_backend npx prisma validate'
</on>
<on contour="production">
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml exec -T backend npx prisma validate'
</on>
Это закрывает одну команду из четырёх. Сборка и тесты так не проверяются,
и контур на время занят. Не считать эту замену равноценной.
</env_file>
<forbidden>
<f>Создавать backend/.env самостоятельно.</f>
<f>Подставлять DATABASE_URL наугад, в том числе адрес контура.</f>
</forbidden>
</prepare_local>

<local if="задета хотя бы одна область из: backend, frontend, agent-runner, scripts">
<case area="backend">
npm --prefix backend run prisma:generate
npm --prefix backend run build
npm --prefix backend test
</case>
<case area="frontend">
npm --prefix web run build
</case>
<case area="agent-runner">
npm --prefix agent-runner run typecheck
npm --prefix agent-runner run build
</case>
<case area="scripts">
bash -n &lt;каждый изменённый файл из scripts/&gt;
</case>
<how>
Выполняются наборы всех задетых областей. Наборы независимы, порядок
не важен. Все идут на машине агента.
Значения области fullstack не существует: карта шага 1 его не порождает,
задеты backend и frontend — это две области, выполняются оба набора.
</how>
<why_no_validate>
Отдельного prisma validate в наборе нет намеренно.

Схему разбирает и проверяет сам prisma generate: тем же кодом, с теми же
ошибками. Отдельный вызов ничего не добавляет.

Вызвать его правильно к тому же непросто. Через npm --prefix backend exec —
не работает: проверено запуском, npm --prefix X run ставит рабочим каталогом X,
а npm --prefix X exec оставляет текущий, и схема не найдётся. Напрямую
из backend/node_modules/.bin с флагом --schema — команда запускается из корня
репозитория и не видит backend/.env, а схема требует DATABASE_URL: ожидается
отказ P1012.

prisma:generate этих затруднений не имеет: он идёт через npm --prefix backend run,
рабочий каталог — backend, файл backend/.env на месте.
</why_no_validate>
<why_prefix>
--prefix вместо cd: наборы backend и web выполняются подряд, и второй cd
считался бы от каталога, куда увёл первый. Все команды идут от корня
репозитория и не зависят от порядка.
</why_prefix>
</local>

<remote if="область содержит infra">
<setup>
<on contour="stage">
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch origin refs/pull/&lt;номер&gt;/merge'
ssh sma 'cd /opt/sma-beta &amp;&amp; git worktree add /tmp/verify-&lt;номер&gt; FETCH_HEAD'
</on>
<on contour="production">
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch origin refs/pull/&lt;номер&gt;/merge'
ssh sma 'cd /opt/sma-prod &amp;&amp; git worktree add /tmp/verify-&lt;номер&gt; FETCH_HEAD'
</on>
</setup>
<check>
<on contour="stage">
ssh sma 'docker compose -p sma-service -f /tmp/verify-&lt;номер&gt;/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml config -q'
</on>
<on contour="production">
ssh sma 'docker compose -p sma-service -f /tmp/verify-&lt;номер&gt;/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml config -q'
</on>
</check>
<cleanup mandatory="true">
<on contour="stage">
ssh sma 'cd /opt/sma-beta &amp;&amp; git worktree remove --force /tmp/verify-&lt;номер&gt;'
</on>
<on contour="production">
ssh sma 'cd /opt/sma-prod &amp;&amp; git worktree remove --force /tmp/verify-&lt;номер&gt;'
</on>
</cleanup>
<why_mandatory>
Удаление выполняется в любом исходе, включая отказ проверки. Иначе
/tmp/verify-N остаётся вместе с записью в .git/worktrees, и повторный
прогон с тем же номером PR откажет: путь занят. Правило то же,
что у git merge --abort в блоке conflict_files.
Результат проверки разбирается после удаления, а не вместо него.
</why_mandatory>
<note>
Проверять на сервере обязательно: оверрайды лежат в /etc/servicemanager-ai/
и в репозитории отсутствуют. Флаг -q оставляет только ошибки.
Полный вывод config содержит значения переменных — не выводить.
</note>
<cleanup_exception>
Временный worktree удаляет тот же шаг, который его создал. Единственное
исключение из запрета на удаление.
</cleanup_exception>
</remote>

<skip if="ни одна из задетых областей не имеет проверок: none, skills">Автоматических проверок нет.</skip>
<expect>Все команды завершились кодом 0.</expect>
<always_after_checks>
git switch &lt;ветка задачи&gt;
</always_after_checks>
<why>
Возврат в ветку задачи выполняется в обоих исходах, до разбора результата.
Отсоединённое состояние нужно было только для прогона проверок. Оставшись
в нём, агент потеряет любой коммит, который сделает дальше.
Ветка называется явно, не git switch -: разбор конфликта уже переключал
рабочую копию, и "предыдущая позиция" увела бы обратно в отсоединённое
состояние.
</why>
<on_failure contour="stage">
Не сливать. Исправить в ветке задачи, повторить с шага «получить результат
слияния».
</on_failure>
<on_failure contour="production">
Не сливать. Закрыть PR, исправлять в ветке задачи, начинать с sma-deploy-stage
заново.
</on_failure>
<excluded tool="npm run lint" contour="stage">
Во фронтенде 301 ошибка, в бэкенде ~11900. Бэкендовый lint содержит --fix
и изменяет исходники, поэтому не является read-only проверкой.
</excluded>
</merge_checks>
