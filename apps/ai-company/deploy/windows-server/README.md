# AI Company — офисный сервер (Windows, LAN)

Панель + мосты на офисном сервере `192.168.1.157`, доступ с любого ПК в локалке:
**http://192.168.1.157:8080**

## Что запускается

| Сервис (NSSM, автостарт) | Где слушает | Роль |
|---|---|---|
| `ai-company-web` | `0.0.0.0:8080` | `vite preview`: отдаёт `dist/` и проксирует `/runtime/*` |
| `ai-company-gh-evidence` | `127.0.0.1:17320` | PR/checks как evidence (держит `GITHUB_TOKEN`) |
| `ai-company-connections` | `127.0.0.1:17321` | секреты интеграций (в памяти, до перезапуска) |
| Ollama (уже стоит) | `127.0.0.1:11434` | модели; наружу не открывается |

Браузер ходит в Ollama только через `/runtime/ollama` на том же адресе. Прокси вырезает
`Origin`, поэтому Ollama принимает запросы с любого офисного ПК без `OLLAMA_ORIGINS` и без
открытия 11434. `VITE_TOOL_DISPATCHER_OLLAMA_BASE_URL` **не задавать**: явный адрес с IP
код отвергает (`assertToolEndpointHasNoRawIp`), а same-origin работает и так.

## Установка (PowerShell от администратора)

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd <папка комплекта>\scripts

.\01-install-prereqs.ps1                 # Git, Node LTS, NSSM; проверяет Ollama
copy ..\env\bridges.env.example ..\env\bridges.env
notepad ..\env\bridges.env               # вписать GITHUB_TOKEN (read-only, fine-grained)
.\02-clone-and-build.ps1                 # клон ветки feat/memory-reconciliation → тесты → сборка
.\03-install-services.ps1                # сервисы + правило firewall на 8080
.\04-pull-models.ps1                     # докачивает только недостающее + смоук-генерация
.\healthcheck.ps1                        # всё зелёное → открыть адрес на другом ПК
.\05-cloudflare-tunnel.ps1 ...           # по желанию: доступ снаружи, см. ниже
```

После первого клона комплект есть и в самом репо:
`C:\ai-company\repo\apps\ai-company\deploy\windows-server` (тогда `bridges.env` положить туда).

С прокси: добавить `-Proxy http://proxy:3128` к 01/02/04 и раскомментировать `HTTP(S)_PROXY`
в `bridges.env`.

## Доступ снаружи (Cloudflare Tunnel + Access)

Панель публикуется на поддомене, например `https://ai.example.ru`. Порты на роутере не открываются:
`cloudflared` на сервере сам подключается к Cloudflare. Перед панелью стоит Cloudflare Access со входом
по почте и одноразовому коду. **Без Access не публиковать**: аутентификации в самой панели нет, и
открытая ссылка даёт управление всей командой и доступ к моделям.

В дашборде Cloudflare (Zero Trust, бесплатно до 50 пользователей). Порядок важен: сначала защита,
потом туннель.

1. **Zero Trust → Access → Applications → Add → Self-hosted.** Домен приложения — твой поддомен.
   Policy: Action **Allow**, Include → **Emails** → твоя почта (и почты тех, кому нужен доступ).
   Session duration — например 24 h.
2. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared.** Имя `ai-company`.
   На шаге установки скопируй **token** (длинная строка после `service install`).
3. В том же туннеле **Public Hostname → Add:** поддомен, Service **HTTP**, URL **`localhost:8080`**.
   DNS-запись Cloudflare создаст сам.

На сервере (PowerShell от администратора):

```powershell
.\05-cloudflare-tunnel.ps1 -Hostname ai.example.ru -TunnelToken "<token>"
```

Скрипт ставит `cloudflared` как службу Windows, добавляет имя в `AI_COMPANY_ALLOWED_HOSTS`,
перезапускает панель и проверяет адрес снаружи. Если сайт отвечает **без** формы входа Cloudflare,
скрипт останавливает туннель и пишет `DANGER` — значит, шаг 1 не сделан.

Ограничение: Cloudflare рвёт запрос, если ответ не начался за 100 секунд. Ответ модели идёт потоком
и начинается быстро, но самый первый вызов после простоя может упереться в загрузку модели в память.
Если первая задача упала с таймаутом, просто запусти её заново.

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

- **Состояние хранится в браузере** (localStorage/IndexedDB). Вести команду с одного браузера
  на одном ПК; другой ПК/браузер увидит пустую компанию. Общее серверное хранилище —
  следующий этап.
- Секреты `connections-bridge` теряются при перезапуске службы.
- Панель открывать по IP. Для имени сервера — `AI_COMPANY_ALLOWED_HOSTS=имя` в `bridges.env`
  и `03` заново.
- В самой панели аутентификации нет: снаружи — только через Cloudflare Access (раздел выше).

## Логи

`C:\ai-company\logs\<служба>.out.log / .err.log` (ротация по 10 МБ).
