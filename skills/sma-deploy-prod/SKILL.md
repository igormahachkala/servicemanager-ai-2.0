---
name: sma-deploy-prod
description: "Развёртывание в Production: проверки на результате слияния, PR в ветку prod, бэкап базы перед миграциями, выкладка на боевой сервер, сверка после развёртывания, откат. Обязательно применять, когда пользователь просит выкатить в прод, в продакшен, на боевой, обновить работающий сервис, или откатить неудачное развёртывание. Применять только после приёмки на Stage: допуск подтверждается тегом stage-ok, без него развёртывание не начинать. Скилл меняет состояние живого Production по ssh, ошибка видна пользователям. Требует настроенной машины, это sma-agent-setup."
---

<purpose>
Проверки, PR в prod, развёртывание в Production. Применяется только после
sma-deploy-stage, подтверждением служит тег stage-ok.
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

<ref file="skills/_shared/precedence.md">Приоритет над документацией. Прочитать до начала работы.</ref>

<ref file="skills/_shared/execution-context.md">Где выполняется команда: машина агента или сервер. Прочитать до первой команды.</ref>

<ref file="skills/_shared/prerequisites.md">Условия допуска к работе. Прочитать и выполнить до шага 0. Пункты с contour="stage" к этому скилу не относятся.</ref>
<ref file="skills/_shared/secrets.md">Обращение с секретами и переменными окружения. Прочитать до первой команды, затрагивающей сервер: этого требует блок prerequisites.</ref>

<step id="0" name="сверка допуска">
<basis>
Тег stage-ok на вершине ветки задачи — B. На Stage развёрнут коммит слияния
этой ветки с beta — M. Они различны всегда, равенства требовать нельзя.
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
Сверка 3 не отличает чужое развёртывание на Stage после вашей приёмки: ваш код
на контуре остался, допуск сохраняется. Обстоятельства приёмки — в поле
stage_sha тела тега. Выбор сознательный: Stage один на 4-6 агентов, строгое
равенство HEAD снимало бы допуск при каждом чужом развёртывании.
</known_limit>
</step>

<step id="1" name="определить область изменения">
<run script="skills/_shared/scripts/area-map.sh">
skills/_shared/scripts/area-map.sh &lt;ветка задачи&gt;
</run>
<expect>
Две строки: areas со списком областей, flags с признаками has_migration
и needs_rebuild. Код возврата 0.
</expect>
<on_failure>
Код 1 — неизвестный путь, скрипт назвал какие. Остановиться и спросить
пользователя, к какой области отнести, затем добавить правило в скрипт.
Код 5 — изменений относительно origin/prod нет, разворачивать нечего.
Код 2 или 3 — неверные аргументы либо git не отработал, разобрать вывод.
</on_failure>
<resolution>
Совпало несколько областей — выполняются все наборы.
Скрипт уже отбросил none, если были другие совпадения.
</resolution>
<areas>
Описание области читается только для той, что вернул скрипт. Областей
backend, frontend, infra и none описаний нет: их наборы проверок заданы
в skills/_shared/merge-checks.md.
</areas>
<carry>Области и флаги переносятся в шаги 4 и 8.</carry>
</step>
<ref file="skills/_shared/areas/nginx.md">Область nginx: конфигурация вне compose, сравнение с рабочей, порядок применения. Читать, только если скрипт вернул nginx.</ref>
<ref file="skills/_shared/areas/agent-runner.md">Область agent-runner: порядок доставки не определён. Читать, только если скрипт вернул agent-runner.</ref>
<ref file="skills/_shared/areas/skills.md">Область skills: требования к телу PR. Читать, только если скрипт вернул skills.</ref>
<ref file="skills/_shared/areas/scripts.md">Область scripts: проверка синтаксиса. Читать, только если скрипт вернул scripts.</ref>

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
<mergeability>
<why>
Пробное слияние считается фоново, ссылка появляется через секунды после
gh pr create. Отсутствие ссылки в этом окне — не конфликт.
Состояние спрашивать у GitHub, не выводить из неудачи git fetch.
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
Досланный коммит запускает пересчёт: ссылка временно указывает на прежнее
состояние либо пропадает. Переспросить состояние.
</note>
</mergeability>
<conflict_files>
<why>
Списка конфликтующих файлов нет: ссылка не создана, локально не сливалось.
Воспроизвести конфликт в своей копии.
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
<ref file="skills/_shared/merge-checks.md">Наборы проверок, локальных и на сервере. Прочитать целиком перед выполнением. Команды приведены готовыми строками для каждого контура: брать блок contour="production". Прогон обязателен, даже если те же проверки прошли в sma-deploy-stage.</ref>
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
Откат кода миграцию не отменяет: удалённые или изменённые данные вернёт
только дамп. Подтверждение словами доказательством не является — проверяется
файл и его размер.
</why>

<precondition name="каталог существует">
ssh sma 'test -d /var/backups/sma -a -w /var/backups/sma'
</precondition>
<on_precondition_failure>Каталог не заведён — sma-agent-setup, часть A, initial_setup.</on_precondition_failure>

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
Подставить значение, не имя переменной: проверки идут отдельными вызовами,
переменная из предыдущей не доживёт.
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
<action>Проверить в Production критерий, зафиксированный в sma-code-delivery шаг 1.</action>
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
см. branch_status в sma-code-delivery. Запрет на прямой push
относится к коду задач, здесь в beta добавляется только код,
уже работающий в Production.
</allowed_exception>
<rationale>
Иначе следующая проверка на Stage пойдёт на базе без развёрнутой задачи.
</rationale>
<alternative>
Если блок beta_reset в sma-deploy-stage разрешён предусловием, вместо
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
Срочность закрывается откатом: rollback возвращает работу за минуты и без
единой новой строки, после него срочности нет. Сокращённая приёмка снижала бы
требования ровно тогда, когда система уже сломана, а обход Stage возвращает
состояние, из-за которого вводился ствол.
</why>
<order>
1. Откат по блоку rollback — вернуть работу пользователям.
2. Исправление в ветке задачи.
3. sma-deploy-stage целиком: проверки, PR в beta, развёртывание, приёмка, тег.
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

<ref file="skills/sma-deploy-prod/references/rollback.md">Порядок отката: две фазы, возврат ветки prod, повторное вливание, работа с тегом. Читать только при откате.</ref>

<expected_warnings>
<w>the attribute `version` is obsolete</w>
<w>Found orphan containers</w>
<rule>Штатный вывод. Не считать ошибкой, не исправлять.</rule>
<rule>Флаг --remove-orphans не применять: удалит контейнеры соседнего контура.</rule>
</expected_warnings>

<env_and_secrets>
Правила обращения с переменными окружения и секретами вынесены
в skills/_shared/secrets.md. Файл общий для обоих контуров, читается до первой
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
<a>Начало работы по этому скилу без явной команды пользователя выкатить в Production. Тег stage-ok — допуск, а не разрешение катить.</a>
<a>Миграция с DELETE, DROP или ALTER.</a>
<a>Удаление ветки задачи.</a>
<a>Откат Production.</a>
<a>Любое удаление, кроме временного worktree, созданного этим же шагом.</a>
<a>Неизвестный путь при определении области.</a>
<a>Расхождение факта с этим документом.</a>
</ask_user>

<related>
<r skill="sma-agent-setup" file="skills/sma-agent-setup/SKILL.md">подготовка машины: ssh и gh</r>
<r file="skills/_shared/secrets.md">переменные окружения и секреты, обязательно</r>
<r skill="sma-code-delivery" file="skills/sma-code-delivery/SKILL.md">ветвление и работа над задачей</r>
<r skill="sma-deploy-stage" file="skills/sma-deploy-stage/SKILL.md">проверки, PR в beta, приёмка на Stage</r>
<r file="docs/DATABASE_MIGRATION_POLICY.md">правила изменения схемы</r>
</related>
