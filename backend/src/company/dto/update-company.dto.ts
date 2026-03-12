import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  autoAssignEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  allowTechnicianClaim?: boolean;

  @IsOptional()
  @IsBoolean()
  slaStrictMode?: boolean;
}
