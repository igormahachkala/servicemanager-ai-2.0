import { IsISO8601, IsOptional } from 'class-validator'

export class MarkTicketChatReadDto {
  /**
   * Время последнего сообщения, которое клиент показал пользователю.
   * Без него отметка ставится временем запроса.
   */
  @IsOptional()
  @IsISO8601()
  upTo?: string
}
