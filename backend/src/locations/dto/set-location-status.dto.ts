import { IsBoolean } from 'class-validator';

export class SetLocationStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
