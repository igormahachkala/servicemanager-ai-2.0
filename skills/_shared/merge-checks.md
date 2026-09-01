<!-- Общий файл: sma-deploy-stage и sma-deploy-prod.
     Команды вынесены в scripts/merge-checks.sh: код скрипта в контекст
     не загружается, расходуется только его вывод.
     Здесь остаётся то, где решение принимает агент или разработчик. -->

<contents>
  constraint     обязательность прогона в Production
  run            вызов скрипта и разбор кодов возврата
  env_file       чего делать нельзя без backend/.env
  what_runs      что именно прогоняет скрипт, по областям
  on_failure     что делать при отказе, по контурам
</contents>

<merge_checks>

<constraint contour="production">
Прогон обязателен, даже если те же проверки прошли в sma-deploy-stage.
Состояние другое.
</constraint>

<precondition>
Рабочая копия стоит на результате слияния: шаг «получить результат слияния»
выполнен, HEAD отсоединён на FETCH_HEAD. Скрипт вернёт копию в ветку задачи
сам, в любом исходе.
</precondition>

<run script="skills/_shared/scripts/merge-checks.sh">
skills/_shared/scripts/merge-checks.sh &lt;контур&gt; &lt;номер PR&gt; &lt;ветка задачи&gt; &lt;область&gt;...
</run>
<example>
skills/_shared/scripts/merge-checks.sh stage 42 fix/tema-001 backend frontend
</example>
<expect>Код возврата 0 и строка «Все наборы прошли».</expect>

<codes>
  0    все наборы прошли
  1    набор не прошёл, в выводе названо какой
  2    неверные аргументы, неизвестный контур либо копия не на результате слияния
  3    нет доступа к серверу по ssh sma
  4    нет backend/.env, набор backend невыполним
  6    уборка не удалась: временный worktree остался, команда для удаления в выводе
  130  прервано с клавиатуры
  143  прервано сигналом
</codes>

<what_runs>
Скрипт выполняет только наборы задетых областей, зависимости ставит
тоже только для них: лишний npm ci занимает минуты и ничего не проверяет.

  backend        prisma:generate, build, test
  frontend       build
  agent-runner   typecheck, build
  scripts        bash -n по каждому изменённому файлу из scripts/
  infra          на сервере: результат слияния во временный worktree,
                 разбор конфигурации compose, удаление worktree
  none, skills   автоматических проверок нет

Значения области fullstack не существует: карта шага 1 его не порождает.
Задеты backend и frontend — это две области, выполняются оба набора.
</what_runs>

<env_file>
Набор backend требует файла backend/.env с переменной DATABASE_URL:
npm run prisma:generate — это dotenv -e .env -- npx prisma generate.
Скрипт проверяет наличие файла и при отсутствии возвращает код 4.

Агент этот файл не создаёт и значения не подбирает. Единственный полный
выход: разработчик даёт значение DATABASE_URL для локальной проверки.

Частичная замена, только с согласия разработчика: проверить схему внутри
контейнера на контуре. Скрипт этого не делает — согласия он спросить не может.
<on contour="stage">
ssh sma 'docker compose -p sma-service -f /opt/sma-beta/docker-compose.stage.yml -f /etc/servicemanager-ai/docker-compose.stage.override.yml exec -T stage_backend npx prisma validate'
</on>
<on contour="production">
ssh sma 'docker compose -p sma-service -f /opt/sma-prod/docker-compose.yml -f /etc/servicemanager-ai/docker-compose.production.override.yml -f /etc/servicemanager-ai/docker-compose.production.stable.override.yml exec -T backend npx prisma validate'
</on>
Это закрывает одну команду из четырёх. Сборка и тесты так не проверяются,
и контур на время занят. Не считать эту замену равноценной.
</env_file>

<forbidden>
<f>Создавать backend/.env самостоятельно.</f>
<f>Подставлять DATABASE_URL наугад, в том числе адрес контура.</f>
</forbidden>

<why_no_validate>
Отдельного prisma validate в наборе нет намеренно: схему разбирает и проверяет
сам prisma generate, тем же кодом и с теми же ошибками. Вызвать validate
правильно к тому же непросто — npm --prefix X exec рабочий каталог не меняет,
а прямой вызов не видит backend/.env и даёт отказ P1012.
</why_no_validate>

<remote_note>
Разбор конфигурации compose идёт на сервере обязательно: оверрайды лежат
в /etc/servicemanager-ai/, в репозитории их нет. Скрипт запускает config
с флагом -q — полный вывод содержит значения переменных.

Временный worktree удаляет тот же скрипт, который его создал, в любом исходе,
включая отказ проверки и прерывание. Это единственное исключение из запрета
на удаление. Код 6 означает, что удалить не удалось: команда для ручной
уборки напечатана.
</remote_note>

<on_failure contour="stage">
Не сливать. Исправить в ветке задачи, повторить с шага «получить результат
слияния».
</on_failure>
<on_failure contour="production">
Не сливать. Закрыть PR, исправлять в ветке задачи, начинать с sma-deploy-stage
заново.
</on_failure>

<excluded tool="npm run lint" contour="stage">
Во фронтенде 301 ошибка, в бэкенде ~11900. Бэкендовый lint содержит --fix
и изменяет исходники, поэтому не является read-only проверкой.
</excluded>

</merge_checks>
