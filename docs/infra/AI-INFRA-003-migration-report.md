# AI-INFRA-003 — Итоговый отчёт миграции

**Дата:** 2026-07-06  
**Источник:** `SERVER_OLD_IP`  
**Цель:** `SERVER_NEW_IP`  
**DNS cutover:** **не выполнялся**  
**Старый сервер:** **не останавливался**, prod по DNS работает  

> Репозиторий публичный: адреса, hostname и идентификаторы инстансов заменены
> плейсхолдерами (`SERVER_OLD_IP`, `SERVER_NEW_IP`, `<vitrina-host>`, `<n8n-host>`).
> Фактические значения — в приватном реестре инфраструктуры и переменных окружения.

---

## Резюме

Миграция инфраструктуры AI Photo Lab + n8n + Ollama на новый сервер **завершена**. Оба сервера в рабочем состоянии. Новый сервер **готов к переключению DNS** после Owner-ревью.

---

## Что перенесено

| Компонент | Старый путь | Новый путь | Размер | Статус |
|---|---|---|---|---|
| Ollama models (local) | `/usr/share/ollama/.ollama/models/` | то же | **32 GB** | Завершено |
| AI Photo Lab | `/opt/ai-photo-lab/` | `/opt/ai-photo-lab/` | ~163 MB (с node_modules) | Завершено |
| SQLite | `data/ai-photo-lab.sqlite` | то же | ~1.1 MB | Завершено |
| Uploads | `uploads/` | то же | 24 файла | Завершено |
| n8n compose | `/root/n8n/docker-compose.yml` | то же | 662 B | Завершено (+ правки) |
| Caddyfile | `/root/n8n/Caddyfile` | то же | 118 B | Завершено (+ правки) |
| Docker volume n8n | `n8n_n8n_data` | `n8n_n8n_data` | 6.7 MB | Завершено |
| Docker volume caddy | `n8n_caddy_data` | `n8n_caddy_data` | 120 KB | Завершено |
| Docker volume caddy config | `n8n_caddy_config` | `n8n_caddy_config` | 12 KB | Завершено |
| PM2 state | `/root/.pm2/dump.pm2` | то же | ~8 KB | Завершено |

---

## Контрольные суммы

| Файл | SHA256 (новый) | Совпадение со старым |
|---|---|---|
| `ai-photo-lab.sqlite` | `14948fa5e2d8f2d2f9d9f9349a2626f275b36c870d724b183d7c9216d676f20e` | **Да** (на момент копирования) |
| `docker-compose.yml` (оригинал) | `26844dad91a177265beeeb41250bf83c11b85c5618ccc8c3e2dbda001e162cea` | Перенесён, затем изменён |
| `Caddyfile` (оригинал) | `366129e5072c8f57f3d799099909b5e8e6e6a5d8d0915af79180ba70ff2db938` | Перенесён, затем изменён |

**SQLite:** `PRAGMA integrity_check` → **ok**

---

## Что было установлено / настроено (prep + post)

- Swap **16 GB** (`/swapfile`)
- `apt update && apt upgrade`
- SSH-ключ, **root password login отключён**
- Node.js 22, PM2, Docker, Ollama
- UFW: 22, 80, 443 + **3002 из Docker-сети** (172.16.0.0/12)
- Ollama: **127.0.0.1:11434** only
- Fail2ban (sshd)

---

## Что пришлось исправить

### 1. Vitrina 502 через Caddy

**Проблема:** `reverse_proxy 172.17.0.1:3002` — timeout с Docker-контейнера Caddy.

**Исправление:**
- Caddyfile: `reverse_proxy host.docker.internal:3002`
- docker-compose: `extra_hosts: host.docker.internal:host-gateway` для Caddy
- UFW: allow 3002/tcp from 172.16.0.0/12

**Результат:** vitrina **HTTP 200** через `--resolve` на новом IP.

### 2. Ollama models — неполный tar-пайп

**Проблема:** tar-пайp скопировал ~2.6 GB из 32 GB.

**Исправление:** rsync `--partial` с old → new (`infra-003-rsync-ollama.sh`), завершён **2026-07-03 15:54 MSK**.

**Результат:** **32 GB**, все 5 локальных моделей в `ollama list`.

---

## Проверки (2026-07-06)

### HTTP (без смены DNS, через `--resolve` или prod DNS)

| Endpoint | Старый (DNS) | Новый (--resolve) |
|---|---|---|
| <vitrina-host> | **200** | **200** |
| <n8n-host> | **200** | **200** |
| localhost:3002 (PM2) | — | **200** |

### Ollama — локальные модели

| Модель | Тест | Результат |
|---|---|---|
| nomic-embed-text:latest | `/api/embeddings` | **OK** (dim=768) |
| deepseek-r1:8b | generate | **OK** |
| qwen2.5-coder:7b | generate | **OK** |
| qwen2.5vl:7b | generate | **OK** |
| qwen3.6:27b | generate | **OK** (~32s) |

### Ollama security

- Слушает **127.0.0.1:11434**
- Снаружи `:11434` — **timeout/blocked** (UFW)

### Сервисы на новом

| Сервис | Статус |
|---|---|
| ollama.service | active, enabled |
| docker.service | active, enabled |
| pm2 ai-photo-lab | online, 2+ days uptime |
| n8n-n8n-1 | Up 2 days |
| n8n-caddy-1 | Up 2 days |
| pm2-root.service | enabled (inactive until reboot — норма при живом PM2) |

### Логи

- PM2 ai-photo-lab: без ошибок
- Caddy: без critical errors (502 устранён)
- n8n: workflow активирован
- Ollama: normal operation

---

## Зависимости (новый сервер)

```
Internet → Caddy :443/:80 (Docker)
  ├─ <n8n-host> → n8n:5678
  └─ <vitrina-host> → host.docker.internal:3002 (PM2)
        └─ Ollama 127.0.0.1:11434
```

---

## Риски и что не проверено

| Пункт | Статус |
|---|---|
| Vision upload end-to-end (qwen2.5vl через UI) | **Не проверен** вручную после миграции |
| n8n webhooks с внешних систем | **Не проверен** (DNS на старый IP) |
| SSL auto-renewal на новом IP | **Не проверен** (нужен DNS cutover) |
| PM2 autostart после reboot | **Не проверен** (рекомендуется `reboot` test в maintenance window) |
| SQLite WAL drift | Данные на момент копирования; prod на старом мог накопить новые записи |
| Cloud-модели Ollama | Работают через ollama.com API, не переносились |

---

## Готов ли новый сервер к переключению DNS?

### **Да**, с оговорками:

1. Выполнить **maintenance window** для финальной синхронизации SQLite/uploads (если нужны актуальные данные)
2. Снизить TTL DNS заранее
3. После cutover проверить SSL renewal и n8n webhooks
4. Опционально: тест reboot нового сервера
5. Старый сервер **не выключать** 24–48 ч (rollback)

### Причины «не готов без оговорок»:

- Нет финальной delta-sync данных с prod (SQLite мог измениться за 3 дня)
- Reboot-test не выполнялся

---

## План cutover (следующий этап — AI-INFRA-004)

1. Maintenance window: `pm2 stop` на старом → финальный rsync `data/` + `uploads/` + n8n volume
2. TTL DNS → 300s
3. A-records `<vitrina-host>`, `<n8n-host>` → **SERVER_NEW_IP**
4. Проверка HTTPS, UI, n8n workflow, Ollama vision
5. Мониторинг 24–48 ч, старый сервер standby
6. Rollback: DNS → SERVER_OLD_IP

---

## Ограничения (соблюдены)

- DNS **не менялся**
- Старый сервер **не останавливался**
- Данные на старом **не удалялись**
- Конфигурация старого **не изменялась** (только read-only copy)

---

## Файлы

- Manifest: `docs/infra/AI-INFRA-003-migration-manifest.md`
- Test log: `/root/ollama-model-tests.log` (новый сервер)
- Rsync log: `/root/ollama-rsync.log` (новый сервер)
