<skill name="deploy-prod">

<purpose>
Проверки, PR в prod, развёртывание в Production. Применяется только после
skills/deploy-stage.md, подтверждением служит тег stage-ok.
</purpose>

<contour name="production">
<branch>prod</branch>
<workdir>/opt/sma-prod</workdir>
<project>sma-service</project>
<compose_file>/opt/sma-prod/docker-compose.yml</compose_file>
<compose_file>/etc/servicemanager-ai/docker-compose.production.override.yml</compose_file>
<compose_file>/etc/servicemanager-ai/docker-compose.production.stable.override.yml</compose_file>
<service area="backend">backend</service>
<service area="frontend">web</service>
<never_touch>postgres</never_touch>
<url>https://servicemanagerai.ru</url>
<url_health>https://api.servicemanagerai.ru/health</url_health>
</contour>

<precedence>
При расхождении с docs/04_DEVELOPMENT_WORKFLOW.md и docs/12_RELEASE_PROCESS.md
верны skill: документы описывают порядок до введения ствола. Полная
формулировка — блок precedence в skills/git-workflow.md.
</precedence>

<execution_context>
<rule>
Команда выполняется на машине агента, если явно не начинается с ssh sma.
Docker на машине агента отсутствует либо содержит посторонние контейнеры,
поэтому любая команда docker и любая работа с каталогами сервера идут
только через ssh sma.
</rule>
<on_agent_machine>
git по своей рабочей копии; gh; npm и сборка при локальных проверках;
curl по публичным адресам контура — он намеренно идёт снаружи и проверяет
доступность через nginx, а не изнутри сети docker.
</on_agent_machine>
<on_server>
Всё остальное: docker inspect, docker ps, docker logs, docker compose,
git в каталогах развёртывания.
</on_server>
<check>Строка содержит docker без префикса ssh sma — это дефект, исправить.</check>
</execution_context>

<prerequisites fail="остановиться, сообщить пользователю, не начинать">
<p name="доступ к серверу">
<command>ssh -o BatchMode=yes sma 'whoami'</command>
<expect>deploy</expect>
</p>
<p name="gh авторизован и имеет право на PR">
<command>gh api repos/igormahachkala/servicemanager-ai-2.0/pulls --jq 'length'</command>
<expect>Число.</expect>
<rationale>
Проверяется работоспособность, а не устройство токена. Вернулось число —
вход есть и право на PR есть, независимо от того, каким токеном агент
авторизован. Запрос читающий, ничего не создаёт.

Требования к токену — skills/agent-setup.md, часть C. Здесь они не
повторяются: при изменении правил выдачи правка нужна в одном месте.
</rationale>
<on_failure>Настройка и разбор отказов — skills/agent-setup.md, часть C, шаг 3.</on_failure>
</p>
<p name="правила по секретам прочитаны">
<expect>skills/secrets.md прочитан до первой команды, затрагивающей сервер.</expect>
</p>
<on_missing>Настройка машины — skills/agent-setup.md.</on_missing>
</prerequisites>

<step id="0" name="сверка допуска">
<basis>
Тег stage-ok стоит на вершине ветки задачи — обозначим её B. На Stage развёрнут
коммит слияния этой ветки с beta — обозначим его M. B и M различны всегда,
равенства между ними требовать нельзя.
</basis>
<command>
git fetch --prune --prune-tags origin

# 1 — тег существует
#     --prune-tags обязателен: снятые в origin теги иначе остаются локально
git rev-parse stage-ok/&lt;ветка&gt;^{commit}

# 2 — ветка не менялась после приёмки
test "$(git rev-parse stage-ok/&lt;ветка&gt;^{commit})" = "$(git rev-parse origin/&lt;ветка&gt;)"

# 3 — принятый код есть на Stage сейчас
STAGE_HEAD=$(ssh sma 'cd /opt/sma-beta &amp;&amp; git rev-parse HEAD')
git fetch origin beta
git merge-base --is-ancestor "$(git rev-parse stage-ok/&lt;ветка&gt;^{commit})" "$STAGE_HEAD"
</command>
<expect>Сверки 1 и 3 завершились кодом 0. Сверка 2 дала совпадение.</expect>
<on_failure>
Отказ. Причины и действия:
- тега нет → приёмка на Stage не проводилась, вернуться к deploy-stage;
- тег не совпал с веткой → после приёмки появились коммиты, повторить приёмку;
- сверка 3 не прошла → принятого кода на Stage нет: beta сбросили либо развернули
  без вашей задачи. Повторить приёмку с deploy-stage.
</on_failure>
<known_limit>
Сверка 3 не отличает случай, когда после вашей приёмки на Stage развернули
чужую задачу. Ваш код на контуре остался, допуск сохраняется. Обстоятельства
приёмки восстанавливаются по полю stage_sha в теле тега.
Это сознательный выбор: Stage один на 4-6 агентов, строгое равенство HEAD
снимало бы допуск при каждом чужом развёртывании.
</known_limit>
</step>

<step id="1" name="определить область изменения">
<command>git diff --name-only origin/prod...&lt;ветка&gt;</command>
<map path="backend/"                      area="backend"/>
<map path="web/"                          area="frontend"/>
<map path="docker-compose*.yml"           area="infra"/>
<map path="test/docker-compose.test.yml"  area="infra"/>
<map path="docs/nginx-*.conf"             area="nginx"/>
<map path="agent-runner/"                 area="agent-runner"/>
<map path="scripts/"                      area="scripts"/>
<map path="skills/"                       area="skills"/>
<map path="docs/"                         area="none"/>
<map path="docs_pdf/"                     area="none"/>
<map path=".cursor/"                      area="none"/>
<map path="*.md"                          area="none"/>
<map path=".gitignore | .cursorignore"    area="none"/>
<map path="child | .npm-cache/"           area="none"/>
<map_note>
Старшинство: побеждает более точный путь. Правило docs/nginx-*.conf сильнее
правила docs/. Правило *.md — запасное: оно срабатывает только для файлов,
не попавших ни в один каталог из перечисленных выше. Файл skills/git-workflow.md
относится к области skills, а не none; backend/README.md — к области backend.
Каталог _claude/ в карте отсутствует намеренно — он в .gitignore
и в выводе git diff не появится.
Файлы child, .npm-cache/, docs_pdf/ действий не требуют, но перечислены:
иначе сработает правило о неизвестном пути и поток остановится.
В test/ сейчас лежит только compose-файл, поэтому правило указывает на него,
а не на каталог: настоящие тесты, когда появятся, инфраструктурой не будут.
</map_note>
<flag path="backend/prisma/schema.prisma | backend/prisma/migrations/" set="has_migration"/>
<flag path="backend/Dockerfile | web/Dockerfile | */docker-entrypoint.sh" set="needs_rebuild"/>
<resolution>
Совпало несколько — области объединяются. none учитывается только если других
совпадений нет. Неизвестный путь — остановиться и спросить пользователя.
</resolution>

<area name="agent-runner">
<what>
Отдельный исполнитель задач на Node, каталог agent-runner/. В compose
отсутствует, нашим потоком не разворачивается. Работы по нему заморожены
на неопределённый срок.
</what>
<checks>
npm --prefix agent-runner run typecheck
npm --prefix agent-runner run build
</checks>
<why_checks>
Заморозка не повод пропускать сломанную сборку: код в репозитории должен
оставаться собираемым.
</why_checks>
<deploy>
Не определено. Где эта программа запущена и запущена ли вообще —
не установлено. Остановиться до слияния в prod и спросить пользователя,
требуется ли доставка и каким способом.
Слияние в prod при этом не запрещено: код в ветке проверен. Запрещено
считать задачу выполненной, не выяснив, доходит ли изменение до места,
где программа работает.
</deploy>
<open>Порядок доставки agent-runner — открытый вопрос, бэклог.</open>
</area>

<area name="scripts">
<what>Утилиты для работы: выгрузка контекста, сборка PDF документации.</what>
<checks>bash -n &lt;каждый изменённый файл&gt;</checks>
<why_checks>Разбор синтаксиса без выполнения. Запускать сами скрипты не требуется.</why_checks>
<deploy>Не требуется: на сервере не используются.</deploy>
</area>

<area name="skills">
<what>Правила работы агентов, каталог skills/.</what>
<checks>Автоматических нет.</checks>
<deploy>Не требуется.</deploy>
<pr_body>
В теле PR перечислить, что именно в правилах изменено и почему.
Изменение skills меняет порядок работы всех агентов, включая того, кто
эту правку везёт. Без перечня следующий агент не поймёт, что поменялось,
и продолжит по прежним правилам.
</pr_body>
</area>

<area name="nginx">
<what>
docs/nginx-*.conf — копии конфигурации nginx. Работающая конфигурация лежит
в системном каталоге сервера, nginx работает вне compose. Развёртывание
контейнеров её не затрагивает, пересборка не применяет.
</what>
<stop>
Изменение конфигурации nginx автоматически не применяется. Развёртывание
по остальным задетым областям идёт обычным порядком. Для nginx агент
определяет расположение, сравнивает с репозиторием и выдаёт пользователю
готовые команды применения.
</stop>
<when_applied>
Порядок относительно развёртывания кода: сначала код, потом конфигурация
nginx, приёмка объявляется после обоих.
<why>
Задача часто меняет и то и другое: новый маршрут API и правило проксирования
для него. Выкатить сначала конфигурацию — nginx станет проксировать
на обработчик, которого ещё нет. Выкатить только код — маршрут не будет
доступен снаружи.
</why>
<sequence>
1. Развёртывание по остальным задетым областям, шаг 8.
2. Сверка после развёртывания, шаг 9.
3. Команды nginx из блока propose — выполняет пользователь.
4. Повторить проверку доступности контура: она должна идти уже
   с новой конфигурацией.
5. Приёмка критерия.
</sequence>
<constraint>
Приёмку не объявлять, пока команды nginx не выполнены: проверяемое
поведение до этого недостижимо.
</constraint>
</when_applied>
<locate>
Определить, где лежит работающая конфигурация, до составления команд:
ssh sma 'ls -l /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2&gt;/dev/null'
ssh sma 'ls -l /etc/nginx/sites-available/ 2&gt;/dev/null'
<on_failure>
Каталоги не читаются пользователем deploy — запросить у пользователя путь
к рабочему файлу и продолжить с ним.
</on_failure>
</locate>

<diff>
Показать, чем файл в репозитории отличается от работающего:
ssh sma 'cat &lt;путь к рабочему файлу&gt;' &gt; /tmp/nginx-live.conf
diff /tmp/nginx-live.conf docs/&lt;имя файла&gt;.conf
<why>
Файл в репозитории — копия, её соответствие рабочей конфигурации
не установлено. Без сравнения непонятно, что именно применяется:
только ваше изменение или ещё расхождение, накопленное раньше.
</why>
</diff>

<propose>
Выдать пользователю готовые команды. Все требуют root, выполняет пользователь.

# 1. сохранить прежнюю конфигурацию
sudo cp &lt;путь к рабочему файлу&gt; &lt;путь&gt;.bak-$(date +%Y%m%d-%H%M%S)

# 2. положить новую
sudo cp /opt/sma-prod/docs/&lt;имя файла&gt;.conf &lt;путь к рабочему файлу&gt;

# 3. проверить синтаксис до применения
sudo nginx -t

# 4. применить, только если шаг 3 прошёл
sudo systemctl reload nginx

# 5. убедиться, что контур отвечает
curl -o /dev/null -w "%{http_code}" &lt;url контура&gt;

<critical>
Шаг 3 обязателен. reload с ошибочной конфигурацией оставит nginx на прежней,
но при следующем перезапуске он не поднимется. Пропуск проверки превращает
опечатку в отказ, отложенный во времени.
</critical>
<rollback>
sudo cp &lt;путь&gt;.bak-&lt;отметка&gt; &lt;путь к рабочему файлу&gt; &amp;&amp; sudo nginx -t &amp;&amp; sudo systemctl reload nginx
</rollback>
<note>
reload не рвёт текущие соединения, в отличие от restart. Применять reload.
</note>
</propose>

<report>
Сообщить пользователю: какой файл изменён, где лежит работающий, что показало
сравнение, и что до выполнения команд изменение не действует.
</report>


<ask_user>Выполнение команд под root. Составляет их агент, выполняет пользователь.</ask_user>
<verification_limits>
<can>
Прочитать конкретный файл из sites-enabled или conf.d и сравнить
с репозиторием — блок diff. Каталоги nginx обычно доступны на чтение всем,
cat под deploy проходит.
</can>
<cannot>
Получить полную действующую конфигурацию: nginx -T разворачивает все
включения и требует root. Агент сверяет один файл, а не всё, что nginx
применяет фактически.
</cannot>
<on_diff_unexpected>
Сравнение показало отличия сверх вашего изменения — на сервере есть правки,
не отражённые в репозитории. Остановиться, показать diff пользователю.
Перезапись затрёт их без следа.
</on_diff_unexpected>
</verification_limits>
<forbidden>
<f>Править конфигурацию nginx на сервере от имени deploy: файлы принадлежат root.</f>
<f>Считать изменение применённым после развёртывания контейнеров.</f>
</forbidden>
</area>
</step>

<step id="2" name="создать PR в prod">
<precheck>
gh pr list --head &lt;ветка&gt; --base prod --state open --json number
</precheck>
<if name="PR уже открыт">
Взять его номер и перейти к шагу 3. Второй PR из той же ветки в ту же
целевую не создаётся.
</if>
<command>
gh pr create --base prod --head &lt;ветка&gt; --title "&lt;заголовок&gt;" --body "&lt;критерий приёмки, результат приёмки на Stage, тег, перечень проверок&gt;"
</command>
<expect>PR создан, номер получен.</expect>
<on_failure>
Сообщение о существующем PR — выполнить precheck и взять номер.
Отказ 403 — у токена нет права Pull requests: Read and write.
</on_failure>
</step>

<step id="3" name="получить результат слияния">
<precondition name="рабочая копия чистая">
test -z "$(git status --porcelain)"
</precondition>
<on_precondition_failure>
Есть незакоммиченные изменения. git switch --detach откажется их затирать.
Закоммитить в ветку задачи либо показать пользователю и выяснить происхождение.
</on_precondition_failure>
<command>
git fetch origin refs/pull/&lt;номер&gt;/merge
git switch --detach FETCH_HEAD
</command>
<state>
Рабочая копия переведена в отсоединённое состояние: HEAD указывает на коммит,
а не на ветку. Состояние временное, оно существует только для шага проверок.
</state>
<constraint>
В этом состоянии не коммитить и не править файлы. Коммит, сделанный здесь,
не принадлежит ни одной ветке и пропадёт при следующем переключении.
Все правки — только после возврата в ветку задачи.
</constraint>
<rationale>
Слияние с prod — другое состояние, чем слияние с beta: prod мог уйти вперёд.
Проверки обязаны идти именно на этом состоянии.
</rationale>
<mergeability>
<why>
GitHub считает пробное слияние фоновой задачей после создания PR. Между
gh pr create и появлением ссылки проходит от долей секунды до нескольких
секунд. Отсутствие ссылки в этом окне означает "ещё не посчитано",
а не конфликт. Состояние спрашивается у GitHub, а не выводится
из неудачи git fetch.
</why>
<command>gh pr view &lt;номер&gt; --json mergeable,mergeStateStatus</command>
<case value="UNKNOWN">
Пробное слияние ещё считается. Подождать 5 секунд и повторить запрос,
до пяти попыток. Не считать конфликтом.
Все пять попыток дали UNKNOWN — остановиться, сообщить пользователю:
GitHub не отдаёт состояние PR.
</case>
<case value="MERGEABLE">Ссылка готова, тянуть её и продолжать.</case>
<case value="CONFLICTING">Конфликт настоящий, перейти к блоку conflict_files.</case>
<note>
Досланный в ветку коммит запускает пересчёт: ссылка на время указывает
на прежнее состояние либо пропадает. Правило то же — переспросить состояние.
</note>
</mergeability>
<conflict_files>
<why>
Список конфликтующих файлов взять неоткуда: ссылки нет, локально ничего
не сливалось. Конфликт воспроизводится в своей копии.
</why>
<command>
git switch &lt;ветка&gt;
git merge --no-commit --no-ff origin/prod
git diff --name-only --diff-filter=U
git merge --abort
</command>
<expect>Третья команда перечисляет файлы с конфликтом.</expect>
<constraint>
git merge --abort обязателен и выполняется в любом исходе: он возвращает
копию в состояние до слияния. На сервере и в PR при этом не меняется ничего.
</constraint>
<action>Показать список пользователю. Не сливать, не разворачивать.</action>
</conflict_files>
</step>

<step id="4" name="проверки на результате слияния">
<constraint>Прогон обязателен, даже если те же проверки прошли в deploy-stage. Состояние другое.</constraint>

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
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml exec -T backend npx prisma validate'
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
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch origin refs/pull/&lt;номер&gt;/merge'
ssh sma 'cd /opt/sma-prod &amp;&amp; git worktree add /tmp/verify-&lt;номер&gt; FETCH_HEAD'
</setup>
<check>
ssh sma 'docker compose -p sma-service -f /tmp/verify-&lt;номер&gt;/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml config -q'
</check>
<cleanup mandatory="true">
ssh sma 'cd /opt/sma-prod &amp;&amp; git worktree remove --force /tmp/verify-&lt;номер&gt;'
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
Отсоединённое состояние нужно было только для прогона проверок.
Ветка называется явно, не git switch -: разбор конфликта уже переключал
рабочую копию, и "предыдущая позиция" увела бы обратно в отсоединённое
состояние.
</why>
<on_failure>Не сливать. Закрыть PR, исправлять в ветке задачи, начинать с deploy-stage заново.</on_failure>
</step>

<step id="5" name="подготовка к развёртыванию">
<applies_if>
Проверка каталога и набора compose-файлов выполняется, только если задета
область, требующая подъёма контейнеров: backend, frontend, infra.
Для областей none, scripts, skills, nginx пропускается — то же условие,
что в блоке skip_deploy шага 8. Запись точки отката для них тоже
не нужна: откатывать нечего, работающий код не меняется.
</applies_if>
<why_condition>
Проверка защищает от последствия команды up -d, которая для этих областей
не выполняется.

Что она предотвращает: compose опознаёт контейнеры по имени проекта
sma-service, а не по каталогу. Команда up -d из одного каталога пересоздаст
контейнеры, поднятые из другого, — по описанию из наших файлов, молча.
Если контур на самом деле живёт не там, где мы считаем, работающий код
будет подменён сборкой из чужого состояния.

Не запускаем up -d — пересоздавать нечего, подменять нечего.
</why_condition>
<order>
Сначала собрать данные, потом спрашивать. Вопрос требует показать точку
отката, а она записывается ниже.
</order>
<command>
ssh sma 'docker inspect sma_web --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}"'
ssh sma 'docker inspect sma_web --format "{{index .Config.Labels \"com.docker.compose.project.config_files\"}}"'
ssh sma 'cd /opt/sma-prod &amp;&amp; git rev-parse HEAD'
</command>
<expect>
workdir равен /opt/sma-prod.
config_files совпадает со списком compose_file в &lt;contour&gt;, порядок тот же.
</expect>
<on_failure>Контур поднят из другого каталога или другим набором файлов. Не разворачивать.</on_failure>
<record>Текущий HEAD Production — точка отката. Записать до изменений.</record>
<record before="развёртыванием">
ssh sma 'docker inspect sma_postgres sma_backend sma_web --format "{{.Name}} {{.State.StartedAt}} {{.State.Status}}"'
MARK=$(date -u +%FT%TZ)   # отметка времени до развёртывания, от неё считаются ошибки после
ssh sma 'docker logs sma_backend --since 10m 2&gt;&amp;1 | grep -icE "error|exception"'
</record>
<why_startedat>
Записывается StartedAt, а не RunningFor. RunningFor — словесная относительная
длительность вида "About an hour", она меняется сама по ходу времени.
Сверка после развёртывания дала бы ложную аварию при пересечении границы
округления. StartedAt — точная отметка старта, меняется только при
перезапуске или пересоздании контейнера.
</why_startedat>
<ask_user always="true">
Развёртывание в Production. Показать: SHA развёртываемого коммита, состав
изменения, определённые области, наличие миграций, записанную точку отката.
Дождаться подтверждения.
</ask_user>
</step>

<step id="6" name="бэкап" if="has_migration">
<constraint>Миграция без свежего дампа базы не применяется.</constraint>
<why>
Откат кода миграцию не отменяет. Если она удалила или изменила данные,
вернуть их можно только из дампа. Подтверждение словами доказательством
не является: проверяется наличие файла и его размер.
</why>

<precondition name="каталог существует">
ssh sma 'test -d /var/backups/sma -a -w /var/backups/sma'
</precondition>
<on_precondition_failure>Каталог не заведён — skills/agent-setup.md, часть A, initial_setup.</on_precondition_failure>

<command>
ssh sma bash -c 'set -o pipefail; F=/var/backups/sma/pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz; docker exec sma_postgres sh -c "pg_dump -U \$POSTGRES_USER \$POSTGRES_DB" | gzip &gt; "$F"; echo "$F"'
</command>
<why_bash>
Команда идёт через bash -c явно. set -o pipefail — не POSIX: в dash это
синтаксическая ошибка, и защита от упавшего pg_dump исчезла бы молча.
Оболочка deploy сейчас /bin/bash, проверено 2026-08-28, но полагаться
на это не следует.
</why_bash>
<why_pipefail>
Без set -o pipefail код возврата конвейера — это код gzip, то есть 0 даже
при упавшем pg_dump. Проверено запуском: false | gzip &gt; out.gz даёт код 0,
файл в 20 байт, и gzip -t такой файл принимает. То есть без pipefail skill
объявит бэкап снятым, когда его нет.
</why_pipefail>
<why_env_from_container>
Имена пользователя и базы берутся из окружения самого контейнера,
а не подставляются из документа: оверрайд Production может задавать
другие. Значения при этом нигде не печатаются.
</why_env_from_container>

<verify>
ssh sma 'ls -l &lt;путь из вывода&gt;'
ssh sma 'gzip -t &lt;путь из вывода&gt;'
</verify>
<expect>
Команда снятия завершилась кодом 0 — при pipefail это код pg_dump.
gzip -t завершился кодом 0.
Размер файла больше 10 килобайт.
</expect>
<why_size>
Размер — грубая подстраховка, основная проверка — код возврата. Порог
низкий намеренно: он ловит пустой и обрезанный файл, а не расхождение
с ожидаемым объёмом базы.
Если в /var/backups/sma есть предыдущий дамп, сравнить с ним: падение
в разы означает, что снялась часть.
</why_size>
<on_failure>
Дамп не снялся либо повреждён. Миграцию не применять, развёртывание
не продолжать. Сообщить пользователю.
</on_failure>

<restore_note>
Порядок восстановления, выполняется человеком и только при необходимости:
gunzip -c &lt;файл&gt; | docker exec -i sma_postgres sh -c 'psql -U $POSTGRES_USER $POSTGRES_DB'
Восстановление поверх работающей базы перезаписывает данные. Не выполнять
без отдельного решения.
</restore_note>

<secrets>
Дамп содержит пароли пользователей, ключи push-подписок и персональные данные.
Не печатать содержимое, не копировать за пределы /var/backups/sma,
не пересылать. В выводе допустимы только путь и размер.
</secrets>

<ask_user>
Показать путь и размер дампа. Подтвердить переход к развёртыванию с миграцией.
</ask_user>

<open>
Сколько дампов хранить и копировать ли вне сервера — не решено, DB-02 бэклога.
Дамп на том же диске не защищает от отказа диска.
</open>
</step>

<step id="7" name="слить PR">
<command>gh pr merge &lt;номер&gt; --merge --delete-branch=false</command>
<on_failure>Отказ с указанием, что ветка устарела — prod ушёл вперёд. Повторить с шага 3.</on_failure>
</step>

<step id="8" name="развернуть">
<skip_deploy if="ни одна из задетых областей не требует развёртывания контейнеров: none, scripts, skills, nginx" first="true">
<why>
Контекст сборки образов — каталоги ./backend и ./web. Файлы областей
none, scripts и skills лежат вне них и в образы не попадают.
Область nginx работает вне compose, контейнеров не касается.
Пересобирать и перезапускать нечего ни в одном из четырёх случаев.
</why>
<not_here>
Область agent-runner сюда не входит: порядок её доставки не определён.
При ней остановиться и спросить пользователя, см. блок area agent-runner.
</not_here>
<nginx_note>
Область nginx входит в перечень: контейнеры она не затрагивает, применяется
командами пользователя. Но git pull в каталоге всё равно выполняется —
файл конфигурации берётся оттуда, блок propose ссылается на него по пути
внутри каталога развёртывания.
</nginx_note>
<skip>Пересборка и подъём контейнеров. Запись состояния до развёртывания.</skip>
<still_required>
ssh sma 'cd /opt/sma-prod &amp;&amp; test -z "$(git status --porcelain)"'
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch origin'
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout prod'
ssh sma 'cd /opt/sma-prod &amp;&amp; git pull --ff-only'
</still_required>
<why_still>
Ветка уходит вперёд и при изменении одной документации. Без git pull
каталог останется на прежнем коммите и разойдётся с вершиной ветки —
состояние, которое сверка шага 9 называет нарушением инварианта.
Каталог обязан соответствовать ветке всегда, работающий код при этом
не трогается: изменений в нём нет.
</why_still>
<then>
Перейти к шагу 9 — сверке. Она проверяет результат git pull:
каталог на своей ветке и не отстаёт от её вершины. Пропускать её
нельзя, pull выполнялся.
Проверки, относящиеся к контейнерам, при этом неприменимы: аптайм
и логи не менялись, сравнивать не с чем.
</then>
<then_criterion>
Дальше шаг 10, критерий приёмки. Он проверяется там, где живёт
изменение: для документации и правил — в репозитории, а не
в работающей системе. Критерий не обязан быть runtime-ным.
</then_criterion>
</skip_deploy>

<precondition name="рабочая копия чистая">
ssh sma 'cd /opt/sma-prod &amp;&amp; test -z "$(git status --porcelain)"'
</precondition>
<on_failure>
Код возврата не 0 — в каталоге развёртывания есть незакоммиченные изменения.
Не разворачивать. Показать пользователю, что именно там лежит:
ssh sma 'cd /opt/sma-prod &amp;&amp; git status --short'
Происхождение выяснить до продолжения: содержимое каталога должно
совпадать с веткой, посторонние правки означают ручное вмешательство
в обход потока.
</on_failure>
<command>
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch origin'
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout prod'
ssh sma 'cd /opt/sma-prod &amp;&amp; git pull --ff-only'
</command>
<why_separate>
Проверку нельзя ставить звеном цепочки через &amp;&amp;: git status возвращает 0
и при грязной копии, цепочка пойдёт дальше. Останавливает только команда,
дающая ненулевой код, — test -z по выводу git status --porcelain.
</why_separate>
<why_ff_only>
--ff-only не даёт создать коммит слияния в каталоге развёртывания.
Отказ означает, что локальная ветка на сервере разошлась с origin,
то есть в каталоге кто-то коммитил. Разбираться, не сливать.
</why_ff_only>

<rebuild if="область содержит backend или frontend, либо флаг needs_rebuild">
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml build &lt;сервисы по области&gt;'
</rebuild>
<rebuild if="область только infra">не требуется, образы не затронуты</rebuild>

<service_map_scope>
Карта &lt;service area=...&gt; применяется только к пересборке. Подъём поднимает
оба сервиса всегда, независимо от области.
Причина: compose сравнивает конфигурацию и образ с текущими и не трогает
контейнер, если ничего не изменилось, — лишний сервис в списке безвреден.
Поднимать оба безопаснее: изменение общего файла окружения затрагивает
обе стороны, и обе должны перезапуститься.
Не «наводить порядок», подставляя сюда сервисы по области.
</service_map_scope>
<always>
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml up -d --no-deps backend web'
</always>
<note>Пересоздавать контейнер или нет — решает compose. Агент решает только вопрос пересборки.</note>
<constraint>--no-deps обязателен: postgres не пересоздавать.</constraint>
<fact>
Миграции в Production применяются автоматически при старте контейнера:
command: sh -lc "npx prisma migrate deploy &amp;&amp; npm run start:prod"
Отдельный шаг не нужен, статус проверяется после запуска.
</fact>
</step>

<step id="9" name="сверка после развёртывания">
<must name="контур на своей ветке">
ssh sma 'cd /opt/sma-prod &amp;&amp; git rev-parse --abbrev-ref HEAD'
Равно prod. Значение HEAD означает отсоединённое состояние — отказ.
</must>
<must name="развёрнутый коммит содержит код задачи">
PROD_HEAD=$(ssh sma 'cd /opt/sma-prod &amp;&amp; git rev-parse HEAD')
git fetch origin
git merge-base --is-ancestor "$(git rev-parse origin/&lt;ветка&gt;)" "$PROD_HEAD"
Код возврата 0.
</must>
<must name="каталог не отстаёт от ветки">
test "&lt;значение PROD_HEAD из предыдущей проверки&gt;" = "$(git rev-parse origin/prod)"
<note>
Подставить значение, а не имя переменной: проверки выполняются отдельными
вызовами, и переменная из предыдущей до этой не доживёт.
</note>
Отличается — пока шло развёртывание, в prod влили ещё одну задачу.
Инвариант «каталог, ветка и работающий код совпадают» нарушен. Остановиться,
показать пользователю git log "$PROD_HEAD"..origin/prod --oneline.
</must>
<why_two_checks>
На Stage достаточно вхождения: контур расходный, чужие развёртывания поверх
допустимы. В Production проверяются оба условия: код задачи внутри и каталог
равен вершине ветки. Расхождение здесь означает, что работает не то, что
числится в prod, — состояние, из-за которого вводился ствол.
</why_two_checks>
<must name="база не тронута">
ssh sma 'docker inspect sma_postgres --format "{{.State.StartedAt}}"'
Строка совпадает с записанной до развёртывания посимвольно.
Отличается — контейнер базы пересоздан или перезапущен. Авария,
немедленно сообщить пользователю, дальнейшие шаги не выполнять.
</must>
<must name="контур отвечает">
curl -o /dev/null -w "%{http_code}" https://servicemanagerai.ru/ → 200
curl -o /dev/null -w "%{http_code}" https://api.servicemanagerai.ru/health → 200
</must>
<must name="нет новых ошибок в логах">
<case name="контейнер не пересоздавался">
StartedAt тот же, что записан до развёртывания.
ssh sma 'docker logs sma_backend --since &lt;MARK&gt; 2&gt;&amp;1 | grep -icE "error|exception"'
Считаются только строки после отметки MARK, снятой до развёртывания.
Ожидание — ноль. Любое ненулевое значение разбирается.
</case>
<why_mark>
Не --since 10m. Окно скользящее: до развёртывания оно отсчитывается от одного
момента, после — от другого, и разница равна длительности развёртывания.
При развёртывании дольше десяти минут запись «до» вовсе выпадает из окна
«после». Абсолютная отметка снимает и это, и необходимость сравнивать числа:
всё, что посчитано, произошло после начала работ.
</why_mark>
<case name="контейнер пересоздан">
StartedAt новее. Лог начался с нуля, сравнивать не с чем: запись «до»
относится к контейнеру, которого больше нет.
ssh sma 'docker logs sma_backend 2&gt;&amp;1 | grep -icE "error|exception"'
Считается весь лог нового контейнера. Ожидание — ноль либо известные
штатные строки. Любая ошибка при старте разбирается сразу.
</case>
<why>
Прежние редакции сравнивали числа из разных окон: 10 минут до и 3 минуты
после. Несопоставимо, а при пересборке сравнение вообще теряет смысл.
</why>
</must>
<must name="миграции применены" if="has_migration">
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml exec -T backend npx prisma migrate status'
→ Database schema is up to date
</must>
<conditional name="перезапуск контейнеров">
ssh sma 'docker inspect sma_backend sma_web --format "{{.Name}} {{.State.StartedAt}}"'
Пересобирали образ — StartedAt новее записанного, контейнеры пересозданы.
Пересборки не было и конфигурация не менялась — StartedAt прежний,
вывод compose содержит Running.
Оба исхода допустимы. Недопустим третий: пересборка была, а StartedAt прежний —
новый образ не подхватился.
</conditional>
<not_proof>
Имя файла бандла. Совпадение не доказывает успех, изменение не доказывает поломку.
Смена имени при неизменных исходниках штатна: npm install без фиксации версий.
</not_proof>
<on_failure>Откат по блоку rollback.</on_failure>
</step>

<step id="10" name="проверка критерия приёмки">
<precondition if="задета область nginx">
Команды применения конфигурации nginx выполнены пользователем, блок propose
области nginx. До этого проверяемое поведение недостижимо.
Не объявлять приёмку, ждать подтверждения пользователя.
</precondition>
<action>Проверить в Production критерий, зафиксированный в git-workflow шаг 1.</action>
<on_failure>Откат по блоку rollback.</on_failure>
</step>

<step id="11" name="восстановить инвариант beta ⊇ prod">
<command>
git fetch origin
git merge-base --is-ancestor origin/prod origin/beta
</command>
<on_failure>
beta не содержит prod. Восстановить:
test -z "$(git status --porcelain)"
git switch -C beta origin/beta
git merge origin/prod
git push origin beta
git switch &lt;ветка задачи&gt;
</on_failure>
<why_switch_C>
Флаг -C ставит локальную beta ровно на origin/beta: локальная может
отсутствовать на свежем клоне либо отставать, и тогда слияние пойдёт
от устаревшего основания.
</why_switch_C>
<on_push_rejected>
Отказ non-fast-forward — инвариант уже восстановил другой агент.
Перечитать состояние и повторить проверку merge-base. Прошла — идти дальше.
</on_push_rejected>
<allowed_exception>
Это одна из двух служебных операций, разрешённых напрямую в beta,
см. branch_status в skills/git-workflow.md. Запрет на прямой push
относится к коду задач, здесь в beta добавляется только код,
уже работающий в Production.
</allowed_exception>
<rationale>
Без этого следующая проверка на Stage пойдёт на базе без только что
развёрнутой задачи.
</rationale>
<alternative>
Если блок beta_reset в skills/deploy-stage.md разрешён предусловием, вместо
слияния делается сброс beta = prod. Он даёт тот же инвариант и заодно убирает
из beta отброшенные задачи. Слияние применяется, когда сброс заблокирован
чужим неиспользованным тегом stage-ok.
</alternative>
</step>

<step id="12" name="закрытие задачи">
<command>
git fetch origin
git merge-base --is-ancestor origin/&lt;ветка&gt; origin/prod
</command>
<why_origin>
Берётся origin/&lt;ветка&gt;, а не локальная: локальная копия могла отстать,
и проверка прошла бы на неполном наборе коммитов — ветка выглядела бы
влитой, хотя часть её в prod не попала.
</why_origin>
<on_success>Ветку задачи можно удалить.</on_success>
<tag_release>
Тег stage-ok снимается: своё дело он сделал, задача прошла ворота допуска
и работает в Production.
git tag -d stage-ok/&lt;ветка&gt;
git push origin :refs/tags/stage-ok/&lt;ветка&gt;
<why>
Запись о приёмке не теряется: критерий, перечень проверок и результат
лежат в теле PR. Тег держать незачем.

Побочная выгода: перебор в блоке beta_reset идёт по stage-ok/*. Когда
прошедшие сняты, в нём остаются только те, ради которых он и делался, —
задачи с пройденной приёмкой, не доехавшие до Production.
</why>

</tag_release>
<exception name="откаченное слияние">
Вхождение ветки в prod закрытием задачи не является, если её слияние
было отменено revert-ом. Формально ветка влита, фактически содержимое
из prod убрано и в ветке ведётся исправление. Такую ветку не удалять
до завершения фазы 4 блока rollback.
Проверка: содержит ли история prod revert этого слияния.
</exception>
<ask_user>
Удаление ветки задачи и снятие тега stage-ok — одним вопросом.
Показать: имя ветки, имя тега и коммит, на котором он стоит.
</ask_user>
</step>

<emergency>
<rule>Ускоренного маршрута и обхода Stage не существует. Любая правка идёт полным потоком.</rule>
<why>
Срочность закрывается откатом, а не ускоренным кодом: блок rollback возвращает
работу пользователям за минуты и без единой новой строки. После отката
срочности нет, исправление идёт обычным маршрутом.

Сокращённая приёмка означала бы снижение требований к коду ровно в момент,
когда система уже сломана. Обход Stage возвращает состояние, из-за которого
вводился ствол: код работает в Production, не пройдя контур.
</why>
<order>
1. Откат по блоку rollback — вернуть работу пользователям.
2. Исправление в ветке задачи.
3. skills/deploy-stage.md целиком: проверки, PR в beta, развёртывание, приёмка, тег.
4. Возврат в Production по фазе 4 блока rollback.
</order>
<if name="откат невозможен">
Поломка не от кода — внешнее изменение, отказ смежной системы, исчерпание
ресурса. Возврат прежнего кода не помогает. Это не основание обходить Stage:
маршрут тот же, полный. Сообщить пользователю, что откат неприменим,
и назвать причину.
</if>
<forbidden>
<f>Сливать в prod ветку, не прошедшую приёмку на Stage, при любой срочности.</f>
<f>Ставить тег stage-ok по сокращённой проверке.</f>
<f>Разворачивать в Production код из ветки задачи напрямую, минуя PR.</f>
</forbidden>
</emergency>

<rollback>
<when>Сверка после развёртывания не прошла либо задача сломала Production.</when>

<phase id="1" name="вернуть работу пользователям">
<constraint>Выполняется первым. Разбор с веткой ждёт, пользователи нет.</constraint>
<command>
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout &lt;записанная точка отката&gt;'
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml build &lt;сервисы&gt;'
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml up -d --no-deps backend web'
</command>
<state>
Каталог /opt/sma-prod переведён в отсоединённое состояние: он на коммите,
а не на ветке. Это временно и допустимо только до конца фазы 2.
</state>
</phase>

<phase id="2" name="вернуть ветку prod">
<why>
PR слит на шаге 7, до развёртывания. Вершина prod содержит сломанный код,
фаза 1 её не трогает. Без этой фазы следующая задача создаётся от prod
уже со сломанным внутри, и её развёртывание вернёт поломку. Тихо:
разбираться будут с новой задачей.
</why>
<command>
git fetch origin
git switch -c revert/&lt;тема&gt; origin/prod
git revert -m 1 &lt;SHA коммита слияния&gt; --no-edit
git push -u origin revert/&lt;тема&gt;
gh pr create --base prod --title "revert: &lt;тема&gt;" --body "&lt;что сломалось, ссылка на исходный PR&gt;"
gh pr merge &lt;номер revert-PR&gt; --merge --delete-branch=false
</command>
<why_pr>
prod защищён, прямой push и force push запрещены. Обязательных одобрений
ноль, поэтому агент выполняет revert-PR сам, за десятки секунд.
</why_pr>
<explain flag="-m 1">
Отменяется коммит слияния, у него два родителя. -m 1 указывает оставить
первого — состояние prod до слияния.
</explain>
<record>
Записать SHA revert-коммита рядом с точкой отката. Без него фаза 4
не найдёт, что отменять.
</record>
<after>
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout prod &amp;&amp; git pull --ff-only'
Каталог возвращается на ветку, отсоединённое состояние снято.
</after>
<invariant>
В покое совпадают три вещи: HEAD в /opt/sma-prod, вершина origin/prod,
код в работающих контейнерах. Откат этот инвариант ломает и обязан
восстановить. Откат завершён тогда, когда все три сошлись, а не тогда,
когда каталог вернулся на ветку.
</invariant>
<check name="вершина prod совпадает с развёрнутым">
ssh sma 'cd /opt/sma-prod &amp;&amp; test "$(git rev-parse prod^{tree})" = "$(git rev-parse &lt;точка отката&gt;^{tree})"'
</check>
<on_success>Три состояния сошлись, фаза 2 завершена.</on_success>
<on_failure>
Пока шёл откат, другой агент влил в prod свою задачу. Вершина ветки содержит
её, работающие контейнеры — нет. Инвариант нарушен, откат не закончен.
Остановиться. Сообщить пользователю: в prod появилось изменение, его нет
в работающих контейнерах, показать что именно — git log &lt;точка отката&gt;..prod --oneline.
</on_failure>
<ask_user>
Как приводить в соответствие. Два варианта:
  развернуть текущую вершину prod — это развёртывание в Production,
    выполняется по шагам 5-10 этого skill с обычным подтверждением;
  откатить и чужое изменение тоже — если оно связано с поломкой.
Самостоятельно не выбирать.
</ask_user>
<forbidden>Завершать откат с известным расхождением каталога, ветки и контейнеров.</forbidden>
</phase>

<decision after="фаза 2">
<question>Что делать с задачей дальше. Решает пользователь.</question>
<case id="1" name="чиним">Фазы 3 и 4. Код задачи возвращается в prod вместе с исправлением.</case>
<case id="2" name="переделываем с опорой на код задачи">Блок rework. Код возвращается, работа идёт заново в новой ветке.</case>
<case id="3" name="отказываемся от кода задачи">Блок abandon. Код в prod не возвращается, фаза 2 остаётся конечным состоянием.</case>
<ask_user>Выбор случая. Самостоятельно не принимать.</ask_user>
</decision>

<phase id="3" name="исправление" case="1">
<constraint>
Работа продолжается в той же ветке задачи. Это оговорённое исключение
из правила о закрытой ветке, см. exception в skills/git-workflow.md.
</constraint>
<why>
Повторное слияние ветки после отката ничего не принесёт: её коммиты
остаются предками prod. git ответит Already up to date либо принесёт
только новые коммиты, отменённое содержимое не вернётся. Отказа не будет.
</why>
<flow>
Исправление коммитами в ветку задачи, затем skills/deploy-stage.md целиком:
проверки, PR в beta, развёртывание, приёмка, тег.
</flow>
<fact>
Откат затронул только prod. В beta слияние ветки осталось, содержимое там
на месте, приёмка идёт обычным порядком.
</fact>
</phase>

<phase id="4" name="возврат в Production" case="1">
<precondition>Исправление принято на Stage, тег stage-ok переставлен на новую вершину ветки.</precondition>
<why_order>
Revert от revert возвращает в prod фичу без исправления. Пока исправление
не принято, делать его нельзя: prod окажется в состоянии, которое уже
роняло Production.
</why_order>
<command>
# сначала оба PR, слияния — потом
git switch -c unrevert/&lt;тема&gt; origin/prod
git revert &lt;SHA revert-коммита из фазы 2&gt; --no-edit
git push -u origin unrevert/&lt;тема&gt;
gh pr create --base prod --title "unrevert: &lt;тема&gt;"
gh pr create --base prod --head &lt;ветка задачи&gt; --title "&lt;заголовок&gt;"

# затем два слияния подряд, без пауз
gh pr merge &lt;номер unrevert&gt; --merge --delete-branch=false
gh pr merge &lt;номер задачи&gt; --merge --delete-branch=false
</command>
<why_both_pr_first>
Между двумя слияниями prod содержит фичу без исправления — состояние,
которое уже роняло Production. Оба PR готовятся заранее, чтобы промежуток
занимал время одного слияния, а не время подготовки.
</why_both_pr_first>
<constraint>
Развёртывание между двумя слияниями запрещено. Ограничение связывает только
этого агента: другие агенты о нём не знают, их развёртывание в этот промежуток
поднимет сломанное состояние. Полностью риск снимается общим сигналом между
агентами — вопрос оркестрации, пункт P-06 бэклога.
</constraint>
<order_fixed>
Порядок слияний обратить нельзя. Исправление опирается на присутствующее
содержимое фичи; в prod его до unrevert нет, слияние даст конфликт.
</order_fixed>
<expect>
После обоих слияний prod содержит фичу и исправление. Дальше развёртывание
по шагам 5-10 этого skill.
</expect>
</phase>

<rework case="2">
<when>Решено переделать задачу по существу, но код ветки нужен как основа.</when>
<action>
Фазы 3 и 4 не применяются. Новая ветка от origin/prod, revert от revert
первым коммитом — содержимое задачи возвращается, — дальше работа заново.
Исходная ветка закрывается, но не удаляется.
</action>
<tag>
Тег stage-ok исходной ветки переносится по блоку tag_void: приёмка
удостоверяла код, который в этом виде в prod не поедет.
</tag>
<note>
Diff такой ветки содержит всё содержимое задачи вперемешку с переделкой,
читается тяжело. Поэтому путь запасной, а не основной.
</note>
</rework>

<abandon case="3">
<when>От кода задачи отказались: задача откладывается либо решается иначе с нуля.</when>
<action>
Revert от revert не выполняется. Фаза 2 — конечное состояние: prod вернулся
к тому, что было до задачи, и таким остаётся. Фазы 3 и 4 не применяются.
</action>
<branch>
Ветку задачи не удалять. Пока не решено окончательно, что код не понадобится,
удаление означает потерю работы. Задача возвращается в бэклог с записью,
что попытка была и чем закончилась.
</branch>
<tag>Тег stage-ok переносится по блоку tag_void.</tag>
</abandon>

<tag_void>
<when>Случай 2 или 3: код задачи в этом виде в prod не поедет.</when>
<why>
Тег stage-ok удостоверяет допуск к Production. От него зависят два механизма,
и оба сработают неверно, если тег оставить.

Ворота допуска, шаг 0: ветка не менялась, Stage не откатывали, все три сверки
пройдут — допуск останется действующим для кода, от которого отказались.

Сброс beta, блок beta_reset в skills/deploy-stage.md: перебор блокируется,
пока тег не вошёл в prod. Код заброшен, в prod он не попадёт никогда, значит
тег заблокирует сброс навсегда.
</why>
<command>
git tag -a reverted/&lt;ветка&gt; &lt;коммит исходного тега&gt; -m "Слияние откачено
branch: &lt;ветка задачи&gt;
revert: &lt;SHA revert-коммита фазы 2&gt;
случай: &lt;2 переделка | 3 отказ&gt;
причина: &lt;что сломалось в Production&gt;
дата: &lt;дата&gt;"
git push origin reverted/&lt;ветка&gt;

git tag -d stage-ok/&lt;ветка&gt;
git push origin :refs/tags/stage-ok/&lt;ветка&gt;
</command>
<order>
Сначала поставить новый тег, потом убрать прежний. Обратный порядок оставляет
промежуток, в котором записи о приёмке не существует.
</order>
<ask_user>Удаление тега stage-ok. Показать, какой тег и на каком коммите.</ask_user>
<note>
Удаляется указатель, не содержимое: коммит остаётся в ветке, запись
о приёмке сохраняется под именем reverted/&lt;ветка&gt;.
</note>
</tag_void>

<constraint>
Откат кода не откатывает базу. Если применялась миграция с удалением данных,
восстановление только из бэкапа. База впереди кода — состояние безопасное,
код впереди базы — опасное.
</constraint>
<forbidden>
<f>Оставить фазу 2 невыполненной. Расхождение сервера и ветки вернёт поломку следующей задачей.</f>
<f>Развёртывать что-либо в Production между двумя слияниями фазы 4.</f>
<f>Сливать ветку задачи повторно, не выполнив revert от revert.</f>
<f>Удалять ветку задачи, слияние которой откачено. Формально она влита в prod, фактически задача не закрыта.</f>
<f>Оставлять тег stage-ok в случаях 2 и 3. Он сохранит действующий допуск для кода, которого в prod нет, и заблокирует сброс beta навсегда.</f>
</forbidden>
</rollback>

<expected_warnings>
<w>the attribute `version` is obsolete</w>
<w>Found orphan containers</w>
<rule>Штатный вывод. Не считать ошибкой, не исправлять.</rule>
<rule>Флаг --remove-orphans не применять: удалит контейнеры соседнего контура.</rule>
</expected_warnings>

<env_and_secrets>
Правила обращения с переменными окружения и секретами вынесены
в skills/secrets.md. Файл общий для обоих контуров, читается до первой
команды, затрагивающей сервер. Здесь не дублируются, чтобы не разошлись.
</env_and_secrets>

<forbidden>
<f>Развёртывание без тега stage-ok и трёх сверок допуска.</f>
<f>Развёртывание без подтверждения пользователя.</f>
<f>Пропускать проверки на слиянии с prod.</f>
<f>Разворачивать коммит, отсутствующий в origin.</f>
<f>Разворачивать при непустом git status в каталоге развёртывания.</f>
<f>Разворачивать из каталога, отличного от /opt/sma-prod.</f>
<f>Запускать docker compose без -p sma-service и без всех трёх файлов контура.</f>
<f>Пересоздавать postgres.</f>
<f>Применять --remove-orphans.</f>
<f>Менять переменные окружения на сервере.</f>
<f>Применять миграцию с DELETE, DROP, ALTER без бэкапа и подтверждения.</f>
</forbidden>

<ask_user>
<a>Развёртывание в Production — всегда.</a>
<a>Миграция с DELETE, DROP или ALTER.</a>
<a>Удаление ветки задачи.</a>
<a>Откат Production.</a>
<a>Любое удаление, кроме временного worktree, созданного этим же шагом.</a>
<a>Неизвестный путь при определении области.</a>
<a>Расхождение факта с этим документом.</a>
</ask_user>

<related>
<r file="skills/agent-setup.md">подготовка машины: ssh и gh</r>
<r file="skills/secrets.md">переменные окружения и секреты, обязательно</r>
<r file="skills/git-workflow.md">ветвление и работа над задачей</r>
<r file="skills/deploy-stage.md">проверки, PR в beta, приёмка на Stage</r>
<r file="docs/DATABASE_MIGRATION_POLICY.md">правила изменения схемы</r>
</related>

</skill>
