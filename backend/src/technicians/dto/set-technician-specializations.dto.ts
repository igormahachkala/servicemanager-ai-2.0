import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SetTechnicianSpecializationsDto {
  @ApiProperty({
    description: 'Список ID специализаций, которые назначаются технику. Пустой массив снимает все специализации.',
    example: ['c7b1a9d2-1a2b-4c3d-9e10-111213141516'],
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsString({ each: true })
  specializationIds!: string[];
}
