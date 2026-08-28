<skill name="deploy-stage">

<purpose>
Проверки, PR в beta, развёртывание на Stage, приёмка. Заканчивается тегом
stage-ok, который допускает задачу к skills/deploy-prod.md.
</purpose>

<contour name="stage">
<branch>beta</branch>
<workdir>/opt/sma-beta</workdir>
<project>sma-service</project>
<compose_file>/opt/sma-beta/docker-compose.stage.yml</compose_file>
<compose_file>/etc/servicemanager-ai/docker-compose.stage.override.yml</compose_file>
<service area="backend">stage_backend</service>
<service area="frontend">stage_web</service>
<never_touch>stage_postgres</never_touch>
<url>https://stage.sma-assistants.ru</url>
<url_health>https://stage-api.sma-assistants.ru/health</url_health>
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
<p name="gh авторизован">
<command>gh auth status</command>
<expect>
Logged in to github.com. Права токена: Contents Read and write,
Pull requests Read and write, Metadata Read-only. Одного Contents мало —
gh pr create отдаст 403. Проверка права на PR: skills/agent-setup.md
часть C шаг 3.
</expect>
</p>
<p name="правила по секретам прочитаны">
<expect>skills/secrets.md прочитан до первой команды, затрагивающей сервер.</expect>
</p>
<p name="критерий приёмки">
<expect>Сформулирован в git-workflow шаг 1.</expect>
</p>
<on_missing>Настройка машины — skills/agent-setup.md.</on_missing>
</prerequisites>

<step id="0" name="восстановить инвариант beta ⊇ prod">
<command>
git fetch origin
git merge-base --is-ancestor origin/prod origin/beta
</command>
<on_failure>
beta отстаёт от prod. Восстановить:
test -z "$(git status --porcelain)"     # копия чистая, иначе switch откажет
git switch -C beta origin/beta          # локальная beta может отставать или отсутствовать
git merge origin/prod
git push origin beta
git switch &lt;ветка задачи&gt;
</on_failure>
<why_switch_C>
Обычный git switch beta берёт локальную ветку: на свежем клоне её нет,
а у давно работающей копии она отстаёт. Слияние тогда пойдёт от устаревшего
основания, и push откажет уже после того, как коммит создан.
Флаг -C ставит локальную beta ровно на origin/beta.
</why_switch_C>
<on_push_rejected>
Отказ non-fast-forward означает, что инвариант уже восстановил другой агент:
при 4-6 агентах после релиза отставание обнаруживают все сразу.
Это не ошибка. Перечитать состояние — git fetch origin — и повторить проверку
merge-base. Прошла — идти дальше, ничего не делая.
</on_push_rejected>
<allowed_exception>
Это одна из двух служебных операций, разрешённых напрямую в beta,
см. branch_status в skills/git-workflow.md. Запрет на прямой push
относится к коду задач, здесь в beta добавляется только код,
уже работающий в Production.
</allowed_exception>
<rationale>
Инвариант ломается после каждого релиза: задача уходит в prod своим коммитом
слияния, которого в beta нет. Без восстановления проверка на Stage пойдёт
на базе, где последней выложенной задачи не хватает.
</rationale>
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
Совпало несколько — области объединяются, выполняются все наборы.
none учитывается только если других совпадений нет.
Неизвестный путь — остановиться и спросить пользователя, к какой области его отнести.
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
На Stage развёртывание не выполняется: программы там нет, в compose она
не описана. Слияние в beta идёт обычным порядком после проверок.
Вопрос о доставке возникает в deploy-prod, здесь останавливаться не нужно.
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
2. Сверка после развёртывания, шаг 10.
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

<stage_note>
В docs/ лежат конфигурации доменов Production: api.servicemanagerai.ru
и max.servicemanagerai.ru. Конфигурации доменов Stage там нет, работающая
на сервере в репозитории не отражена. Область nginx на Stage срабатывает
редко и требует уточнения у пользователя, к какому контуру относится файл.
</stage_note>

<propose>
Выдать пользователю готовые команды. Все требуют root, выполняет пользователь.

# 1. сохранить прежнюю конфигурацию
sudo cp &lt;путь к рабочему файлу&gt; &lt;путь&gt;.bak-$(date +%Y%m%d-%H%M%S)

# 2. положить новую
sudo cp /opt/sma-beta/docs/&lt;имя файла&gt;.conf &lt;путь к рабочему файлу&gt;

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

<step id="2" name="опубликовать ветку">
<command>git push -u origin &lt;ветка&gt;</command>
<expect>push принят, ветка есть в origin.</expect>
<on_failure>
Отказ по правам — проверить токен, skills/agent-setup.md часть C.
Отказ non-fast-forward — ветка в origin ушла вперёд: над той же задачей
работает другой агент. Остановиться, сообщить пользователю, не перезаписывать.
</on_failure>
</step>

<step id="3" name="создать PR в beta">
<precheck>
gh pr list --head &lt;ветка&gt; --base beta --state open --json number
</precheck>
<if name="PR уже открыт">
Взять его номер и перейти к шагу 4. Второй PR из той же ветки в ту же
целевую не создаётся.
Случай штатный: приёмка провалилась, исправление внесено, поток пошёл
по второму кругу.
</if>
<command>
gh pr create --base beta --head &lt;ветка&gt; --title "&lt;заголовок&gt;" --body "&lt;суть задачи и критерий приёмки&gt;"
</command>
<expect>PR создан, номер получен.</expect>
<on_failure>
Сообщение о существующем PR — выполнить precheck и взять номер.
Отказ 403 — у токена нет права Pull requests: Read and write.
</on_failure>
</step>

<step id="4" name="получить результат слияния">
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
refs/pull/N/merge — пробное слияние, которое GitHub считает для открытого PR.
Это состояние beta после слияния. Ветка задачи не переписывается,
force-push не требуется, база всегда актуальна.
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
git merge --no-commit --no-ff origin/beta
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

<step id="5" name="проверки на результате слияния">

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
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml exec -T stage_backend npx prisma validate'
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
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch origin refs/pull/&lt;номер&gt;/merge'
ssh sma 'cd /opt/sma-beta &amp;&amp; git worktree add /tmp/verify-&lt;номер&gt; FETCH_HEAD'
</setup>
<check>
ssh sma 'docker compose -p sma-service -f /tmp/verify-&lt;номер&gt;/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml config -q'
</check>
<cleanup mandatory="true">
ssh sma 'cd /opt/sma-beta &amp;&amp; git worktree remove --force /tmp/verify-&lt;номер&gt;'
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
<on_failure>Не сливать. Исправить в ветке задачи, повторить с шага 4.</on_failure>
<excluded tool="npm run lint">
Во фронтенде 301 ошибка, в бэкенде ~11900. Бэкендовый lint содержит --fix
и изменяет исходники, поэтому не является read-only проверкой.
</excluded>
</step>

<step id="6" name="проверить каталог и конфигурацию контура">
<why_before_merge>
Окружение проверяется до слияния PR. Слияние необратимо, а отказ этой
проверки означает, что разворачивать некуда: контур поднят из другого
каталога или другим набором файлов. Тот же порядок в skills/deploy-prod.md.
</why_before_merge>
<command>
ssh sma 'docker inspect sma_stage_web --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}"'
ssh sma 'docker inspect sma_stage_web --format "{{index .Config.Labels \"com.docker.compose.project.config_files\"}}"'
</command>
<expect>
workdir равен /opt/sma-beta.
config_files совпадает со списком compose_file в &lt;contour&gt;, порядок тот же.
</expect>
<on_failure>
Контур поднят из другого каталога или другим набором файлов. Не разворачивать,
сообщить пользователю фактические значения.
</on_failure>
</step>

<step id="7" name="слить PR">
<command>gh pr merge &lt;номер&gt; --merge --delete-branch=false</command>
<constraint>Ветку не удалять: она понадобится для PR в prod.</constraint>
<on_failure>Отказ с указанием, что ветка устарела — целевая ушла вперёд. Повторить с шага 4.</on_failure>
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
ssh sma 'cd /opt/sma-beta &amp;&amp; test -z "$(git status --porcelain)"'
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch origin'
ssh sma 'cd /opt/sma-beta &amp;&amp; git checkout beta'
ssh sma 'cd /opt/sma-beta &amp;&amp; git pull --ff-only'
</still_required>
<why_still>
Ветка уходит вперёд и при изменении одной документации. Без git pull
каталог останется на прежнем коммите и разойдётся с вершиной ветки —
состояние, которое сверка шага 10 называет нарушением инварианта.
Каталог обязан соответствовать ветке всегда, работающий код при этом
не трогается: изменений в нём нет.
</why_still>
<then>
Перейти к шагу 10 — сверке. Она проверяет результат git pull:
каталог на своей ветке и не отстаёт от её вершины. Пропускать её
нельзя, pull выполнялся.
Проверки, относящиеся к контейнерам, при этом неприменимы: аптайм
и логи не менялись, сравнивать не с чем.
</then>
<then_criterion>
Дальше шаг 11, критерий приёмки. Он проверяется там, где живёт
изменение: для документации и правил — в репозитории, а не
в работающей системе. Критерий не обязан быть runtime-ным.
</then_criterion>
</skip_deploy>

<record before="развёртыванием">
ssh sma 'docker inspect sma_stage_postgres sma_stage_backend sma_stage_web --format "{{.Name}} {{.State.StartedAt}} {{.State.Status}}"'
MARK=$(date -u +%FT%TZ)   # отметка времени до развёртывания, от неё считаются ошибки после
ssh sma 'docker logs sma_stage_backend --since 10m 2&gt;&amp;1 | grep -icE "error|exception"'
</record>
<why_startedat>
Записывается StartedAt, а не RunningFor. RunningFor — словесная относительная
длительность вида "About an hour", она меняется сама по ходу времени.
Сверка после развёртывания дала бы ложную аварию при пересечении границы
округления. StartedAt — точная отметка старта, меняется только при
перезапуске или пересоздании контейнера.
</why_startedat>
<precondition name="рабочая копия чистая">
ssh sma 'cd /opt/sma-beta &amp;&amp; test -z "$(git status --porcelain)"'
</precondition>
<on_failure>
Код возврата не 0 — в каталоге развёртывания есть незакоммиченные изменения.
Не разворачивать. Показать пользователю, что именно там лежит:
ssh sma 'cd /opt/sma-beta &amp;&amp; git status --short'
Происхождение выяснить до продолжения: содержимое каталога должно
совпадать с веткой, посторонние правки означают ручное вмешательство
в обход потока.
</on_failure>
<command>
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch origin'
ssh sma 'cd /opt/sma-beta &amp;&amp; git checkout beta'
ssh sma 'cd /opt/sma-beta &amp;&amp; git pull --ff-only'
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
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml build &lt;сервисы по области&gt;'
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
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml up -d --no-deps stage_backend stage_web'
</always>
<note>
Пересоздавать контейнер или нет — решает compose, сравнивая конфигурацию
и образ с текущими. Агент решает только вопрос пересборки.
</note>
<constraint>--no-deps обязателен: stage_postgres не пересоздавать.</constraint>
</step>

<step id="9" name="применить миграции" if="has_migration">
<fact>
Stage не применяет миграции автоматически: в docker-compose.stage.yml нет
переопределения command. Это отдельный шаг.
</fact>
<ask_user>Миграция содержит DELETE, DROP или ALTER.</ask_user>
<command>
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml exec -T stage_backend npx prisma migrate deploy'
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml exec -T stage_backend npx prisma migrate status'
</command>
<expect>Database schema is up to date</expect>
</step>

<step id="10" name="сверка после развёртывания">
<must name="контур на своей ветке">
ssh sma 'cd /opt/sma-beta &amp;&amp; git rev-parse --abbrev-ref HEAD'
Равно beta. Значение HEAD означает отсоединённое состояние — отказ.
</must>
<must name="развёрнутый коммит содержит код задачи">
STAGE_HEAD=$(ssh sma 'cd /opt/sma-beta &amp;&amp; git rev-parse HEAD')
git fetch origin
git merge-base --is-ancestor "$(git rev-parse origin/&lt;ветка&gt;)" "$STAGE_HEAD"
Код возврата 0.
</must>
<why_not_equality>
Проверяется вхождение, не равенство с вершиной origin/beta. Между слиянием
вашего PR и этой сверкой проходят минуты развёртывания. За это время другой
агент сливает свой PR либо разворачивает своё, и вершина уезжает вперёд.
Равенство дало бы отказ там, где развёрнуто ровно то, что разворачивали.
Вхождение отвечает на нужный вопрос: ваш код на контуре есть.
</why_not_equality>
<not_covered>
Вхождение не доказывает, что рядом нет чужого кода. Если чужая задача сломала
то, что проверяет ваш критерий, приёмка на шаге 11 провалится не по вашей вине,
и отличить одно от другого агент не сможет. Закрывается только согласованием
между агентами — пункт P-06 и раздел «Замок на развёртывание» бэклога.
</not_covered>
<must name="база не тронута">
ssh sma 'docker inspect sma_stage_postgres --format "{{.State.StartedAt}}"'
Строка совпадает с записанной до развёртывания посимвольно.
Отличается — контейнер базы пересоздан или перезапущен. Авария,
немедленно сообщить пользователю, дальнейшие шаги не выполнять.
</must>
<must name="контур отвечает">
curl -o /dev/null -w "%{http_code}" https://stage.sma-assistants.ru/ → 200
curl -o /dev/null -w "%{http_code}" https://stage-api.sma-assistants.ru/health → 200
</must>
<must name="нет новых ошибок в логах">
<case name="контейнер не пересоздавался">
StartedAt тот же, что записан до развёртывания.
ssh sma 'docker logs sma_stage_backend --since &lt;MARK&gt; 2&gt;&amp;1 | grep -icE "error|exception"'
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
ssh sma 'docker logs sma_stage_backend 2&gt;&amp;1 | grep -icE "error|exception"'
Считается весь лог нового контейнера. Ожидание — ноль либо известные
штатные строки. Любая ошибка при старте разбирается сразу.
</case>
<why>
Прежние редакции сравнивали числа из разных окон: 10 минут до и 3 минуты
после. Несопоставимо, а при пересборке сравнение вообще теряет смысл.
</why>
</must>
<conditional name="перезапуск контейнеров">
ssh sma 'docker inspect sma_stage_backend sma_stage_web --format "{{.Name}} {{.State.StartedAt}}"'
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
<on_failure>Не ставить тег, сообщить пользователю.</on_failure>
</step>

<step id="11" name="приёмка">
<precondition if="задета область nginx">
Команды применения конфигурации nginx выполнены пользователем, блок propose
области nginx. До этого проверяемое поведение недостижимо: контейнеры уже
на новом коде, а маршрутизация — на прежней конфигурации.
Не объявлять приёмку, ждать подтверждения пользователя.
</precondition>
<action>Проверить критерий, зафиксированный в git-workflow шаг 1.</action>
<reference file="docs/11_RUNTIME_ACCEPTANCE.md">протокол приёмки</reference>
<expect>Критерий выполнен.</expect>
<on_failure>Не ставить тег. Исправлять в ветке задачи, повторить с шага 4.</on_failure>
</step>

<step id="12" name="поставить тег приёмки">
<target>
Тег ставится на вершину ветки задачи, не на развёрнутый коммит слияния.
</target>
<naming>
Имя тега содержит полное имя ветки вместе с типом: stage-ok/fix/push-fix,
не stage-ok/push-fix. Иначе fix/push-fix и feat/push-fix дают один тег,
и второй агент либо получит отказ, либо перезапишет чужой признак приёмки.
</naming>
<command>
git rev-parse origin/&lt;ветка&gt;                    # это B, на него ставится тег
ssh sma 'cd /opt/sma-beta &amp;&amp; git rev-parse HEAD'  # это M, на нём проводилась приёмка

git tag -a stage-ok/&lt;ветка&gt; $(git rev-parse origin/&lt;ветка&gt;) -m "Stage acceptance passed
branch: &lt;ветка&gt;
branch_sha: &lt;B&gt;
stage_sha: &lt;M — коммит, развёрнутый на Stage во время приёмки&gt;
criterion: &lt;критерий приёмки&gt;
checks: &lt;перечень пройденных наборов&gt;
date: &lt;дата&gt;"
git push origin stage-ok/&lt;ветка&gt;
</command>
<rationale>
В потоке три разных коммита: вершина ветки B, слияние с beta M, слияние
с prod. Приёмка проводится на M, но M существует только в истории beta
и в prod не попадает никогда. В prod уходит своё слияние, общий объект
у всех трёх состояний — только B.

Поэтому тег ставится на B, а M записывается в тело тега как обстоятельство
приёмки: по нему потом видно, на какой базе проверяли.

Тег на B работает в обе стороны: появится новый коммит в ветке — тег
останется на старом, deploy-prod это обнаружит. Уедет в prod — B станет
предком prod, и тег перестанет блокировать сброс beta.
</rationale>
<on_failure>
Тег stage-ok/&lt;ветка&gt; уже существует — это повторная приёмка после исправлений.
Переставить: git tag -f -a stage-ok/&lt;ветка&gt; ... и git push --force origin stage-ok/&lt;ветка&gt;.
Перестановка допустима только на вершину той же ветки задачи.
</on_failure>
</step>

<step id="13" name="завершение">
<action>Задача допущена к Production. Перейти к skills/deploy-prod.md.</action>
</step>

<beta_reset>
<when>После развёртывания prod в Production.</when>
<why>
beta накапливает всё, что в неё слили: и доехавшее до Production, и отброшенное.
Проверка на Stage теряет смысл, когда идёт на базе, которой в Production нет.
Сброс возвращает beta к состоянию Production. Незавершённые задачи не теряются,
они лежат в своих ветках.
</why>
<precondition fail="ask_user">
Нет тегов stage-ok, чей коммит не влит в prod:

git fetch --prune --prune-tags origin
for t in $(git tag -l 'stage-ok/*'); do
  git merge-base --is-ancestor "$t^{commit}" origin/prod || echo "БЛОКИРУЕТ: $t"
done

Вывод пуст — сброс разрешён.

Флаг --prune-tags обязателен. Обычный git fetch --tags не удаляет локальные
теги, снятые в origin: у другого агента снятый тег останется в его копии
и будет попадать в список БЛОКИРУЕТ бесконечно — тот самый отказ, ради
предотвращения которого написан tag_void.

В переборе остаются только теги задач с пройденной приёмкой, не доехавших
до Production. Прошедшие сняты при закрытии задачи, блок tag_release
в skills/deploy-prod.md шаг 12. Теги откаченных задач переименованы
в reverted/&lt;ветка&gt; блоком tag_void там же.
</precondition>
<rationale>
Тег стоит на вершине ветки задачи. Пока задача не слита в prod, её вершина
предком prod не является, тег попадает в список БЛОКИРУЕТ и сброс запрещён.
После слияния вершина становится предком prod, и тег блокировать перестаёт.

Защита нужна потому, что сброс убирает из beta код чужой задачи, уже прошедшей
приёмку. Её тег остался бы удостоверять проверку на состоянии, которого больше
нет на контуре.
</rationale>
<precondition>Текущая ветка — не beta.</precondition>
<on_precondition_failure>
git branch -f откажет с сообщением cannot force update the branch used
by worktree. Перейти в свою ветку задачи и повторить.
</on_precondition_failure>
<command>
git fetch --prune --prune-tags origin
git switch &lt;ветка задачи&gt;
git branch -f beta origin/prod
git push --force-with-lease origin beta
</command>
<allowed_exception>
Вторая из двух служебных операций, разрешённых напрямую в beta,
см. branch_status в skills/git-workflow.md. Через PR force push не делается.
</allowed_exception>
</beta_reset>

<expected_warnings>
<w>the attribute `version` is obsolete</w>
<w>Found orphan containers</w>
<rule>Штатный вывод. Не считать ошибкой, не исправлять.</rule>
<rule>Флаг --remove-orphans не применять: удалит контейнеры соседнего контура. Stage и Production живут в одном compose-проекте sma-service.</rule>
</expected_warnings>

<env_and_secrets>
Правила обращения с переменными окружения и секретами вынесены
в skills/secrets.md. Файл общий для обоих контуров, читается до первой
команды, затрагивающей сервер. Здесь не дублируются, чтобы не разошлись.
</env_and_secrets>

<forbidden>
<f>Разворачивать коммит, отсутствующий в origin.</f>
<f>Разворачивать при непустом git status в каталоге развёртывания.</f>
<f>Разворачивать из каталога, отличного от /opt/sma-beta.</f>
<f>Запускать docker compose без -p sma-service и без обоих файлов контура.</f>
<f>Пересоздавать stage_postgres.</f>
<f>Применять --remove-orphans.</f>
<f>Ставить тег stage-ok без пройденной приёмки.</f>
<f>Удалять ветку задачи после слияния в beta.</f>
</forbidden>

<ask_user>
<a>Миграция содержит DELETE, DROP или ALTER.</a>
<a>Сброс beta при наличии неиспользованных тегов stage-ok.</a>
<a>Любое удаление, кроме временного worktree, созданного этим же шагом.</a>
<a>Неизвестный путь при определении области.</a>
<a>Расхождение факта с этим документом.</a>
</ask_user>

<related>
<r file="skills/agent-setup.md">подготовка машины: ssh и gh</r>
<r file="skills/secrets.md">переменные окружения и секреты, обязательно</r>
<r file="skills/git-workflow.md">ветвление и работа над задачей</r>
<r file="skills/deploy-prod.md">развёртывание в Production</r>
</related>

</skill>
