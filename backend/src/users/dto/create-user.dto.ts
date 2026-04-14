import { UserRole } from '@prisma/client';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  locationIds?: string[];
}
