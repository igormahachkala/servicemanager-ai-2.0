import {
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  @MaxLength(300)
  name!: string;

  @IsString()
  @MaxLength(30)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MaterialQuantityDto {
  @IsUUID()
  materialId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class IssueMaterialDto extends MaterialQuantityDto {
  @IsUUID()
  technicianId!: string;
}

export class PurchaseMaterialDto extends MaterialQuantityDto {
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @IsOptional()
  @IsNumberString()
  totalAmount?: string;
}

export class ConsumeMaterialDto extends MaterialQuantityDto {
  @IsUUID()
  ticketId!: string;

  @IsOptional()
  @IsUUID()
  linkedClientCompanyId?: string;
}
