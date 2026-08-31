<!-- Общий файл: sma-deploy-stage и sma-deploy-prod.
Пункты с contour выполняются только на названном контуре. -->

<prerequisites fail="остановиться, сообщить пользователю, не начинать">
<p name="доступ к серверу">
<command>ssh -o BatchMode=yes sma 'whoami'</command>
<expect>deploy</expect>
</p>
<p name="gh авторизован и имеет право на PR">
<command>gh api repos/igormahachkala/servicemanager-ai-2.0/pulls --jq 'length'</command>
<expect>Число.</expect>
<rationale>
Проверяется работоспособность, а не устройство токена. Вернулось число —
вход есть и право на PR есть, независимо от того, каким токеном агент
авторизован. Запрос читающий, ничего не создаёт.

Требования к токену — скилл sma-agent-setup, часть C. Здесь они
не повторяются: при изменении правил выдачи правка нужна в одном месте.
</rationale>
<on_failure>Настройка и разбор отказов — скилл sma-agent-setup, часть C, шаг 3.</on_failure>
</p>
<p name="правила по секретам прочитаны">
<expect>Правила по секретам прочитаны до первой команды, затрагивающей сервер.</expect>
</p>
<p name="критерий приёмки" contour="stage">
<expect>Сформулирован в sma-code-delivery шаг 1.</expect>
</p>
<contour_note>
Пункт «критерий приёмки» относится только к Stage: там задача принимается.
В Production критерий уже сформулирован и перенесён в тег stage-ok,
заново его не формулируют.
</contour_note>
<on_missing>Настройка машины — скилл sma-agent-setup.</on_missing>
</prerequisites>
