import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class AccessDraftPreviewDto {
  @ApiProperty({ type: [String], required: false, example: ['TICKETS_ASSIGN'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additivePermissionCodes?: string[];

  @ApiProperty({ type: [String], required: false, example: ['location-id-1', 'location-id-2'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];

  @ApiProperty({ type: [String], required: false, example: ['client-company-id'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedClientContourIds?: string[];
}

export class GroupedLocationBindingReplacementDto {
  @ApiProperty({
    enum: ['REPLACE_SELECTED', 'CLEAR_RESTRICTED_EMPTY', 'NO_CHANGE'],
    example: 'REPLACE_SELECTED',
  })
  @IsIn(['REPLACE_SELECTED', 'CLEAR_RESTRICTED_EMPTY', 'NO_CHANGE'])
  mode!: 'REPLACE_SELECTED' | 'CLEAR_RESTRICTED_EMPTY' | 'NO_CHANGE';

  @ApiProperty({ required: false, example: 'client-company-id' })
  @IsOptional()
  @IsUUID('4')
  clientCompanyId?: string;

  @ApiProperty({ type: [String], required: false, example: ['location-id-1', 'location-id-2'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];
}

export class ReplaceAllLocationBindingsDto {
  @ApiProperty({ type: [GroupedLocationBindingReplacementDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => GroupedLocationBindingReplacementDto)
  groups!: GroupedLocationBindingReplacementDto[];
}
