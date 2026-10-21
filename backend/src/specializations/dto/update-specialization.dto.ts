import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSpecializationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
