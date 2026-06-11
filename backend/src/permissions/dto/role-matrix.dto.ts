import { ApiProperty } from '@nestjs/swagger';
import { CompanyType, UserRole } from '@prisma/client';

/**
 * Одна строка матрицы: (role, companyType) → список кодов прав.
 * companyType = null означает wildcard (применяется к любому типу компании).
 */
export class RoleMatrixEntryDto {
  @ApiProperty({ enum: UserRole, example: 'ADMIN' })
  role!: UserRole;

  @ApiProperty({
    enum: CompanyType,
    nullable: true,
    example: 'CLIENT',
    description: 'Тип компании; null = wildcard (любой тип)',
  })
  companyType!: CompanyType | null;

  @ApiProperty({ type: [String], example: ['TICKETS_VIEW', 'TICKETS_CREATE'] })
  permissions!: string[];
}

export class RoleMatrixResponseDto {
  @ApiProperty({ type: [RoleMatrixEntryDto] })
  roles!: RoleMatrixEntryDto[];
}
