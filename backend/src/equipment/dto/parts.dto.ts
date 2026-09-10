import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Складских полей здесь нет намеренно: ни остатка, ни цены, ни резерва.
 * Будущий шов — PartDefinition → Stock → Issue → Ticket → InstalledPart.
 */

export class CreatePartDefinitionDto {
  /** Площадка задаёт клиентский контур, которому принадлежит позиция. */
  @IsUUID()
  locationId!: string;

  @IsString()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  /** Артикул поставщика или внутренний SKU. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  article?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;
}

export class InstallPartDto {
  /** Ссылка на каталог необязательна: разовую деталь заводят по месту. */
  @IsOptional()
  @IsUUID()
  partDefinitionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  /** Строкой: дробное количество не должно потерять точность на числе с плавающей точкой. */
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsDateString()
  installedAt?: string;

  /**
   * Необязательна: первичная комплектация — административная операция,
   * и выдумывать под неё заявку нельзя. Для замены заявка обязательна.
   */
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReplacePartDto {
  @IsOptional()
  @IsUUID()
  partDefinitionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  @IsOptional()
  @IsNumberString()
  quantity?: string;

  /** Для замены обязательна — это сервисная работа, она должна быть прослеживаемой. */
  @IsUUID()
  ticketId!: string;

  @IsOptional()
  @IsDateString()
  replacedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  removalComment?: string;
}
