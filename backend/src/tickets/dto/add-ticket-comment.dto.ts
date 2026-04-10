import { IsString } from 'class-validator'

export class AddTicketCommentDto {
  @IsString()
  comment!: string
}

