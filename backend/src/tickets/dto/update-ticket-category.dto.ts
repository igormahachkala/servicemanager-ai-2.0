import { IsString } from 'class-validator';

export class UpdateTicketCategoryDto {
  @IsString()
  problemCategoryId!: string;
}
