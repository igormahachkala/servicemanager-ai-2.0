import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEquipmentDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;

  // SMA-EQUIPMENT-V2-110A: паспортные поля. Все необязательные — карточка
  // заполняется постепенно, а не одним заходом.
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
}
