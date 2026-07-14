import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class UserPermissionCodesDto {
  @ApiProperty({ type: [String], example: ['TICKETS_VIEW_ALL_COMPANY'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  codes!: string[];
}

export class ReplaceLocationBindingsDto {
  @ApiProperty({ type: [String], example: ['location-id-1', 'location-id-2'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  locationIds!: string[];

  @ApiProperty({
    required: false,
    example: 'client-company-id',
    description: 'Client company contour that owns the locations. Required when provider locations cannot be inferred.',
  })
  @IsOptional()
  @IsUUID('4')
  clientCompanyId?: string;
}

export class RemoveLocationBindingsDto extends ReplaceLocationBindingsDto {}
