import { IsOptional, IsString, IsUUID } from 'class-validator'

export class AddTicketCommentDto {
  @IsString()
  comment!: string

  /**
   * SMA-TICKET-REPLY-V1-BACKEND-FOUNDATION-120H.
   *
   * Ответ на другое сообщение той же заявки. Имя поля comment не меняется:
   * старые клиенты продолжают присылать только его, и для них поведение
   * ровно прежнее.
   *
   * Значение доступа не даёт. Цель проверяется на сервере уже после того,
   * как разрешён доступ к самой заявке, и только внутри неё.
   */
  @IsOptional()
  @IsUUID()
  replyToId?: string
}
