<!-- Описание области «scripts».
     Читается скилами sma-deploy-stage и sma-deploy-prod, только когда эту
     область вернул скрипт _shared/scripts/area-map.sh. -->

<area name="scripts">
<what>
Исполняемые файлы: утилиты в корневом scripts/ и скрипты скилов
в skills/&lt;скилл&gt;/scripts/ либо skills/_shared/scripts/.
</what>
<checks>bash -n &lt;каждый изменённый файл&gt;</checks>
<why_checks>Сами скрипты не запускать.</why_checks>
<deploy>Не требуется: на сервере не используются.</deploy>
</area>
