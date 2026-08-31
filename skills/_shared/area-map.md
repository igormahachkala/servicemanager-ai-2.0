<!-- Общий файл: sma-deploy-stage и sma-deploy-prod.
     Блоки с contour относятся только к названному контуру.
     Плейсхолдер workdir берётся из блока contour вызвавшего скила. -->

<contents>
  map            пути и области, старшинство правил
  flag           признаки has_migration и needs_rebuild
  area backend   набор проверок и развёртывание
  area frontend
  area agent-runner
  area infra
  area nginx     конфигурация вне compose, сравнение с рабочей
  area scripts
  area skills
  area none
</contents>

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
не попавших ни в один каталог из перечисленных выше. Файл skills/sma-code-delivery/SKILL.md
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
<on contour="stage">
На Stage развёртывание не выполняется: программы там нет, в compose она
не описана. Слияние в beta идёт обычным порядком после проверок.
Вопрос о доставке возникает в sma-deploy-prod, здесь останавливаться не нужно.
</on>
<on contour="production">
Не определено. Где эта программа запущена и запущена ли вообще —
не установлено. Остановиться до слияния в prod и спросить пользователя,
требуется ли доставка и каким способом.
Слияние в prod при этом не запрещено: код в ветке проверен. Запрещено
считать задачу выполненной, не выяснив, доходит ли изменение до места,
где программа работает.
</on>
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
2. Шаг «сверка после развёртывания» своего контура.
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

<note contour="stage">
В docs/ лежат конфигурации доменов Production: api.servicemanagerai.ru
и max.servicemanagerai.ru. Конфигурации доменов Stage там нет, работающая
на сервере в репозитории не отражена. Область nginx на Stage срабатывает
редко и требует уточнения у пользователя, к какому контуру относится файл.
</note>

<propose>
Выдать пользователю готовые команды. Все требуют root, выполняет пользователь.

# 1. сохранить прежнюю конфигурацию
sudo cp &lt;путь к рабочему файлу&gt; &lt;путь&gt;.bak-$(date +%Y%m%d-%H%M%S)

# 2. положить новую
sudo cp &lt;workdir&gt;/docs/&lt;имя файла&gt;.conf &lt;путь к рабочему файлу&gt;
<!-- workdir берётся из блока contour скила: /opt/sma-beta или /opt/sma-prod -->

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
