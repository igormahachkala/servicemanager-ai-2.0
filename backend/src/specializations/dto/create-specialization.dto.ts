import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSpecializationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
