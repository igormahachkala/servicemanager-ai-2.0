# AI Company — офисный сервер (Windows, LAN)

Панель + мосты на офисном сервере `192.168.1.157`, доступ с любого ПК в локалке:
**http://192.168.1.157:8080**

## Что запускается

| Сервис (NSSM, автостарт) | Где слушает | Роль |
|---|---|---|
| `ai-company-web` | `0.0.0.0:8080` | `vite preview`: отдаёт `dist/` и проксирует `/runtime/*` |
| `ai-company-gh-evidence` | `127.0.0.1:17320` | PR/checks как evidence (держит `GITHUB_TOKEN`) |
| `ai-company-connections` | `127.0.0.1:17321` | секреты интеграций (в памяти, до перезапуска) |
| `ai-company-state` | `127.0.0.1:17322` | общее состояние компании для всех браузеров |
| Ollama (уже стоит) | `127.0.0.1:11434` | модели; наружу не открывается |

Браузер ходит в Ollama только через `/runtime/ollama` на том же адресе. Прокси вырезает
`Origin`, поэтому Ollama принимает запросы с любого офисного ПК без `OLLAMA_ORIGINS` и без
открытия 11434. `VITE_TOOL_DISPATCHER_OLLAMA_BASE_URL` **не задавать**: явный адрес с IP
код отвергает (`assertToolEndpointHasNoRawIp`), а same-origin работает и так.

## Установка — одна команда

В командной строке или PowerShell **от администратора** (по SSH тоже работает):

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; & ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/igormahachkala/servicemanager-ai-2.0/feat/memory-reconciliation/apps/ai-company/deploy/windows-server/bootstrap.ps1'))) -Hostname ai.sma-tech.ru"
```

Скачивает комплект в `C:\ai-company\kit` и запускает `scripts\install.ps1`: Git, Node, NSSM (через winget,
а если он недоступен — напрямую с официальных сайтов) → сборка → службы → модели → проверка →
публичное имя. Без `-Hostname` панель будет только в локальной сети. Повторный запуск безопасен.
Ключи: `-SkipModels` (не трогать модели), `-Proxy http://адрес:порт`.

`GITHUB_TOKEN` можно вписать позже в `C:\ai-company\kit\env\bridges.env` и выполнить
`scripts\03-install-services.ps1`.

### По шагам (если нужно)

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\ai-company\kit\scripts
.\01-install-prereqs.ps1
copy ..\env\bridges.env.example ..\env\bridges.env
.\02-clone-and-build.ps1
.\03-install-services.ps1
.\04-pull-models.ps1
.\healthcheck.ps1
.\05-public-hostname.ps1 -Hostname ai.sma-tech.ru
```

## Общие данные

Служба `ai-company-state` хранит состояние компании на сервере (`C:\ai-company\state\state.json`,
ежедневные копии за 14 дней). Все браузеры — офис, дом, телефон — видят одну и ту же компанию,
изменения доезжают за несколько секунд. Первый браузер, открывший панель на пустом сервере, загружает
туда свои данные; остальные берут серверную копию. Язык и тема остаются свои на каждом устройстве.
При одновременной правке одного и того же раздела с двух устройств сохраняется последняя.

## Доступ снаружи

Через тот же WireGuard-туннель, что у «Моего помощника» (daily): VPS ⇄ офисный Linux ⇄ этот сервер,
с HTTPS и паролем на VPS. Порты на роутере не открываются. Порядок и скрипты —
`../vps-tunnel/README.md`; на этом сервере последний шаг — `05-public-hostname.ps1`.

## Обновление версии

```powershell
.\02-clone-and-build.ps1
Restart-Service ai-company-web
```

## Модели

`04` гарантирует наличие `qwen3-coder:30b` (анализ/код, дефолт панели), `qwen3.6:latest`
(MoE-диспетчер), `nomic-embed-text` (эмбеддинги). Уже скачанные модели не трогает.
Свой набор: `.\04-pull-models.ps1 -Models qwen3-coder:30b,qwen3.6:latest`.

## Ollama как служба

Если Ollama запущена как приложение в трее, она живёт только пока пользователь вошёл.
Чтобы переживала перезагрузку без входа: закрыть трей-приложение и выполнить
`.\03-install-services.ps1 -InstallOllamaService`. AMD/ROCm Ollama для Windows подхватывает сама.

## Автономия

`AI_COMPANY_AUTO_APPROVE_SAFE_TOOLS=1` (уже включено в `env/*`): анализ через Ollama
(read-only) стартует без ручного аппрува. Cursor (запись в репо) **всегда** ждёт Владельца.
Выключить: поставить `0` в `ai-company.build.env` и пересобрать (`02`).

## Ограничения V1

- Секреты `connections-bridge` теряются при перезапуске службы.
- Панель открывать по IP. Для имени сервера — `AI_COMPANY_ALLOWED_HOSTS=имя` в `bridges.env`
  и `03` заново.
- В самой панели аутентификации нет: снаружи — только через VPS с паролем (раздел выше).

## Логи

`C:\ai-company\logs\<служба>.out.log / .err.log` (ротация по 10 МБ).
