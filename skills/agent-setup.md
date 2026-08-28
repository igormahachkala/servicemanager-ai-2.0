<skill name="agent-setup">

<purpose>
Подготовка машины к работе с проектом: доступ к серверу по ssh и авторизация
gh для работы с PR. Выполняется один раз для каждой машины и каждого агента.
Без этого skills/deploy-stage.md и skills/deploy-prod.md не работают.

Машины разных разработчиков работают под разными операционными системами.
Команды, зависящие от системы, помечены атрибутом os. Систему определять
командой, а не предполагать.
</purpose>

<server>
<host>194.67.101.37</host>
<user>deploy</user>
<alias>sma</alias>
</server>

<hard_limit>
Агент не может добавить себя сам. Запись в /home/deploy/.ssh/authorized_keys
требует root, которого у агента нет и не должно быть. Порядок всегда такой:
агент генерирует пару ключей и отдаёт публичный, человек с root добавляет его
на сервер.
</hard_limit>

<rule>
Работать под пользователем deploy, не под root. Root оставлен для
администрирования сервера. Права deploy: группа docker, владение каталогами
/opt/sma-prod, /opt/sma-beta и /var/backups/sma, чтение /etc/servicemanager-ai/.
Полный перечень с командами проверки — часть A, блок verify_server.
</rule>

<part id="A" name="состояние сервера">

<principle>
Здесь описано требуемое состояние, а не запись о том, что его когда-то
настроили. Состояние проверяется командой. Утверждение в документе
доказательством не является: сервер могли переставить, пользователя удалить,
права изменить.
</principle>

<when_to_verify>
<case>Подключение новой машины или нового агента — полностью, блок verify_server ниже. Часть B шаг 5 проверяет только доступ, это подмножество.</case>
<case>Отказ во время развёртывания — по таблице diagnostics.</case>
<case name="перед каждым развёртыванием">
Полная проверка не нужна. В prerequisites деплойных skill стоит
ssh -o BatchMode=yes sma 'whoami' — одна команда, доли секунды, доказывает
разом: ключ принят, алиас настроен, сервер доступен, пользователь тот.
Этого достаточно.
</case>
</when_to_verify>

<verify_server>
<v name="пользователь и группа">ssh sma 'id'</v>
<expect>uid=deploy, в списке групп присутствует docker</expect>

<v name="владение каталогами">ssh sma 'stat -c "%n %U:%G" /opt/sma-prod /opt/sma-beta'</v>
<expect>оба каталога принадлежат deploy</expect>

<v name="файлы окружения читаются пользователем deploy">
ssh sma 'test -r /etc/servicemanager-ai/stage-backend-isolated.env'
ssh sma 'test -r /opt/sma-service/backend/.env.docker'
</v>
<expect>код возврата 0 в обеих</expect>
<why>
Файлы читает клиент docker compose под пользователем deploy в момент up,
а не демон. Работающий контейнер держит переменные с прошлого запуска
и потерю доступа не покажет — откажет следующее развёртывание.
Пути подтверждены на сервере 2026-08-28, см. path_note в skills/secrets.md.
</why>

<v name="переменные дошли до контейнеров">
ssh sma 'docker inspect sma_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' | cut -d= -f1 | grep -c DATABASE_URL
ssh sma 'docker inspect sma_stage_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' | cut -d= -f1 | grep -c VAPID_PUBLIC_KEY
</v>
<expect>по единице в каждой команде</expect>
<why>
Две проверки отвечают на разные вопросы. Предыдущая — есть ли у deploy
доступ к файлу сейчас. Эта — дошло ли содержимое файла до контейнера.

Маркер выбирается так, чтобы переменная приходила только из файла.
Установлено 2026-08-28:
  Production — DATABASE_URL. В docker-compose.yml блок environment задаёт
    только CORS_ALLOWED_ORIGINS, оверрайды production.override
    и production.stable.override DATABASE_URL не задают.
  Stage — VAPID_PUBLIC_KEY. DATABASE_URL там маркером не годится:
    docker-compose.stage.yml задаёт его напрямую в environment, и проверка
    вернёт единицу независимо от файла. VAPID_PUBLIC_KEY есть
    в stage-backend-isolated.env и отсутствует и в compose, и в оверрайде.

cut -d= -f1 отрезает значения: в вывод попадают только имена переменных.
</why>
<constraint>
Меняется состав compose или оверрайда — маркер перепроверить. Переменная,
попавшая в environment, перестаёт что-либо доказывать.
</constraint>
<limit>
Работает, пока контейнер запущен. Контейнер остановлен — это не отказ
настройки: пропустить проверку, разбираться с контуром отдельно.
Не отличает свежий файл от устаревшего: переменная есть, а верное ли
в ней значение — не видно.
</limit>

<v name="доступ к docker">ssh sma 'docker ps --format "{{.Names}}" | head -3'</v>
<expect>перечень контейнеров, отказа нет</expect>

<v name="каталог для дампов">ssh sma 'stat -c "%n %U:%G %a" /var/backups/sma'</v>
<expect>/var/backups/sma deploy:deploy 700</expect>
</verify_server>

<diagnostics>
<d symptom="Permission denied (publickey) при подключении">Публичный ключ не добавлен в /home/deploy/.ssh/authorized_keys. Часть B шаг 4.</d>
<d symptom="whoami возвращает не deploy">Алиас sma указывает на другого пользователя. Часть B шаг 2.</d>
<d symptom="отказ docker ps">Пользователь не в группе docker. initial_setup, строка usermod.</d>
<d symptom="permission denied на каталоге развёртывания">Каталог не принадлежит deploy. initial_setup, строка chown.</d>
<d symptom="env file not found при docker compose up">Файл окружения недоступен пользователю deploy. Проверка «файлы окружения читаются» в verify_server, лечение — initial_setup, строки chgrp и chmod. Работающий контейнер этого не покажет: переменные у него с прошлого запуска.</d>
<d symptom="отказ записи в /var/backups/sma при снятии дампа">Каталог не создан либо принадлежит не deploy. initial_setup, строки mkdir, chown, chmod.</d>
<d symptom="Host key verification failed">Ключ хоста не в known_hosts либо изменился. Часть B шаг 3, сверить отпечаток заново.</d>
</diagnostics>

<initial_setup>
<when>Проверка verify_server не прошла либо сервер разворачивается заново.</when>

<by_agent>Ничего. Все команды ниже требуют root.</by_agent>

<by_root>
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh &amp;&amp; chmod 700 /home/deploy/.ssh
chown -R deploy:deploy /home/deploy/.ssh
chown deploy:deploy /opt/sma-prod /opt/sma-beta
chgrp deploy /etc/servicemanager-ai/stage-backend-isolated.env /opt/sma-service/backend/.env.docker
chmod 640 /etc/servicemanager-ai/stage-backend-isolated.env /opt/sma-service/backend/.env.docker
mkdir -p /var/backups/sma
chown deploy:deploy /var/backups/sma
chmod 700 /var/backups/sma
</by_root>
<why_700>
В дампе базы лежат пароли пользователей, ключи push-подписок и персональные
данные. С правами по умолчанию каталог читался бы любым пользователем сервера.
</why_700>

<action>
Выдать пользователю команды и объяснить, какая проверка не прошла.
Дождаться подтверждения, что выполнено, и прогнать verify_server заново.
</action>

<note>
--disabled-password не означает вход без пароля. Поле пароля получает значение,
которому не соответствует ни одна строка, поэтому вход по паролю невозможен.
Остаётся только вход по ключу.
</note>
</initial_setup>

</part>

<part id="B" name="подключение новой машины или нового агента">

<os_note>
Часть B рассчитана на macOS и Linux: пути ~/.ssh, ssh-keygen и ssh-keyscan
на них совпадают. Под Windows команды те же в WSL и в Git Bash; в PowerShell
путь к ключам иной, и порядок надо уточнять отдельно.
Определить систему: uname -s
</os_note>

<step id="1" name="сгенерировать пару ключей">
<command>
ssh-keygen -t ed25519 -f ~/.ssh/sma_deploy -N "" -C "&lt;кто&gt;@sma"
</command>
<constraint>Приватный ключ никуда не передавать и не копировать. Он остаётся на машине.</constraint>
<constraint>Одна машина — одна пара. Ключи между машинами не переиспользовать.</constraint>
<naming>Комментарий -C должен опознавать владельца: claude-deploy@sma, codex-deploy@sma, cursor-deploy@sma.</naming>
</step>

<step id="2" name="добавить алиас">
<action>Дописать в ~/.ssh/config:</action>
<content>
Host sma
  HostName 194.67.101.37
  User deploy
  IdentityFile ~/.ssh/sma_deploy
  IdentitiesOnly yes
</content>
<rationale>
Деплойные skill обращаются к серверу как ssh sma. Адрес, пользователь и путь
к ключу остаются в личной конфигурации машины и в общие файлы не попадают.
</rationale>
</step>

<step id="3" name="доверить хост">
<why>
Без записи в known_hosts ssh откажется подключаться к неизвестному серверу.
Но запись без сверки принимает на веру то, что ответило по адресу. Встань
между вами и сервером посредник — в known_hosts попадёт его ключ, и защита
от подмены перестанет работать навсегда: чужой ключ будет числиться
правильным, предупреждения не будет.
Поэтому отпечаток получают по другому каналу и сверяют.
</why>

<substep id="3.1" name="получить эталонный отпечаток">
<action>
Попросить человека с доступом root выполнить на сервере:

ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub

и передать полученную строку. Канал передачи — любой, кроме этого же
ssh-подключения: смысл сверки в том, что источник независим.
</action>
</substep>

<substep id="3.2" name="снять ключ и сверить">
<command>
ssh-keyscan -t ed25519 194.67.101.37 &gt; /tmp/sma_host_key
ssh-keygen -lf /tmp/sma_host_key
</command>
<expect>Отпечаток совпадает с полученным на шаге 3.1 посимвольно.</expect>
<on_failure>
Не совпал — остановиться, в known_hosts не записывать, сообщить пользователю.
Возможные причины: ключ хоста на сервере переустанавливали, либо соединение
перехвачено. Разбираться до подключения, а не после.
</on_failure>
</substep>

<substep id="3.3" name="записать">
<precondition>Отпечатки совпали.</precondition>
<command>
cat /tmp/sma_host_key &gt;&gt; ~/.ssh/known_hosts
</command>
</substep>
</step>

<step id="4" name="передать публичный ключ">
<command>cat ~/.ssh/sma_deploy.pub</command>
<action>
Показать вывод пользователю. Попросить человека с доступом root выполнить
на сервере:

echo '&lt;строка публичного ключа&gt;' &gt;&gt; /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
</action>
<constraint>ssh-copy-id здесь не работает: у deploy нет пароля, аутентифицироваться для первой записи нечем.</constraint>
</step>

<step id="5" name="проверить доступ">
<command>
ssh -o BatchMode=yes sma 'whoami; id; docker ps --format "{{.Names}}" | head -3'
</command>
<expect>whoami возвращает deploy. В группах присутствует docker. docker ps выводит контейнеры.</expect>
<on_failure>
Permission denied — ключ не добавлен либо добавлен не тому пользователю.
Connection refused или timeout — недоступен порт 22.
Отказ docker ps — пользователь не в группе docker.
</on_failure>
</step>

</part>

<part id="C" name="gh — работа с Pull Request">

<why>
Деплойные skill создают и сливают PR командами gh pr create и gh pr merge.
Без установленного и авторизованного gh поток останавливается на шаге
создания PR.
</why>

<step id="1" name="установить">
<detect_os>
uname -s        # Darwin — macOS, Linux — дальше смотреть дистрибутив
cat /etc/os-release 2&gt;/dev/null | head -2
</detect_os>
<command os="macOS">brew install gh</command>
<command os="Debian, Ubuntu">sudo apt update &amp;&amp; sudo apt install gh</command>
<command os="Fedora, RHEL">sudo dnf install gh</command>
<command os="Arch">sudo pacman -S github-cli</command>
<fallback>
Пакета нет в репозиториях дистрибутива либо система иная —
порядок установки: https://github.com/cli/cli#installation
</fallback>
<check>gh --version</check>
<note>
Машины разработчиков работают под разными системами. Команда установки
выбирается по факту, определённому в detect_os, а не по умолчанию.
</note>
</step>

<step id="2" name="авторизовать">
<command>gh auth login --with-token</command>
<action>
Токен вставить из буфера в приглашение ввода. Не передавать аргументом
командной строки — попадёт в историю.
</action>
<token_requirements>
Fine-grained personal access token на репозиторий igormahachkala/servicemanager-ai-2.0.
Создаётся в GitHub: Settings → Developer settings → Personal access tokens
→ Fine-grained tokens.

Права, все три обязательны:
  Contents: Read and write        — push ветки задачи
  Pull requests: Read and write   — gh pr create, gh pr merge
  Metadata: Read-only             — включается автоматически, снять нельзя

Одного Contents недостаточно: PR — отдельный ресурс со своим разрешением.
С одним Contents вход проходит, ветка пушится, а gh pr create отдаёт 403.
</token_requirements>
</step>

<step id="3" name="проверить">
<command>
gh auth status
gh api repos/igormahachkala/servicemanager-ai-2.0/pulls --jq 'length'
</command>
<expect>
gh auth status: Logged in to github.com.
gh api: число, доступ к ресурсу pulls есть.
</expect>
<rationale>
gh auth status подтверждает только вход. Обращение к ресурсу pulls проверяет
разрешение Pull requests до того, как агент дойдёт до создания PR в потоке
развёртывания. Запрос читающий, ничего не создаёт.
</rationale>
<on_failure>
Not logged in — повторить шаг 2.
403 на gh api pulls — у токена нет права Pull requests: Read and write.
404 — аккаунт не имеет доступа к репозиторию либо токен выдан на другой репозиторий.
403 при push ветки — нет права Contents: Read and write.
</on_failure>
</step>

</part>

<part id="D" name="отзыв доступа к серверу">
<action>
Удалить строку с соответствующим комментарием из
/home/deploy/.ssh/authorized_keys. Выполняет человек с root.
</action>
<rule>
Доступ, выданный под конкретную задачу, отзывается после её закрытия.
Ключи не накапливать.
</rule>
</part>

<verification>
<v name="готовность машины целиком">ssh -o BatchMode=yes sma 'whoami' &amp;&amp; gh auth status</v>
<v name="чьи ключи есть у deploy">ssh sma 'awk "{print \$1, \$3}" ~/.ssh/authorized_keys'</v>
<note>
Состояние сервера проверяется блоком verify_server в части A. Здесь только
то, чего там нет: готовность машины агента целиком и перечень выданных ключей.
Второе печатает тип ключа и комментарий, само значение ключа не выводится.
</note>
</verification>

<forbidden>
<f>Передавать приватный ключ куда-либо.</f>
<f>Переиспользовать одну пару ключей на нескольких машинах.</f>
<f>Работать под root, когда задача выполнима под deploy.</f>
<f>Оставлять ключи закрытых задач в authorized_keys.</f>
<f>Выводить содержимое приватных ключей и файлов с секретами.</f>
<f>Записывать ключ хоста в known_hosts без сверки отпечатка по независимому каналу.</f>
</forbidden>

<ask_user>
<a>Добавление или удаление ключей — требует root.</a>
<a>Изменение прав на файлы и каталоги сервера.</a>
<a>Любое действие под root.</a>
</ask_user>

<related>
<r file="skills/deploy-stage.md">развёртывание на Stage</r>
<r file="skills/deploy-prod.md">развёртывание в Production</r>
</related>

</skill>
