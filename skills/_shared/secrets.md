<!-- Общий файл: sma-deploy-stage, sma-deploy-prod, sma-agent-setup. -->

<purpose>
Обращение с секретами и переменными окружения на сервере. Один источник
для sma-deploy-stage и sma-deploy-prod. Читать до первой команды,
затрагивающей сервер.
</purpose>

<secrets>
<rule>Значения секретов не выводить. Показывать только имена переменных и признак: задано, пусто, длина в символах.</rule>
<rule>Файлы .env, *.env, .env.docker целиком не открывать без прямого запроса пользователя.</rule>
<rule>При чтении конфигов, где секреты идут вперемешку со структурой, маскировать значения до попадания в вывод.</rule>
<rationale>
Ограничение прав защитой не является: deploy состоит в группе docker, что
равносильно root — участник монтирует любой каталог хоста в контейнер
и читает что угодно. Граница поведенческая. Всё напечатанное попадает
в переписку и логи: показанный один раз секрет считается раскрытым.
</rationale>
<example name="имена переменных без значений">
ssh sma 'docker inspect &lt;контейнер&gt; --format "{{range .Config.Env}}{{println .}}{{end}}"' | cut -d= -f1
</example>
<example name="признак заполненности без значения">
ssh sma 'docker inspect &lt;контейнер&gt; --format "{{range .Config.Env}}{{println .}}{{end}}"' \
  | awk -F= '{ print $1, (length($2) ? "задано, " length($2) " симв." : "пусто") }'
</example>
<full_output_forbidden>
docker compose config без -q печатает значения всех переменных. Применять
только с -q. Полный вывод не показывать ни пользователю, ни в отчёт.
</full_output_forbidden>
</secrets>

<env_changes>
<rule>Значения переменных окружения агент не изменяет. Файлы принадлежат root, у deploy только чтение.</rule>
<action>
При необходимости изменить или добавить переменную выдать пользователю: имя,
контур, файл, где взять значение, команду редактирования через редактор,
команду применения, команду проверки заполненности.
</action>
<files contour="stage">
/etc/servicemanager-ai/stage-backend-isolated.env
/etc/servicemanager-ai/docker-compose.stage.override.yml — если переменная задана в нём напрямую
</files>
<files contour="production">
/opt/sma-service/backend/.env.docker
/etc/servicemanager-ai/docker-compose.production.stable.override.yml — если переменная задана в нём напрямую
</files>
<path_note contour="production">
Путь к файлу окружения задан директивой env_file: !override в
/etc/servicemanager-ai/docker-compose.production.stable.override.yml
абсолютным значением. Относительный путь ./backend/.env.docker из базового
docker-compose.yml не применяется: !override заменяет список целиком,
а не дополняет его.
Канонический файл окружения Production лежит вне worktree развёртывания:
/opt/sma-service/backend/.env.docker. Файл /opt/sma-prod/backend/.env.docker
не является каноническим источником и не должен создаваться для деплоя.
Каталог /opt/sma-service — действующая зависимость Production: там же
смонтированы загруженные пользователями файлы, /opt/sma-service/uploads.
</path_note>
<apply>Переменные подхватываются при пересоздании контейнера. Перезапуска недостаточно.</apply>
<forbidden>
<f>Вписывать значение в файл.</f>
<f>Печатать значение в выводе или отчёте.</f>
<f>Передавать значение аргументом команды — попадёт в историю.</f>
<f>Создавать .env в каталоге развёртывания.</f>
</forbidden>
</env_changes>

<ask_user>
<a>Любое изменение переменной окружения на сервере.</a>
<a>Необходимость открыть файл с секретами целиком.</a>
</ask_user>

<related>
<r file="sma-deploy-stage">развёртывание на Stage</r>
<r file="sma-deploy-prod">развёртывание в Production</r>
</related>
