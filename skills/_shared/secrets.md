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
<example name="имена переменных без значений" contour="stage">
ssh sma-spare 'docker inspect sma_stage_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' | cut -d= -f1
</example>
<example name="имена переменных без значений" contour="production">
ssh sma 'docker inspect sma_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' | cut -d= -f1
</example>
<example name="признак заполненности без значения" contour="stage">
ssh sma-spare 'docker inspect sma_stage_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' \
  | awk -F= '{ print $1, (length($2) ? "задано, " length($2) " симв." : "пусто") }'
</example>
<example name="признак заполненности без значения" contour="production">
ssh sma 'docker inspect sma_backend --format "{{range .Config.Env}}{{println .}}{{end}}"' \
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
Пути на Stage-машине, читать через ssh sma-spare:
/opt/sma-beta/.env
/etc/servicemanager-ai/docker-compose.stage.override.yml — сертификат, порты и аргумент сборки. Runtime-переменных в нём нет.
</files>
<files contour="production">
Пути на Production-машине, читать через ssh sma:
/opt/sma-prod/.env
/etc/servicemanager-ai/docker-compose.production.override.yml — если переменная задана в нём напрямую
</files>
<path_note contour="production">
Канонический файл окружения Production — /opt/sma-prod/.env, рядом с каталогом развёртывания.
В compose у сервисов стоит env_file: .env. Оверрайд может заменить список
директивой env_file: !override абсолютным путём /opt/sma-prod/.env.
Каталог /opt/sma-service остаётся зависимостью Production: там смонтированы
загруженные пользователями файлы, /opt/sma-service/uploads.
Файл /opt/sma-service/backend/.env.docker больше не является источником для контейнера.
</path_note>
<apply>Переменные подхватываются при пересоздании контейнера. Перезапуска недостаточно.</apply>
<forbidden>
<f>Вписывать значение в файл.</f>
<f>Печатать значение в выводе или отчёте.</f>
<f>Передавать значение аргументом команды — попадёт в историю.</f>
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
