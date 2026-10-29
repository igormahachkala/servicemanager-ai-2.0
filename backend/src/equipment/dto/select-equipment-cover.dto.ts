import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class SelectEquipmentCoverDto {
  @IsString()
  @IsNotEmpty()
  photoId!: string;

  /** Equipment.updatedAt observed in the gallery: compare-and-set, not last-write-wins. */
  @IsDateString()
  expectedVersion!: string;
}
