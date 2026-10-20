import { IsString, IsUUID } from 'class-validator';

export class CreateEquipmentDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;
}