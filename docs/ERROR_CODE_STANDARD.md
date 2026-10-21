# ERROR CODE STANDARD — ServiceManager.AI

Этот документ вводит стандарт ошибок
для API ServiceManager.AI.

Цель:

- единый формат ошибок
- предсказуемое поведение API
- удобство для frontend
- удобство для логирования


--------------------------------------------------

1. Общий формат ошибки

Все ошибки API должны возвращать
единый формат.

Формат ответа:

{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "statusCode": 400
}


--------------------------------------------------

2. Почему нужен error code

Текст ошибки может меняться.

Но error code должен быть
стабильным.

Frontend должен ориентироваться
именно на error code.


--------------------------------------------------

3. Структура кодов ошибок

Формат:

DOMAIN_ERROR_NAME


Примеры:

AUTH_INVALID_CREDENTIALS  
AUTH_TOKEN_EXPIRED  
USER_NOT_FOUND  
USER_ALREADY_EXISTS  
TICKET_NOT_FOUND  
TICKET_ALREADY_ASSIGNED  


--------------------------------------------------

4. AUTH ошибки

AUTH_INVALID_CREDENTIALS

неверный email или пароль


AUTH_TOKEN_EXPIRED

токен просрочен


AUTH_TOKEN_INVALID

невалидный токен


AUTH_UNAUTHORIZED

пользователь не авторизован


--------------------------------------------------

5. USER ошибки

USER_NOT_FOUND

пользователь не найден


USER_ALREADY_EXISTS

email уже зарегистрирован


USER_FORBIDDEN

недостаточно прав


--------------------------------------------------

6. COMPANY ошибки

COMPANY_NOT_FOUND

компания не найдена


COMPANY_FORBIDDEN

доступ к компании запрещен


--------------------------------------------------

7. TICKET ошибки

TICKET_NOT_FOUND

тикет не найден


TICKET_ALREADY_ASSIGNED

тикет уже назначен


TICKET_NOT_ASSIGNED

тикет не назначен


TICKET_STATUS_INVALID

нельзя изменить статус


--------------------------------------------------

8. PERMISSION ошибки

PERMISSION_DENIED

нет нужного permission


ROLE_FORBIDDEN

роль не имеет доступа


--------------------------------------------------

9. VALIDATION ошибки

VALIDATION_ERROR

ошибка валидации DTO


FIELD_REQUIRED

обязательное поле отсутствует


FIELD_INVALID

невалидное значение


--------------------------------------------------

10. MULTI-TENANT ошибки

CROSS_COMPANY_ACCESS

попытка доступа к чужой компании


--------------------------------------------------

11. INTERNAL ошибки

INTERNAL_ERROR

непредвиденная ошибка сервера


DATABASE_ERROR

ошибка базы данных


--------------------------------------------------

12. HTTP соответствие

400

validation error


401

unauthorized


403

forbidden


404

not found


409

conflict


500

internal error


--------------------------------------------------

13. Использование в NestJS

Ошибка должна выбрасываться
через стандартные exceptions.

Пример:

throw new NotFoundException({
  error: "TICKET_NOT_FOUND",
  message: "Ticket not found"
})


--------------------------------------------------

14. Логирование ошибок

Все ошибки уровня 500
должны логироваться.


--------------------------------------------------

15. Архитектурная цель

Единый стандарт ошибок
позволяет:

- масштабировать API
- упрощать frontend
- улучшать observability
- ускорять разработку
