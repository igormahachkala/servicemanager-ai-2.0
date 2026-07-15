import { IsUUID } from 'class-validator'

export class ImpersonateDto {
  @IsUUID()
  companyId!: string
}
