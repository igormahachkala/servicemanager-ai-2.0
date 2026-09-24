import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inventoryNumber?: string;

  @IsOptional()
  @IsDateString()
  commissionedAt?: string;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  /** Обложка карточки: id снимка из вложений этой же единицы либо null. */
  @IsOptional()
  @IsString()
  mainPhotoId?: string | null;
}
