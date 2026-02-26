
---

## 1) Swagger — как тестировать API “в браузере” (без Postman)

### 1.1 Где открыть
- Swagger UI: http://127.0.0.1:3000/api
- OpenAPI JSON: http://127.0.0.1:3000/api-json
- Health: http://127.0.0.1:3000/health

### 1.2 Как авторизоваться в Swagger (чтобы /auth/me не давал 401)
1) Выполни `POST /auth/login` (или `POST /auth/register` для первой регистрации).
2) Скопируй `access_token`.
3) Нажми **Authorize** (замок сверху).
4) Вставь **только токен** (без слова `Bearer`), если Swagger включён через `.addBearerAuth()`.

Проверка: `GET /auth/me` должен вернуть `200`.

### 1.3 Если “Failed to fetch / CORS”
В `src/main.ts` должно быть включено:

```ts
app.enableCors({ origin: true, credentials: true });
