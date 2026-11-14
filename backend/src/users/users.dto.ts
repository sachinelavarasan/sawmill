import { Role } from '@sawmill/shared';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../common/dto';

// bcrypt only uses the first 72 bytes, so longer passwords would be silently cut
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = 'Password must be 8–72 characters with letters and numbers';

export class CreateUserDto {
  @Trim() @IsString() @MinLength(2) @MaxLength(100) name: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,32}$/, { message: 'Username: 3–32 letters, numbers, . _ -' })
  username: string;

  @IsOptional() @IsString() @Matches(/^[0-9+ ]{7,15}$/, { message: 'Invalid mobile number' }) phone?: string;

  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;

  @IsOptional() @IsIn(Object.values(Role)) role?: Role;

  @IsOptional() @IsIn(['en', 'ta']) preferredLanguage?: string;
}

export class UpdateUserDto {
  @IsOptional() @Trim() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @Matches(/^[0-9+ ]{7,15}$/, { message: 'Invalid mobile number' }) phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(Object.values(Role)) role?: Role;
  @IsOptional() @IsIn(['en', 'ta']) preferredLanguage?: string;
}

export class ResetPasswordDto {
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MSG }) password: string;
}
