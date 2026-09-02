---
name: sma-deploy-stage
description: "Развёртывание на контур Stage: проверки на результате слияния, PR в ветку beta, выкладка на сервер, приёмка и тег stage-ok. Обязательно применять, когда пользователь просит выкатить, задеплоить, развернуть, проверить изменение на Stage или beta, а также когда работа в ветке закончена и её надо довести до контура. Применять и тогда, когда контур не назван: любая доставка кода начинается со Stage, ускоренного маршрута в Production нет. Скилл работает с живым сервером по ssh. Требует настроенной машины, это sma-agent-setup. Следующий шаг после тега stage-ok, это sma-deploy-prod."
---

<purpose>
Проверки, PR в beta, развёртывание на Stage, приёмка. Заканчивается тегом
stage-ok, который допускает задачу к sma-deploy-prod.
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

<ref file="skills/_shared/precedence.md">Приоритет над документацией. Прочитать до начала работы.</ref>

<ref file="skills/_shared/execution-context.md">Где выполняется команда: машина агента или сервер. Прочитать до первой команды.</ref>

<ref file="skills/_shared/contour-lock.md">Замок контура: проверка, постановка, снятие. Прочитать до шага 7, он занимает контур.</ref>

<ref file="skills/_shared/prerequisites.md">Условия допуска к работе. Прочитать и выполнить до шага 0. Пункты с contour="stage" относятся к этому скилу.</ref>
<ref file="skills/_shared/secrets.md">Обращение с секретами и переменными окружения. Прочитать до первой команды, затрагивающей сервер: этого требует блок prerequisites.</ref>

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
см. branch_status в sma-code-delivery. Запрет на прямой push
относится к коду задач, здесь в beta добавляется только код,
уже работающий в Production.
</allowed_exception>
<rationale>
После релиза в beta нет коммита слияния, ушедшего в prod. Без восстановления
проверка пойдёт на базе без последней выложенной задачи.
</rationale>
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
<carry>Области и флаги переносятся в шаги 5 и 8.</carry>
</step>
<ref file="skills/_shared/areas/nginx.md">Область nginx: конфигурация вне compose, сравнение с рабочей, порядок применения. Читать, только если скрипт вернул nginx.</ref>
<ref file="skills/_shared/areas/agent-runner.md">Область agent-runner: порядок доставки не определён. Читать, только если скрипт вернул agent-runner.</ref>
<ref file="skills/_shared/areas/skills.md">Область skills: требования к телу PR. Читать, только если скрипт вернул skills.</ref>
<ref file="skills/_shared/areas/scripts.md">Область scripts: проверка синтаксиса. Читать, только если скрипт вернул scripts.</ref>

<step id="2" name="опубликовать ветку">
<command>git push -u origin &lt;ветка&gt;</command>
<expect>push принят, ветка есть в origin.</expect>
<on_failure>
Отказ по правам — проверить токен, sma-agent-setup часть C.
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
<ref file="skills/_shared/merge-checks.md">Наборы проверок, локальных и на сервере. Прочитать целиком перед выполнением. Команды приведены готовыми строками для каждого контура: брать блок contour="stage".</ref>
</step>

<step id="6" name="проверить каталог и конфигурацию контура">
<applies_if>
Шаг выполняется, только если задета область, требующая подъёма контейнеров:
backend, frontend, infra. Для областей none, scripts, skills, nginx
пропускается — то же условие, что в блоке skip_deploy шага 8.
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
<why_before_merge>
Окружение проверяется до слияния PR. Слияние необратимо, а отказ этой
проверки означает, что разворачивать некуда: контур поднят из другого
каталога или другим набором файлов. Тот же порядок в sma-deploy-prod.
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

<step id="7" name="занять контур и слить PR">
<order>
Три действия подряд, порядок обязателен: проверить чужой замок, поставить
свой, слить PR. Механизм — skills/_shared/contour-lock.md.
</order>
<why_before_merge>
Замок ставится до слияния, а не перед развёртыванием. Слияние уже меняет
beta: агент, занявший контур после чужого слияния, разворачивает чужой код
вместе со своим и не знает об этом.
</why_before_merge>
<run script="skills/_shared/scripts/lock-acquire.sh">
skills/_shared/scripts/lock-acquire.sh stage &lt;ветка задачи&gt; &lt;номер PR&gt;
</run>
<what_it_does>
Скрипт вычищает локальные теги, проверяет занятость контура по origin
и ставит замок. Слияние он не делает: это отдельный вызов ниже.
Занятый чужим контур он разбирает сам — печатает тело замка, возраст,
превышен ли порог 4 часа, есть ли ветка владельца в origin, его PR
и что развёрнуто на контуре.
</what_it_does>
<codes>
  0  контур ваш: замок поставлен либо уже стоял и ветка в нём ваша,
     идти к слиянию
  1  контур занят другим агентом: разбор напечатан, показать его
     пользователю и остановиться. Чужой замок не снимать, блок foreign_lock;
     снятие по команде пользователя выполняется блоком lock_void
  2  неверные аргументы
  3  git не отработал
  5  контур заняли между проверкой и постановкой: свой локальный тег скрипт
     удалил сам, повторить позже
</codes>
<constraint name="проверка и слияние — разные вызовы">
Не объединять вызов скрипта и слияние в одну цепочку команд. Слияние
выполняется после того, как скрипт вернул 0 и этот код разобран.
Склеенные в один вызов, они выполняются подряд, и ненулевой код скрипта
слиянию не помешает.
</constraint>
<manual>
Тот же порядок вручную, если скрипт недоступен: блоки check, read
и acquire общего файла skills/_shared/contour-lock.md.
</manual>
<command>
skills/_shared/scripts/lock-acquire.sh --owned stage &lt;ветка&gt; \
  &amp;&amp; gh pr merge &lt;номер&gt; --merge --delete-branch=false
</command>
<why_one_command>
Слияние записано вместе с проверкой владения замком, через &amp;&amp;, и это
обязательно. Правая часть запускается, только если левая вернула ноль,
поэтому при чужом замке либо при отсутствии своего gh pr merge не запустится
вовсе. Отдельной строкой слияние не писать: тогда оно выполнится независимо
от результата проверки, и контур будет слит вслепую.
Проверка отвечает нулём только на один случай — замок стоит и ветка в нём
ваша. Отсутствие замка тоже блокирует слияние: значит контур вами не занят,
и другой агент может занять его прямо сейчас.
</why_one_command>
<constraint>Ветку не удалять: она понадобится для PR в prod.</constraint>
<on_failure>
Отказ с указанием, что ветка устарела — целевая ушла вперёд. Повторить
с шага 4. Замок при этом снять: контур занят, а слияния не было, и повтор
начнётся с проверки шага 7 заново.
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
ssh sma 'cd /opt/sma-beta &amp;&amp; test -z "$(git status --porcelain)"'
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch --prune --prune-tags origin'
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
ssh sma 'cd /opt/sma-beta &amp;&amp; git fetch --prune --prune-tags origin'
ssh sma 'cd /opt/sma-beta &amp;&amp; git checkout beta'
ssh sma 'cd /opt/sma-beta &amp;&amp; git pull --ff-only'
</command>
<why_separate>
Проверку нельзя ставить звеном цепочки через &amp;&amp;: git status возвращает 0
и при грязной копии, цепочка пойдёт дальше. Останавливает только команда,
дающая ненулевой код, — test -z по выводу git status --porcelain.
</why_separate>
<why_prune_tags>
Флаги --prune --prune-tags обязательны. Замки — теги фиксированного имени,
они появляются и снимаются постоянно; снятый в origin тег локально остаётся
и мешает следующему: имя ссылки не может быть префиксом другого имени.
Отказ вида 'refs/tags/stage-busy/&lt;что-то&gt;' exists; cannot create
'refs/tags/stage-busy' валит fetch целиком, за ним не проходит pull,
и каталог остаётся на прежнем коммите. Разбор — блок stale_local_tags
общего файла.

Отдельно, и это не ошибка: строка
'! [rejected] stage-busy -&gt; stage-busy (would clobber existing tag)'.
Она означает, что локальная копия замка разошлась с origin по объекту.
Отклонён только тег замка, ветки обновлены, git pull следом проходит.
Код возврата у fetch при этом 1 — тот же, что при отказе выше, поэтому
различать надо по выводу, а не по коду. Не останавливаться, разбор — блок
clobber_not_error общего файла.

Отсюда же требование к командам ниже: fetch, checkout и pull выполняются
отдельными вызовами. Связать их через &amp;&amp; нельзя — код 1 от fetch оборвал бы
цепочку до pull, и каталог остался бы на прежнем коммите.
</why_prune_tags>
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
и отличить одно от другого агент не сможет.
<covered_now>
Одновременное развёртывание двух агентов закрыто замком контура, шаг 7
и skills/_shared/contour-lock.md: пока замок стоит, второй агент до слияния
не доходит.
</covered_now>
<remains>
Чужой код, приехавший на контур до того, как вы заняли его замком, остаётся
рядом с вашим. Замок разделяет агентов во времени, а не откатывает beta
к чистому состоянию. Полностью снимается сбросом beta перед занятием контура,
что означало бы сброс на каждую задачу — не делается намеренно.
Пункт P-06 бэклога.
</remains>
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
<on_failure>
Не ставить тег, сообщить пользователю.
<lock>
Замок stage-busy не снимать. Контур остался в незавершённом состоянии:
код задачи слит в beta шагом 7 и развёрнут, а прошёл он или нет — неизвестно.
Пустить следующего агента сюда нельзя.
</lock>
<what_ends_it>
Разбор заканчивается одним из трёх: развёртывание повторено и сверка прошла —
идти дальше по шагам; задача исправляется — повтор с шага 2, замок при этом
разбирается по шагу 11, вопрос пользователю; задача отменяется — снятие замка
и разбор beta решает пользователь, сам агент замок не снимает.
</what_ends_it>
<why_say_it>
Иначе агент останавливается, замок висит, и через четыре часа он попадает
под порог блока classify как «похоже на брошенный» — у следующего агента
не будет способа отличить это от настоящей потери владельца.
</why_say_it>
</on_failure>
</step>

<step id="11" name="приёмка">
<precondition if="задета область nginx">
Команды применения конфигурации nginx выполнены пользователем, блок propose
области nginx. До этого проверяемое поведение недостижимо: контейнеры уже
на новом коде, а маршрутизация — на прежней конфигурации.
Не объявлять приёмку, ждать подтверждения пользователя.
</precondition>
<action>Проверить критерий, зафиксированный в sma-code-delivery шаг 1.</action>
<reference file="docs/11_RUNTIME_ACCEPTANCE.md">протокол приёмки</reference>
<expect>Критерий выполнен.</expect>
<on_failure>
Не ставить тег. Исправлять в ветке задачи, повторить с шага 2.
Не с шага 4: PR слит на шаге 7, дослать в него коммит нельзя. Precheck
шага 3 обнаружит отсутствие открытого PR и создаст новый, ветка та же.
Замок stage-busy самостоятельно не снимать и не удерживать: спросить
пользователя. Показать ветку из тела замка, что именно не прошло в приёмке,
и два исхода — снять замок либо удержать до исправления.
<default>
Правило очереди: не получилось — освобождаем контур и встаём в очередь
заново. Это умолчание, которое предлагается пользователю первым.
</default>
<why_ask>
Исправление бывает срочным, и тогда ждать своей очереди дороже, чем держать
контур занятым. Отличить срочное от обычного агент не может, решает
пользователь.
</why_ask>
<if name="замок удержан">
Повторный проход шага 7 увидит замок и сверит поле branch его тела:
своё продолжать, чужое разбирать по foreign_lock.
</if>
<if name="замок снят">
Повторный проход шага 7 занимает контур заново обычным порядком и может
получить отказ: за это время контур мог занять другой агент.
</if>
Слияние из beta не убирать. Ревёрт применяется, когда контур сломан,
а здесь не выполнен критерий: в beta остаётся рабочий код, исправление
приезжает вторым слиянием той же ветки.
</on_failure>
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
Три коммита: вершина ветки B, слияние с beta M, слияние с prod. Приёмка
идёт на M, но M в prod не попадает никогда. Общий объект всех трёх
состояний — только B, поэтому тег на B, а M пишется в тело тега.

Тег на B работает в обе стороны: новый коммит в ветке — тег остался
на старом, sma-deploy-prod обнаружит. Ветка ушла в prod — B стал предком
prod, тег не блокирует сброс beta.
</rationale>
<on_failure>
Тег stage-ok/&lt;ветка&gt; уже существует — это повторная приёмка после исправлений.
Переставить: git tag -f -a stage-ok/&lt;ветка&gt; ... и git push --force origin stage-ok/&lt;ветка&gt;.
Перестановка допустима только на вершину той же ветки задачи.
</on_failure>
<release_lock>
После того как stage-ok отправлен в origin, снять замок. Перед снятием
сверить, что замок ваш: имя общее, принадлежность видна только из тела.

git fetch origin tag stage-busy
git tag -l --format='%(contents)' stage-busy     # поле branch — ваша ветка?

git tag -d stage-busy
git push origin :refs/tags/stage-busy
</release_lock>
<if name="замка нет либо он чужой">
Не продолжать и чужой замок не снимать. Своего замка нет: его мог снять
другой агент по решению пользователя, а контур занять третий.
Блок own_lock_missing общего файла: прочитать lock-void/&lt;ветка&gt;
и показать пользователю.
</if>
<release_order>
Порядок обратить нельзя. Замок, снятый до постановки stage-ok, пускает
следующего агента на контур в тот промежуток, когда приёмка пройдена,
а признака этого ещё нет: его сброс beta снесёт вашу задачу молча.
</release_order>
<verify>
git ls-remote --tags origin 'refs/tags/stage-busy'
Вывод пуст — замок снят.
</verify>
</step>

<step id="13" name="завершение">
<action>
Задача допущена к Production. Сообщить пользователю: критерий, ветка, тег,
что дальше идёт sma-deploy-prod. Самому его не начинать.
</action>
<gate>
Переход в Production выполняется только по явной команде пользователя.
Тег stage-ok — допуск, а не разрешение катить. Молчание, «ок» на отчёт
и отсутствие возражений командой не являются.
</gate>
<if_skill_missing>
Скилл недоступен — файла нет либо он не читается. Остановиться и сообщить
пользователю. Разворачивать в Production без скила запрещено: ни по памяти,
ни по документации, ни по старым файлам в skills/ вне каталогов скилов.
Причина запрета в том, что ворота допуска, бэкап перед миграциями и порядок
отката заданы только скилом. Без него они не выполняются, а отказ проявится
на работающем Production.
</if_skill_missing>
</step>

<beta_reset>
<when>После развёртывания prod в Production.</when>
<when name="после отката">
В Production откатили задачу и к ней в этом виде не возвращаются:
ревёрт лежит в prod, а в beta слияние ветки осталось, и код задачи там
на месте. Сброс убирает его. Правило и разбор по случаям — блок
beta_after_rollback в skills/sma-deploy-prod/references/rollback.md.
К задаче возвращаемся — сброс не делать, код в beta нужен для исправления.
</when>
<why>
beta накапливает и доехавшее до Production, и отброшенное. Проверка на базе,
которой в Production нет, смысла не имеет. Незавершённые задачи лежат
в своих ветках и не теряются.
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
в sma-deploy-prod шаг 12. Теги откаченных задач переименованы
в reverted/&lt;ветка&gt; блоком tag_void там же.
</precondition>
<rationale>
До слияния в prod вершина ветки предком prod не является: тег попадает
в список БЛОКИРУЕТ, сброс запрещён. После слияния блокировать перестаёт.
Иначе сброс убрал бы из beta чужую принятую задачу, а её тег удостоверял бы
проверку на состоянии, которого на контуре нет.
</rationale>
<precondition fail="ask_user" name="живых замков нет">
test -z "$(git ls-remote --tags origin 'refs/tags/stage-busy')"

Код 0 — сброс разрешён, ненулевой запрещает. Непустой вывод запрещает сброс, независимо
от того, чей это замок и свой ли он.
<why>
Замок означает, что задача на контуре в работе, а тега stage-ok у неё
ещё нет: предусловие по тегам её не видит и пропустит сброс, который
снесёт её молча. Это и есть пробел, ради которого замок вводился.
Свой замок тоже запрещает: сброс во время собственной приёмки убирает
из beta код, который сейчас проверяется.
</why>
<on_failure>
Не сбрасывать. Разобрать замок блоком classify общего файла и показать
пользователю. Чужой замок не снимать, блок foreign_lock.
</on_failure>
</precondition>
<report fail="показать пользователю">
До сброса запустить отчёт и показать вывод пользователю целиком:

skills/_shared/scripts/beta-audit.sh

Коды возврата:
  0  содержимого сверх prod нет, сбрасывать нечего
  1  содержимое есть, отчёт перечислил ветки и их признаки
  2  неверные аргументы
  3  git не отработал
  4  gh недоступен либо не авторизован, сведения о PR недостоверны

<why>
Предусловия выше отвечают «можно ли», отчёт — «что при этом уйдёт». Список
веток с признаками нужен пользователю до решения: скрипт не судит, вернётся
ли человек к задаче, он только печатает.
</why>
<constraint>
Код 1 сбросу не препятствует и запретом не является: он означает, что
в beta есть содержимое сверх prod, ради чего сброс и делается. Запрещают
предусловия выше — блокирующие теги stage-ok и живые замки.
</constraint>
<if name="код 4">
Часть отчёта про открытые PR недостоверна. Не решать по неполным данным:
разобраться с gh, sma-agent-setup часть C, и повторить.
</if>
</report>
<precondition fail="ask_user" name="различие деревьев">
git diff --name-only origin/prod origin/beta

Вывод пуст — сбрасывать нечего, сброс безвреден и разрешён.
Вывод непуст — показать пользователю отчёт beta-audit.sh целиком и получить
согласие на то, что перечисленное уйдёт. Без согласия не сбрасывать.
<why>
Первые два предусловия отвечают за задачи, идущие принятым потоком: у них
есть тег stage-ok либо замок. Содержимое могло попасть в beta и иначе —
прямым коммитом, слиянием без приёмки, откаченной задачей, по которой ещё
не решили, возвращаться или нет. Ни тега, ни замка у такого содержимого
нет, и без этого предусловия сброс унёс бы его молча.
</why>
</precondition>
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
см. branch_status в sma-code-delivery. Через PR force push не делается.
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
в skills/_shared/secrets.md. Файл общий для обоих контуров, читается до первой
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
<r skill="sma-agent-setup" file="skills/sma-agent-setup/SKILL.md">подготовка машины: ssh и gh</r>
<r file="skills/_shared/secrets.md">переменные окружения и секреты, обязательно</r>
<r skill="sma-code-delivery" file="skills/sma-code-delivery/SKILL.md">ветвление и работа над задачей</r>
<r skill="sma-deploy-prod" file="skills/sma-deploy-prod/SKILL.md">развёртывание в Production</r>
</related>
