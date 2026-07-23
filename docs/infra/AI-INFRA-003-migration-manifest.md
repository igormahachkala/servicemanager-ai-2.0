# AI-INFRA-003 — Migration Manifest

**Источник:** `SERVER_OLD_IP` → **Цель:** `SERVER_NEW_IP`  
**Дата миграции:** 2026-07-03  
**Финальная верификация:** 2026-07-06  
**DNS cutover:** не выполнялся  
**Отчёт:** [AI-INFRA-003-migration-report.md](./AI-INFRA-003-migration-report.md)

> Репозиторий публичный: адреса и hostname заменены плейсхолдерами
> (`SERVER_OLD_IP`, `SERVER_NEW_IP`, `<vitrina-host>`, `<n8n-host>`).

| # | Объект | Старый путь | Новый путь | Размер | SHA256 | Статус |
|---|--------|-------------|------------|--------|--------|--------|
| 1 | Swap 16GB | — | `/swapfile` | 16 GB | — | **Завершено** |
| 2 | SSH hardening | — | `/etc/ssh/sshd_config.d/99-migration-hardening.conf` | — | — | **Завершено** |
| 3 | Ollama models (local) | `/usr/share/ollama/.ollama/models/` | `/usr/share/ollama/.ollama/models/` | 32 GB | rsync total ~33.57 GB | **Завершено** |
| 4 | AI Photo Lab code | `/opt/ai-photo-lab/` | `/opt/ai-photo-lab/` | ~163 MB | — | **Завершено** |
| 5 | SQLite data | `/opt/ai-photo-lab/data/ai-photo-lab.sqlite` | `/opt/ai-photo-lab/data/` | ~1.1 MB | `14948fa5e2d8f2d2f9d9f9349a2626f275b36c870d724b183d7c9216d676f20e` | **Завершено** |
| 6 | Uploads | `/opt/ai-photo-lab/uploads/` | `/opt/ai-photo-lab/uploads/` | ~8 MB | 24 файла | **Завершено** |
| 7 | PM2 dump | `/root/.pm2/dump.pm2` | `/root/.pm2/dump.pm2` | ~8 KB | — | **Завершено** |
| 8 | n8n compose | `/root/n8n/docker-compose.yml` | `/root/n8n/docker-compose.yml` | 662 B | orig `26844dad…` | **Завершено** (+ extra_hosts) |
| 9 | Caddyfile | `/root/n8n/Caddyfile` | `/root/n8n/Caddyfile` | 118 B | orig `366129e5…` | **Завершено** (+ host.docker.internal) |
| 10 | n8n volume | `n8n_n8n_data` | `n8n_n8n_data` | 6.7 MB | — | **Завершено** |
| 11 | caddy_data volume | `n8n_caddy_data` | `n8n_caddy_data` | 120 KB | — | **Завершено** |
| 12 | caddy_config volume | `n8n_caddy_config` | `n8n_caddy_config` | 12 KB | — | **Завершено** |

## Локальные модели Ollama — тесты (2026-07-06)

| Модель | Размер | Тест | Статус |
|--------|--------|------|--------|
| nomic-embed-text:latest | 274 MB | embed dim=768 | **OK** |
| deepseek-r1:8b | 5.2 GB | generate | **OK** |
| qwen2.5-coder:7b | 4.7 GB | generate | **OK** |
| qwen2.5vl:7b | 6.0 GB | generate | **OK** |
| qwen3.6:27b | 17 GB | generate (~32s) | **OK** |

## HTTP-проверка (без DNS cutover)

| URL | Старый `SERVER_OLD_IP` | Новый `SERVER_NEW_IP` |
|-----|------------------------|------------------------|
| `<vitrina-host>` | 200 | 200 (--resolve) |
| `<n8n-host>` | 200 | 200 (--resolve) |
