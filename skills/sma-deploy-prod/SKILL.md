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

<contents>
Файл длиннее 300 строк, ниже карта. Шаги идут в порядке выполнения.
Искать по имени блока: номера строк тут не приводятся, они сдвигаются
при каждой правке.

  шаг 0   сверка допуска: три проверки тега stage-ok и проверка замка
  шаг 1   определить область изменения, скрипт area-map.sh
  шаг 2   создать PR в prod, precheck на уже открытый
  шаг 3   получить результат слияния, разбор конфликта
  шаг 4   проверки на результате слияния, скрипт merge-checks.sh;
          прогон обязателен, даже если те же проверки прошли на Stage
  шаг 5   подготовка к развёртыванию: каталог, точка отката,
          подтверждение пользователя — только для областей backend,
          frontend, infra
  шаг 6   бэкап базы — только при флаге has_migration
  шаг 7   занять контур замком и слить PR, скрипт lock-acquire.sh,
          отдельный вопрос пользователю перед слиянием
  шаг 8   развернуть; для none, scripts, skills, nginx контейнеры
          не поднимаются, блок skip_deploy, но git pull обязателен
  шаг 9   сверка после развёртывания
  шаг 10  проверка критерия приёмки в Production
  шаг 11  восстановить инвариант beta ⊇ prod слиянием prod в beta;
          сброс beta сюда не относится, блок reset_is_not_here
  шаг 12  закрытие задачи: снять замок, снять stage-ok, тег keep,
          вопрос об удалении ветки

  emergency          ускоренного маршрута нет, порядок при аварии
  expected_warnings  штатный вывод compose, ошибкой не считать
  env_and_secrets    отсылка к общему файлу secrets.md
  forbidden          что в Production делать нельзя
  ask_user           что спрашивать у пользователя всегда

Общие файлы читаются по ссылкам ref ниже: precedence, execution-context,
contour-lock, prerequisites и secrets — до начала работы; merge-checks —
на шаге 4; описания областей в areas/ — только для той области,
которую вернул скрипт шага 1. Порядок отката —
references/rollback.md, читается только при откате.
</contents>

<ref file="skills/_shared/precedence.md">Приоритет над документацией. Прочитать до начала работы.</ref>

<ref file="skills/_shared/execution-context.md">Где выполняется команда: машина агента или сервер. Прочитать до первой команды.</ref>

<ref file="skills/_shared/contour-lock.md">Замок контура: проверка, постановка, снятие. Прочитать до шага 0, он проверяет занятость.</ref>

<ref file="skills/_shared/prerequisites.md">Условия допуска к работе. Прочитать и выполнить до шага 0. Пункты с contour="stage" к этому скилу не относятся.</ref>
<ref file="skills/_shared/secrets.md">Обращение с секретами и переменными окружения. Прочитать до первой команды, затрагивающей сервер: этого требует блок prerequisites.</ref>

<step id="0" name="сверка допуска">
<basis>
Тег стоит на вершине ветки задачи, а на Stage развёрнут коммит слияния
этой ветки с beta. Они различны всегда, поэтому сверка 3 проверяет
вхождение, а не равенство.
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
Сверка 3 не отличает чужое развёртывание на Stage после вашей приёмки:
ваш код на контуре остался, допуск сохраняется. Обстоятельства приёмки —
поле stage_sha тела тега.
</known_limit>
<lock_check name="Production не занят">
test -z "$(git ls-remote --tags origin 'refs/tags/prod-busy')"

Код 0 — контур свободен, идти дальше. Ненулевой код останавливает: проверка
обязана давать код, а не вывод на прочтение, блок why_test_z общего файла
skills/_shared/contour-lock.md. Имя замка фиксированное, без ветки:
принадлежность читается из тела.
</lock_check>
<on_lock_failure>
Production занят другим агентом. Не создавать PR, не сливать, не разворачивать.
Разобрать замок блоком classify справочника
skills/_shared/references/contour-lock-cases.md: возраст, ветка, PR, что
развёрнуто в /opt/sma-prod, — и показать пользователю одним сообщением.
Порог для Production 2 часа. Чужой замок не снимать, блоки foreign_lock и lock_void
справочника skills/_shared/references/contour-lock-cases.md.
</on_lock_failure>
<why_here>
Проверка стоит здесь, чтобы не создавать PR и не гонять проверки на занятом
контуре. Замок ставится позже, шагом 7: гонку между проверкой и постановкой
ловит отказ push.
</why_here>
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
<constraint>
В отсоединённом состоянии не коммитить и не править файлы: правки только
после возврата в ветку задачи, шаг 4 возвращает копию сам.
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
Проверка защищает от последствий up -d: compose опознаёт контейнеры
по имени проекта sma-service, а не по каталогу, и подъём из чужого каталога
молча пересоздал бы работающие контейнеры по нашим файлам. Для областей,
где up -d не выполняется, пересоздавать нечего.
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
<why_pipefail>
Команда идёт через bash -c и с set -o pipefail. В dash pipefail —
синтаксическая ошибка, а без флага код возврата конвейера берётся от gzip.
Проверено запуском: false | gzip &gt; out.gz даёт код 0 и файл в 20 байт,
который gzip -t принимает. Без pipefail бэкап объявляется снятым, когда
его нет.
</why_pipefail>
<why_env_from_container>
Имена пользователя и базы берутся из окружения контейнера: оверрайд
Production может задавать другие. Значения нигде не печатаются.
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
Размер — грубая подстраховка, основная проверка это код возврата. Порог
низкий намеренно: ловит пустой и обрезанный файл, а не расхождение
с объёмом базы. Есть предыдущий дамп — сравнить с ним, падение в разы
означает, что снялась часть.
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

<step id="7" name="занять контур и слить PR">
<order>
Проверить замок заново, поставить свой, слить PR. Между шагом 0 и этим
местом прошли проверки и подтверждение пользователя — за это время контур
мог занять другой агент.
</order>
<run script="skills/_shared/scripts/lock-acquire.sh">
skills/_shared/scripts/lock-acquire.sh production &lt;ветка задачи&gt; &lt;номер PR&gt;
</run>
<codes>
  0  контур ваш: замок поставлен либо уже стоял и ветка в нём ваша,
     идти к слиянию
  1  контур занят другим агентом: разбор напечатан, показать его
     пользователю и остановиться. Чужой замок не снимать, блоки foreign_lock и lock_void
     справочника skills/_shared/references/contour-lock-cases.md
  2  неверные аргументы
  3  git не отработал
  5  контур заняли между проверкой и постановкой: свой локальный тег скрипт
     удалил сам, повторить позже
</codes>
<two_calls>
Вызовов скрипта два, и роли у них разные.
Постановка — отдельной командой: скрипт вернул код, агент его разобрал,
и только после этого идёт слияние. В цепочку со слиянием не связывать:
между ними стоит разбор, а он ведёт к разным действиям.
Проверка владения — связкой со слиянием через &amp;&amp;, как в команде ниже:
gh pr merge запускается, только если проверка вернула ноль. Отдельной
строкой слияние не писать, оно выполнится независимо от результата.
Проверка отвечает нулём в одном случае: замок стоит в origin и ветка
в его теле ваша. Отсутствие замка блокирует слияние наравне с чужим.
</two_calls>
<manual>
Тот же порядок вручную, если скрипт недоступен: блоки check, read
и acquire общего файла skills/_shared/contour-lock.md.
</manual>
<ask_user name="слияние в prod">
Спросить до слияния, отдельно от подтверждения шага 5. Показать: номер PR,
SHA вершины ветки, SHA результата слияния, состав изменения, области,
наличие миграций, точку отката.
<why>
Подтверждение шага 5 даётся на развёртывание, а слияние идёт раньше
и необратимо. Для областей, где шаг 5 пропускается — none, scripts, skills,
nginx, — слияние вообще единственное необратимое действие круга.
</why>
<constraint>
Молчание, «ок» на отчёт и отсутствие возражений командой не являются.
Решено 2 сентября 2026, В-09 реестра.
</constraint>
</ask_user>
<command>
skills/_shared/scripts/lock-acquire.sh --owned production &lt;ветка&gt; \
  &amp;&amp; gh pr merge &lt;номер&gt; --merge --delete-branch=false
</command>
<on_failure>
Отказ с указанием, что ветка устарела — prod ушёл вперёд. Повторить с шага 3.
Замок снять: контур занят, а слияния не было.
</on_failure>
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
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch --prune --prune-tags origin'
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
ssh sma 'cd /opt/sma-prod &amp;&amp; git fetch --prune --prune-tags origin'
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout prod'
ssh sma 'cd /opt/sma-prod &amp;&amp; git pull --ff-only'   # отказ означает
# коммиты в каталоге развёртывания: разбираться, не сливать
</command>
<why_separate>
Проверку нельзя ставить звеном цепочки через &amp;&amp;: git status возвращает 0
и при грязной копии, цепочка пойдёт дальше. Останавливает только команда,
дающая ненулевой код, — test -z по выводу git status --porcelain.
</why_separate>
<why_prune_tags>
Флаги --prune --prune-tags обязательны: снятые в origin теги замков иначе
остаются локально и ломают fetch в каталоге развёртывания.
Отказов два, и они разные. 'cannot create refs/tags/prod-busy' валит fetch
целиком, за ним не проходит pull — каталог остаётся на прежнем коммите.
'would clobber existing tag' отклоняет только тег замка, ветки обновлены
и pull проходит — не останавливаться. Код возврата у обоих 1, различать
по выводу. Разбор — блоки stale_local_tags и clobber_not_error справочника
skills/_shared/references/contour-lock-cases.md.
Fetch, checkout и pull ниже выполняются отдельными вызовами: связанные
через &amp;&amp;, они оборвались бы на коде 1 от fetch, и каталог остался бы
на прежнем коммите.
</why_prune_tags>

<rebuild if="область содержит backend или frontend, либо флаг needs_rebuild">
ssh sma 'cd /opt/sma-prod &amp;&amp; RELEASE_SHA=$(git rev-parse HEAD) &amp;&amp; SMA_RELEASE_ENFORCE=true SMA_RELEASE_COMMIT_SHA="$RELEASE_SHA" SMA_RELEASE_ENVIRONMENT=prod docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml build --build-arg SMA_RELEASE_ENFORCE=true --build-arg SMA_RELEASE_COMMIT_SHA="$RELEASE_SHA" --build-arg SMA_RELEASE_ENVIRONMENT=prod &lt;сервисы по области&gt;'
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
допустимы. В Production проверяются оба условия — расхождение означает,
что работает не то, что числится в prod.
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
Не --since 10m: окно скользящее, до развёртывания оно отсчитывается
от одного момента, после — от другого. Абсолютная отметка MARK снимает
и это, и необходимость сравнивать числа.
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
<main_path>
Инвариант восстанавливается слиянием prod в beta. Это единственный путь
внутри релиза, и других вариантов на этом шаге нет.

Слияние ничего не переписывает: оно добавляет в beta то, что уже работает
в Production, и оставляет на месте чужие задачи, которые проходят приёмку
прямо сейчас.
</main_path>
<reset_is_not_here>
Сброс beta = prod к релизу не относится. Это отдельная операция уборки,
она убирает из beta всё, что не доехало до Production, и выполняется
по решению пользователя, а не по ходу выкатки.

Прежняя редакция этого блока предписывала сброс как основной путь, если
предусловие его разрешает. Это было неверно: предусловие смотрит теги
stage-ok, а задача, находящаяся в приёмке, тега ещё не имеет, и сброс
сносил её молча. Замок контура закрыл эту дыру только наполовину — он
защищает того, кто занял контур, но не того, чья задача уже принята
и ждёт своего круга в Production.
</reset_is_not_here>
<when_reset>
Сброс делается тогда, когда пользователь решил прибрать beta, и все три
условия выполнены одновременно:

  нет тегов stage-ok, чей коммит не влит в prod;
  нет живых замков stage-busy;
  различие деревьев prod и beta пусто, либо пользователь согласился
  со списком того, что уйдёт.

Первые два проверяются предусловиями блока beta_reset в sma-deploy-stage.
Третье закрывает случай, когда формальных блокировок нет, а содержимое
в beta есть: список печатает skills/_shared/scripts/beta-audit.sh,
и решение по нему принимает пользователь.
</when_reset>
<why_third_condition>
Тег stage-ok и замок отвечают только за задачи, идущие принятым потоком.
Содержимое могло попасть в beta иначе: прямым коммитом, слиянием без
приёмки, откаченной задачей, к которой ещё не решили, возвращаться или нет.
Ни тегов, ни замков у такого содержимого нет, и без третьего условия сброс
унёс бы его, не спросив.
</why_third_condition>
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
<release_lock>
Снять замок Production. Выполняется первым в этом шаге: сверка шага 9
и критерий шага 10 пройдены, контур в конечном состоянии, держать его дольше
нечем оправдать.

git fetch origin tag prod-busy
git tag -l --format='%(contents)' prod-busy     # поле branch — ваша ветка?

git tag -d prod-busy
git push origin :refs/tags/prod-busy

git ls-remote --tags origin 'refs/tags/prod-busy'
Вывод пуст — замок снят.
<if name="замка нет либо он чужой">
Не продолжать закрытие задачи и чужой замок не снимать. Блок
own_lock_missing справочника
skills/_shared/references/contour-lock-cases.md:
прочитать lock-void/&lt;ветка&gt; и показать
пользователю. В Production это означает, что кто-то мог занять контур
поверх вашего развёртывания.
</if>
</release_lock>
<lock_on_rollback>
Развёртывание не прошло и выполняется откат — замок не снимать до конца
фазы 2 блока rollback: контур занят, пока вершина prod и работающий код
не сведены. Порядок там же.
</lock_on_rollback>
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
<keep_branch>
До вопроса об удалении проверить, помечена ли ветка тегом keep:

git ls-remote --tags origin 'refs/tags/keep/&lt;ветка&gt;'

Вывод непустой — ветку не удалять и не предлагать к удалению.
Показать пользователю причину из тела тега:

git fetch origin tag keep/&lt;ветка&gt;
git tag -l --format='%(contents)' keep/&lt;ветка&gt;

Обращение к origin обязательно: тег ставил другой агент, локально
его может не быть, и проверка по локальному списку тегов пройдёт впустую.
<why>
Тег keep означает, что к ветке обращаются напрямую, помимо ствола:
внешние агенты, ссылки в документации, разбор истории. Слияние в prod
такую ветку не закрывает.
</why>
<scope>
Запрет относится только к удалению ветки. Тег stage-ok снимается обычным
порядком блока tag_release: keep удостоверяет надобность ветки,
к допуску отношения не имеет.
</scope>
<who_sets>
Тег keep ставит тот, кому ветка нужна после слияния. Тело тега содержит
причину и того, кто обращается к ветке. Первый носитель —
keep/docs/skills-flow-002, введён 1 сентября 2026.
</who_sets>
</keep_branch>
<ask_user>
Удаление ветки задачи и снятие тега stage-ok — одним вопросом.
Показать: имя ветки, имя тега и коммит, на котором он стоит.
Ветка помечена тегом keep — вопрос об удалении не задавать вовсе,
спросить только про снятие stage-ok и назвать причину, по которой
ветка сохраняется.
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
<a>Слияние PR в prod — всегда, отдельным вопросом до слияния, шаг 7.</a>
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
