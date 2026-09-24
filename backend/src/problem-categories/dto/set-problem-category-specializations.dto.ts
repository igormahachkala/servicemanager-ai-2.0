import { IsArray, IsString } from 'class-validator';

export class SetProblemCategorySpecializationsDto {
  @IsArray()
  @IsString({ each: true })
  specializationIds!: string[];
}
