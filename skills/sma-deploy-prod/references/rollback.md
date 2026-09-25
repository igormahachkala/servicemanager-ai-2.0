<!-- Откат развёртывания в Production. Читается из sma-deploy-prod
     по ссылке шага, только когда откат нужен. -->

<contents>
  warn                 ошибка в Production чинится fix/&lt;тема&gt;;
                       реверт ветки prod агент сам не начинает
  phase 1              откатить контейнеры на точку; ветку prod не реверит
  after_phase1         дальше fix/&lt;тема&gt;; prod-busy держится до её
                       развёртывания
  beta_after_rollback  ревёрт из beta — по решению пользователя, не
                       следствие фазы 1
  decision             что дальше с задачей
  fix                  ветка fix/&lt;тема&gt; и возврат в Production
  rework               переделка с опорой на код задачи
  abandon              отказ от кода задачи
  explicit_prod_revert реверт и unrevert в prod — только после явной
                       команды пользователя
  tag_void             перенос stage-ok в reverted делает откат из beta
</contents>

<warn when="речь о реверте в prod или читают этот откат">
Ошибка, уже попавшая в Production, исправляется веткой fix/&lt;тема&gt;
от origin/prod и PR в prod. Ревёрт слияния в prod агент не начинает.
После ревёрта чужая правка тех же файлов даёт конфликт на unrevert.
Реверт в prod выполняется только если пользователь явно это сказал.
</warn>

<rollback>
<when>Сверка после развёртывания не прошла либо задача сломала Production.</when>

<phase id="1" name="вернуть работу пользователям">
<constraint>Выполняется первым. Разбор с веткой ждёт, пользователи нет.</constraint>
<command>
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout &lt;записанная точка отката&gt;'
ssh sma 'cd /opt/sma-prod &amp;&amp; RELEASE_SHA=$(git rev-parse HEAD) &amp;&amp; SMA_RELEASE_ENFORCE=true SMA_RELEASE_COMMIT_SHA="$RELEASE_SHA" SMA_RELEASE_ENVIRONMENT=prod docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml build --build-arg SMA_RELEASE_ENFORCE=true --build-arg SMA_RELEASE_COMMIT_SHA="$RELEASE_SHA" --build-arg SMA_RELEASE_ENVIRONMENT=prod &lt;сервисы&gt;'
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml up -d --no-deps backend web'
</command>
<state>
Каталог /opt/sma-prod переведён в отсоединённое состояние: он на коммите
точки отката, а не на ветке. Ветка prod этой фазой не реверится: вершина
origin/prod по-прежнему содержит слияние с ошибкой. Каталог на prod
не переключать, пока не развёрнута fix-ветка: иначе подтянется сломанный
код. Отсоединённое состояние допустимо до развёртывания fix/&lt;тема&gt;.
</state>
<invariant>
В покое совпадают три вещи: HEAD в /opt/sma-prod, вершина origin/prod,
код в работающих контейнерах. После фазы 1 инвариант намеренно нарушен:
контейнеры на точке отката, origin/prod ещё со слиянием. Восстанавливает
развёртывание fix/&lt;тема&gt;.
</invariant>
<check name="контейнеры на точке отката">
ssh sma 'cd /opt/sma-prod &amp;&amp; test "$(git rev-parse HEAD)" = "&lt;записанная точка отката&gt;"'
curl -o /dev/null -w "%{http_code}" https://servicemanagerai.ru/ → 200
curl -o /dev/null -w "%{http_code}" https://api.servicemanagerai.ru/health → 200
</check>
</phase>

<after_phase1>
<rule>
Ошибка чинится веткой fix/&lt;тема&gt; от origin/prod. Обычный путь отката
не реверит ветку prod и не открывает PR revert/… или unrevert/….
</rule>
<lock>
prod-busy НЕ снимать до развёртывания этой fix-ветки. Снимает шаг 12
sma-deploy-prod, когда fix уже в origin/prod и развёрнута. Пока fix
не развёрнута, в origin/prod остаётся слияние с ошибкой: замок сообщает
следующему агенту, что контур занят.
</lock>
<beta>
Если пользователь отдельно велел убрать фичу из beta — ревёрт из beta
по sma-deploy-stage, skills/sma-deploy-stage/references/rollback.md.
stage-busy снимается своим путём. prod-busy от ревёрта из beta
не снимается.
</beta>
</after_phase1>

<beta_after_rollback>
<fact>
Откат контейнеров фазой 1 сам по себе beta не трогает. Слияние ветки
в beta на месте. Убирать его из beta — решение пользователя, не
обязательное следствие фазы 1 и не следствие ревёрта ветки prod
(ревёрта в обычном пути нет).
</fact>
<rule>
Пользователь велел убрать фичу из beta — ревёрт слияния по
skills/sma-deploy-stage/references/rollback.md. stage-ok переносится
в reverted блоком tag_void там же. stage-busy снимается путём 2
блока release_paths в skills/_shared/contour-lock.md. prod-busy
при этом не снимать.
</rule>
<why_not_reset>
Сброс beta = prod здесь не применяется: стоит stage-busy либо
prod-busy, предусловие beta_reset их запрещает. Ревёрт убирает одно
слияние и не требует снимать замок заранее.
</why_not_reset>
</beta_after_rollback>

<decision after="фаза 1">
<question>Что делать с задачей дальше. Решает пользователь. К этому
моменту контейнеры на точке отката, prod-busy стоит, ветка prod
не ревертнута.</question>
<case id="1" name="чиним">Блок fix. Ветка fix/&lt;тема&gt; от origin/prod,
затем sma-deploy-stage и PR этой ветки в prod.</case>
<case id="2" name="переделываем с опорой на код задачи">Блок rework.
Новая ветка от origin/prod, работа заново.</case>
<case id="3" name="отказываемся от кода задачи">Блок abandon. Код
в prod через unrevert не возвращается. Что делать с вершиной prod
и с beta — отдельно решает пользователь.</case>
<ask_user>Выбор случая. Самостоятельно не принимать.</ask_user>
</decision>

<fix case="1">
<precondition>Фаза 1 выполнена. Пользователи работают на точке отката.</precondition>
<action>
git fetch origin
git switch -c fix/&lt;тема&gt; origin/prod

Исправление коммитами в fix/&lt;тема&gt;. Дальше обычный sma-deploy-stage
целиком: проверки, PR в beta, развёртывание, приёмка, тег stage-ok
на эту fix-ветку. Затем PR этой fix-ветки в prod по sma-deploy-prod.
</action>
<lock>
prod-busy остаётся до шага 12 sma-deploy-prod после развёртывания fix.
Замок Stage для fix ставится и снимается своим кругом sma-deploy-stage
и шагом 12 sma-deploy-prod.
</lock>
<why>
Ветка от origin/prod уже содержит слияние с ошибкой. Fix правит его
поверх. Ревёрт слияния в prod для этого не нужен.
</why>
</fix>

<rework case="2">
<when>Решено переделать задачу по существу, но код ветки нужен как основа.</when>
<action>
Блок fix не применяется как единственный путь. Новая ветка от
origin/prod, нужные коммиты переносятся туда, дальше работа заново
и полный круг Stage → Production. Исходная ветка закрывается, но
не удаляется.
</action>
<lock>prod-busy держится, пока новая ветка не развёрнута в Production
либо пользователь явно иначе решил.</lock>
<beta>Код исходной ветки в beta убирается только если пользователь
это велел, блок beta_after_rollback.</beta>
</rework>

<abandon case="3">
<when>От кода задачи отказались: задача откладывается либо решается иначе с нуля.</when>
<action>
Unrevert в prod не выполняется. Ревёрт ветки prod обычным путём
не делается. Вершина origin/prod по-прежнему содержит слияние:
что с ним делать (оставить, явно ревертнуть, перекрыть другой веткой) —
решает пользователь. Фаза 1 остаётся конечным состоянием контейнеров,
пока не решено иначе.
</action>
<branch>
Ветку задачи не удалять. Пока не решено окончательно, что код не понадобится,
удаление означает потерю работы. Задача возвращается в бэклог с записью,
что попытка была и чем закончилась.
</branch>
<lock>
prod-busy не снимать, пока в origin/prod остаётся слияние с ошибкой
и пользователь не принял другое конечное состояние контура.
</lock>
<beta>Код задачи убирается из beta только по отдельному решению
пользователя, блок beta_after_rollback.</beta>
</abandon>

<explicit_prod_revert>
<when>
Только после явной команды пользователя на реверт в Production.
Обычный откат сюда не заходит. То, что откат Stage делается ревёртом,
эту команду не заменяет.
</when>
<warn>
Ошибка, уже попавшая в Production, обычно чинится fix/&lt;тема&gt;.
После ревёрта чужая правка тех же файлов даёт конфликт на unrevert.
Читать этот блок — не начинать реверт самому: нужна явная команда.
</warn>

<revert>
<command>
git fetch origin
git switch -c revert/&lt;тема&gt; origin/prod
git revert -m 1 &lt;SHA слияния в prod&gt; --no-edit
git push -u origin revert/&lt;тема&gt;
gh pr create --base prod --head revert/&lt;тема&gt; --title "revert: &lt;тема&gt;"
</command>
<after>
gh pr merge &lt;номер revert-PR&gt; --merge --delete-branch=false
ssh sma 'cd /opt/sma-prod &amp;&amp; git checkout prod &amp;&amp; git pull --ff-only'
</after>
<record>
Записать SHA revert-коммита рядом с точкой отката. Без него unrevert
не найдёт, что отменять.
</record>
</revert>

<unrevert>
<when>
Пользователь явно велел вернуть код после ревёрта в prod, и этот
реверт уже есть в истории.
</when>
<command>
git fetch origin
git switch -c unrevert/&lt;тема&gt; origin/prod
git revert &lt;SHA коммита ревёрта в prod&gt; --no-edit
git push -u origin unrevert/&lt;тема&gt;
gh pr create --base prod --head unrevert/&lt;тема&gt; --title "unrevert: &lt;тема&gt;"
</command>
<order>
Сначала PR unrevert/&lt;тема&gt;, затем PR исходной ветки или fix/&lt;тема&gt;,
когда на ней есть коммиты сверх того, что вернул unrevert. Оба PR
готовить заранее, сливать подряд. Развёртывание между двумя слияниями
запрещено.
</order>
</unrevert>
</explicit_prod_revert>

<tag_void>
<when>После ревёрта из beta, всегда. Делает блок tag_void файла
skills/sma-deploy-stage/references/rollback.md. Здесь не дублировать.
</when>
<why>
От тега зависят два механизма, оба сработают неверно, если его оставить.
Ворота допуска шага 0: ветка не менялась, Stage не откатывали, три сверки
пройдут — допуск останется действующим для кода, от которого отказались.
Сброс beta: перебор блокируется, пока тег не вошёл в prod, а заброшенный код
туда не попадёт никогда — блокировка станет вечной.
</why>
</tag_void>

<constraint>
Откат кода не откатывает базу. Если применялась миграция с удалением данных,
восстановление только из бэкапа. База впереди кода — состояние безопасное,
код впереди базы — опасное.
</constraint>
<forbidden>
<f>Начинать реверт или unrevert ветки prod без явной команды пользователя.</f>
<f>Снимать prod-busy до развёртывания fix/&lt;тема&gt; (или иного конечного
состояния, которое принял пользователь).</f>
<f>Снимать prod-busy только потому, что фичу убрали из beta.</f>
<f>Переключать /opt/sma-prod на ветку prod после фазы 1, пока там ещё
слияние с ошибкой и fix не развёрнута.</f>
<f>Подставлять служебные ветки revert/… или unrevert/… в PR в prod
как head фичи.</f>
<f>Удалять ветку задачи, пока ошибка в Production не закрыта fix-веткой
либо пользователь не отказался от задачи окончательно.</f>
<f>Оставлять тег stage-ok после ревёрта из beta. Он сохранит действующий
допуск для кода, которого в prod нет, и заблокирует сброс beta навсегда.</f>
</forbidden>
</rollback>
