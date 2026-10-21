<!-- Общий файл: sma-deploy-stage и sma-deploy-prod. -->

<execution_context>
<rule>
Команда выполняется на машине агента, если явно не начинается с ssh на хост
контура. Docker на машине агента отсутствует либо содержит посторонние
контейнеры, поэтому любая команда docker и любая работа с каталогами
сервера идут только через ssh на хост этого контура.
</rule>
<host contour="stage">ssh sma-spare</host>
<host contour="production">ssh sma</host>
<on_agent_machine>
git по своей рабочей копии; gh; npm и сборка при локальных проверках;
curl по публичным адресам контура — он намеренно идёт снаружи и проверяет
доступность через nginx, а не изнутри сети docker.
</on_agent_machine>
<on_server>
Всё остальное: docker inspect, docker ps, docker logs, docker compose,
git в каталогах развёртывания.
</on_server>
<check>
Строка содержит docker без префикса ssh на хост контура — это дефект,
исправить. Stage без ssh sma-spare, Production без ssh sma.
</check>
</execution_context>
