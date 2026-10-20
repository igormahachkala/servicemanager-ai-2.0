import { ApiProperty } from '@nestjs/swagger';
import { CompanyType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class MatrixChangeDto {
  @ApiProperty({ enum: UserRole, example: 'ADMIN' })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ enum: CompanyType, nullable: true, example: 'CLIENT', description: 'null = wildcard' })
  @IsOptional()
  @IsIn([CompanyType.CLIENT, CompanyType.PROVIDER, null])
  companyType!: CompanyType | null;

  @ApiProperty({ type: [String], example: ['TICKETS_ASSIGN'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  add?: string[];

  @ApiProperty({ type: [String], example: ['USERS_MANAGE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  remove?: string[];
}

export class UpdateMatrixDto {
  @ApiProperty({ type: [MatrixChangeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MatrixChangeDto)
  changes!: MatrixChangeDto[];
}
