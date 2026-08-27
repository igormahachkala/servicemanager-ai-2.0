# MVP Smoke Test

Дата проверки: 2026-03-20

## Пройдено
- backend code builds
- frontend TypeScript builds
- employee demo polish code is in place
- closed onboarding is implemented (public /auth/register disabled, login remains active)
- locations UI is implemented
- quick request code path is implemented

## Частично подтверждено
- backend и postgres уже поднимаются в существующем Docker runtime
- `docker compose config` валиден
- backend health endpoint ранее отвечал корректно

## Не подтверждено в этой host-среде
- новый `web` container не был собран и поднят через `docker compose up -d --build`
- browser-level smoke сценарий целиком не пройден в этой сессии

## Blocking issue
Текущий host runtime падает на Docker build из UNC workspace:
- `mkdir C:\Users\…\.docker: Access is denied`
- при обходе через локальный `DOCKER_CONFIG`: `Incorrect function`

Предполагаемая причина:
- Windows Docker + UNC `\\wsl.localhost\...` context seam
- проблема host environment, а не product logic

## Минимальный следующий шаг
Запустить тот же `docker compose up -d --build postgres backend web`:
- либо внутри нормальной WSL/Linux shell
- либо сразу на Linux сервере

После этого проверить:
1. открывается `http://localhost:4173`
2. регистрация
3. логин
4. создание локации
5. создание заявки
6. заявка на доске
7. список сотрудников
