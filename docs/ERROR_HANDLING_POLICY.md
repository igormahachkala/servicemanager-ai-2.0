# ERROR HANDLING POLICY — ServiceManager.AI

Этот документ определяет правила обработки ошибок
в backend системе ServiceManager.AI.

Цель документа:

- стандартизировать API ошибки
- упростить frontend интеграцию
- предотвратить хаотичные exception patterns


---

# 1. Общие принципы

Backend должен:

- использовать стандартные HTTP коды
- возвращать предсказуемый формат ошибок
- не раскрывать внутреннюю информацию

API ошибки должны быть:

- понятными
- безопасными
- стабильными


---

# 2. Формат ошибки API

Все ошибки API должны возвращаться
в стандартном формате NestJS.

Пример:

{
  "statusCode": 400,
  "message": "Email already registered",
  "error": "Bad Request"
}


---

# 3. Основные HTTP коды

Система использует следующие коды.


### 400 — Bad Request

Ошибка входных данных.

Примеры:

- неправильный email
- отсутствует обязательное поле
- неправильный формат


---

### 401 — Unauthorized

Пользователь не аутентифицирован.

Примеры:

- отсутствует JWT
- токен недействителен
- токен истёк


---

### 403 — Forbidden

Пользователь аутентифицирован,
но не имеет права выполнить действие.


Примеры:

- нет permission
- доступ запрещён policy


---

### 404 — Not Found

Ресурс не найден.

Примеры:

- ticket не существует
- user не существует


---

### 409 — Conflict

Конфликт состояния.

Примеры:

- email уже существует
- ресурс уже назначен


---

### 422 — Unprocessable Entity

Бизнес-логика запрещает операцию.

Примеры:

- нельзя изменить статус
- тикет уже закрыт


---

### 500 — Internal Server Error

Внутренняя ошибка системы.

Примеры:

- ошибка базы данных
- неожиданный exception


---

# 4. Использование NestJS exceptions

Backend должен использовать
стандартные exception классы NestJS.

Примеры:

BadRequestException  
UnauthorizedException  
ForbiddenException  
NotFoundException  
ConflictException  
UnprocessableEntityException  
InternalServerErrorException


---

# 5. Где выбрасывать ошибки

Ошибки бизнес-логики должны
выбрасываться в service.

Controller не должен содержать
сложной логики ошибок.


---

# 6. Пример правильной обработки

Пример проверки пользователя:

if (!user) {
  throw new UnauthorizedException('Invalid credentials');
}


Пример проверки данных:

if (!dto.companyName?.trim()) {
  throw new BadRequestException('Company name is required');
}


---

# 7. Ошибки доступа

Ошибки доступа должны обрабатываться через:

PermissionGuard  
RolesGuard  
Policy Layer


Service не должен вручную проверять permissions.


---

# 8. Ошибки multi-tenant доступа

Если пользователь пытается получить
ресурс другой компании:

нужно возвращать:

404 Not Found


Это предотвращает
утечку информации.


---

# 9. Логирование ошибок

Критические ошибки должны логироваться.

Примеры:

- database errors
- unexpected exceptions
- security violations


Логи должны содержать:

timestamp  
userId  
companyId  
endpoint  
error message


---

# 10. Domain events ошибок

Некоторые ошибки должны фиксироваться
в DomainEvent.

Примеры:

- security violations
- SLA breach
- workflow failures


---

# 11. Ошибки валидации DTO

Валидация должна выполняться через:

class-validator


Пример:

IsEmail  
IsString  
MinLength  
IsOptional


DTO ошибки автоматически возвращают:

400 Bad Request


---

# 12. Чего делать нельзя

Нельзя:

- возвращать raw database errors
- возвращать stack trace
- раскрывать внутренние детали системы
- использовать произвольные HTTP коды


---

# 13. Архитектурная цель

API ошибок должен быть:

- предсказуемым
- безопасным
- стабильным

Это упрощает:

frontend разработку  
mobile интеграцию  
API клиентов
