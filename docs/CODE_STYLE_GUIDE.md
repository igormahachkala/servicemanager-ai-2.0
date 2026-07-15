# CODE STYLE GUIDE — ServiceManager.AI

Этот документ описывает правила написания кода
для проекта ServiceManager.AI.

Цель:

- единый стиль кода
- предсказуемая структура
- облегчение поддержки
- упрощение работы новых разработчиков


---

# 1. Общие правила

Код должен быть:

- читаемым
- предсказуемым
- модульным
- безопасным

Нельзя:

- писать огромные функции
- смешивать бизнес-логику и контроллеры
- писать сложный код без комментариев


---

# 2. Структура NestJS модуля

Каждый модуль должен иметь структуру:

module-name/
    module-name.module.ts
    module-name.controller.ts
    module-name.service.ts
    dto/
    guards/
    decorators/

Не допускается:

- хранить DTO в корне проекта
- смешивать DTO разных модулей


---

# 3. Именование файлов

Используется:

kebab-case

Примеры:

tickets.service.ts  
tickets.controller.ts  
create-ticket.dto.ts  
update-ticket.dto.ts


---

# 4. Именование классов

Используется:

PascalCase

Примеры:

TicketsService  
TicketsController  
CreateTicketDto  
UpdateTicketDto


---

# 5. Именование переменных

Используется:

camelCase

Примеры:

ticketId  
companyId  
assignedTechnicianId  
problemCategoryId  


---

# 6. DTO правила

DTO должны:

- использовать class-validator
- иметь строгую типизацию
- содержать только необходимые поля

Пример DTO:

export class CreateTicketDto {

  @IsString()
  problemText: string

  @IsString()
  problemCategoryId: string

}


---

# 7. Controller правила

Controller:

- не содержит бизнес логики
- только принимает запрос
- передает данные в service

Плохой пример:

Controller делает сложную логику.

Хороший пример:

@Post()
create(@Body() dto: CreateTicketDto) {
  return this.ticketsService.create(dto)
}


---

# 8. Service правила

Service содержит:

- бизнес логику
- работу с Prisma
- проверки

Пример:

async create(dto: CreateTicketDto, companyId: string) {

  const ticket = await this.prisma.ticket.create({
    data: {
      ...dto,
      companyId
    }
  })

  return ticket
}


---

# 9. Prisma правила

Все запросы к базе должны выполняться
через Prisma ORM.

Запрещено:

- raw SQL без крайней необходимости
- прямой доступ к DB


---

# 10. Multi-tenant правило

Все запросы должны учитывать:

companyId

Пример:

where: {
  id: ticketId,
  companyId: companyId
}

Это предотвращает
cross-company доступ.


---

# 11. Ошибки

Использовать NestJS exceptions:

BadRequestException  
UnauthorizedException  
ForbiddenException  
NotFoundException  

Нельзя:

throw new Error()


---

# 12. Асинхронный код

Использовать:

async / await

Нельзя:

- nested promises
- цепочки then()


---

# 13. Логи

Использовать:

NestJS Logger

Не использовать:

console.log

в production коде.


---

# 14. Импорты

Импорты должны быть упорядочены:

1. NestJS
2. External packages
3. Project modules

Пример:

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'


---

# 15. Максимальный размер файлов

Рекомендуется:

Service:

≤ 400 строк

Controller:

≤ 200 строк

Если файл становится больше —
логику нужно разделять.


---

# 16. Комментарии

Комментарии должны объяснять:

почему код написан так.

Не писать очевидные комментарии.


---

# 17. Архитектурный принцип

ServiceManager.AI — production SaaS.

Код должен быть:

- масштабируемым
- безопасным
- предсказуемым
