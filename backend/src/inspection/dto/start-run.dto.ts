import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class StartRunDto {
  @IsUUID()
  templateId!: string

  /**
   * SMA-PLANNER-V1-SCHEDULE-TO-RUN-LINK-119K.
   *
   * Заполняется, когда обход начинают по плану: техник пришёл на объект
   * и открывает запланированный визит, а не заводит обход от руки.
   *
   * Поле необязательное намеренно. Обход «от руки» — тот же обход, и он
   * должен продолжать работать ровно как раньше, без плана и без
   * бухгалтерии расписания.
   */
  @IsOptional()
  @IsUUID()
  scheduleId?: string

  @IsUUID()
  locationId!: string

  @IsOptional()
  @IsUUID()
  equipmentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string
}
