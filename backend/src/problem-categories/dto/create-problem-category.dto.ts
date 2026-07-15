import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateProblemCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
