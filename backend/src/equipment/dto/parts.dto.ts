import {
  IsBoolean,
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

/**
 * SMA-EQUIPMENT-PARTS-POLISH-110C.
 * Снятие без замены. Заявка необязательна: снять деталь могут и
 * административно, при выводе оборудования из эксплуатации.
 */
export class RemovePartDto {
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsDateString()
  removedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  removalComment?: string;
}

/**
 * SMA-EQUIPMENT-PARTS-POLISH-110C.
 *
 * Исправление административных полей. Историю здесь править нельзя:
 * installedAt, removedAt, installedTicketId, removedTicketId и исполнителей
 * этот DTO не принимает намеренно — это следы произошедшего, и тихая правка
 * обесценила бы саму историю.
 */
export class CorrectInstalledPartDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  removalComment?: string;

  /** Пустая строка снимает привязку к каталогу; имя в строке остаётся. */
  @IsOptional()
  @IsString()
  partDefinitionId?: string | null;
}

/** SMA-EQUIPMENT-PARTS-POLISH-110C: правка позиции каталога и вывод из обращения. */
export class UpdatePartDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

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
  article?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  /** false — вывести из обращения. Жёсткого удаления нет: на позицию ссылается история. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
