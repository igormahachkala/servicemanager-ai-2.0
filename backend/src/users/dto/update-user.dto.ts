import { UserRole } from '@prisma/client';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];
}
