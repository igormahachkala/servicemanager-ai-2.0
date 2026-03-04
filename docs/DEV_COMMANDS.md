# DEV COMMANDS — ServiceManager.AI

Цель документа:

Стандартизировать команды разработки и тестирования API.

Все команды предполагают:

- локальный backend
- Docker environment
- JWT авторизацию

Base URL (dev):

http://localhost:3000

---

# 1. Установка инструментов

Для удобной работы с API требуется:

jq

Установка:

sudo apt install jq

---

# 2. Dev helpers (bash)

Рекомендуется добавить dev helpers в:

~/.bashrc

Пример:

# === ServiceManager.AI dev helpers ===

export SMA_API_BASE="http://localhost:3000"
export SMA_DEV_EMAIL="admin@example.com"
export SMA_DEV_PASSWORD="admin"

sma_token() {
  curl -s -X POST "$SMA_API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SMA_DEV_EMAIL\",\"password\":\"$SMA_DEV_PASSWORD\"}" \
  | jq -r .access_token
}

sma_me() {
  local t
  t="$(sma_token)"
  curl -s "$SMA_API_BASE/auth/me" \
    -H "Authorization: Bearer $t"
}

board() {
  local qs="${1:-}"
  local t
  t="$(sma_token)"
  curl -s "$SMA_API_BASE/tickets/board${qs}" \
    -H "Authorization: Bearer $t"
}

Применить:

source ~/.bashrc

---

# 3. Проверка авторизации

Получить текущего пользователя:

sma_me

Ответ:

{
  "id": "...",
  "email": "...",
  "role": "ADMIN",
  "companyId": "..."
}

---

# 4. Получить JWT вручную

curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin"}' \
  | jq

---

# 5. Tickets board

Получить kanban board:

board

Фильтры:

board "?status=NEW"

board "?status=NEW&status=ASSIGNED"

board "?assigneeId=unassigned"

board "?sla=atRisk"

board "?take=50"

board "?q=printer"

Комбинированный пример:

board "?status=NEW&status=ASSIGNED&assigneeId=unassigned&sla=atRisk&take=50&q=test"

---

# 6. Создание пользователя

TOKEN=$(sma_token)

curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"tech@test.local",
    "password":"ChangeMe123!",
    "role":"TECHNICIAN"
  }'

---

# 7. Создание тикета

TOKEN=$(sma_token)

curl -s -X POST http://localhost:3000/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "problemCategoryId":"<CATEGORY_ID>",
    "problemText":"Test ticket",
    "urgency":"NOT_URGENT",
    "requesterName":"Test User",
    "requesterPhone":"+7 999 000-00-00",
    "address":"Test address",
    "pointName":"Point A"
  }'

---

# 8. Назначение техника

TOKEN=$(sma_token)

curl -X PUT http://localhost:3000/tickets/<TICKET_ID>/assign/<TECH_ID> \
  -H "Authorization: Bearer $TOKEN"

---

# 9. Claim тикета

TOKEN=$(sma_token)

curl -X POST http://localhost:3000/tickets/<TICKET_ID>/claim \
  -H "Authorization: Bearer $TOKEN"

---

# 10. Смена статуса

TOKEN=$(sma_token)

curl -X PATCH http://localhost:3000/tickets/<TICKET_ID>/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"IN_PROGRESS"
  }'

---

# 11. Docker

Пересобрать backend:

docker compose up -d --build backend

Посмотреть логи:

docker logs -n 100 sma_backend

Остановить систему:

docker compose down

---

# 12. Prisma

Создать миграцию:

npx prisma migrate dev --name migration_name

Форматирование:

npx prisma format

Открыть Prisma Studio:

npx prisma studio

---

# 13. Полезные команды

Показать пользователей:

docker compose exec backend node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findMany().then(r=>console.log(r)).finally(()=>p.\$disconnect())"

Показать количество сущностей:

docker compose exec backend node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.user.count(),p.ticket.count()]).then(r=>console.log(r)).finally(()=>p.\$disconnect())"

---

# 14. Dev Philosophy

Dev команды должны:

- не хранить JWT в репозитории
- использовать динамический login
- работать внутри multi-tenant модели
- не нарушать security rules
