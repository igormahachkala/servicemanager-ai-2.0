# DEV COMMANDS — ServiceManager.AI

Цель: быстрые команды для разработки без хранения токенов вручную.

Base URL (dev):
http://localhost:3000

---

## 1. Получить JWT токен (ADMIN)

TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sma.local","password":"ChangeMe123!"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

echo "TOKEN_LEN=${#TOKEN}"

---

## 2. Проверить текущего пользователя

curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"

---

## 3. Создать техника

curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"tech@test.local","password":"ChangeMe123!","role":"TECHNICIAN"}'

---

## 4. Список техников

curl -s http://localhost:3000/technicians \
  -H "Authorization: Bearer $TOKEN"

---

## 5. Создать тикет

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

## 6. Получить список тикетов

curl -s http://localhost:3000/tickets \
  -H "Authorization: Bearer $TOKEN"

---

## 7. Получить один тикет

curl -s http://localhost:3000/tickets/<TICKET_ID> \
  -H "Authorization: Bearer $TOKEN"

---

## 8. Ручное назначение техника

curl -s -X PUT http://localhost:3000/tickets/<TICKET_ID>/assign/<TECH_ID> \
  -H "Authorization: Bearer $TOKEN"

---

## 9. Создать дочерний тикет

curl -s -X POST http://localhost:3000/tickets/<PARENT_ID>/child \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "problemCategoryId":"<CATEGORY_ID>",
    "problemText":"Child task",
    "urgency":"NOT_URGENT"
  }'

---

## 10. Включить автоназначение

curl -s -X PATCH http://localhost:3000/company/auto-assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'

---

## 11. Выключить автоназначение

curl -s -X PATCH http://localhost:3000/company/auto-assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'

---

## 12. Prisma

Миграция:
npx prisma migrate dev --name <migration_name>

Форматирование:
npx prisma format

---

## 13. Docker

Пересобрать backend:
docker compose up -d --build backend

Посмотреть логи:
docker logs -n 80 sma_backend

Остановить:
docker compose down
