import { Transform, Type } from 'class-transformer';
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { PeriodQuery } from '../common/period';

const Clean = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListExpensesQuery extends PeriodQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take = 100;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @Clean() @IsString() @MaxLength(60) category?: string;
}

export class CreateExpenseDto {
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) @IsISO8601({ strict: true }) date: string;
  /** Free text, e.g. Labour, Electricity, Diesel, Maintenance. */
  @Clean() @IsString() @MinLength(2) @MaxLength(60) category: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999_999_999) amount: number;
  /** Optional: the import load this cost belongs to. */
  @IsOptional() @IsUUID() importLoadId?: string | null;
  @IsOptional() @Clean() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateExpenseDto {
  @IsOptional() @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) @IsISO8601({ strict: true }) date?: string;
  @IsOptional() @Clean() @IsString() @MinLength(2) @MaxLength(60) category?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999_999_999) amount?: number;
  /** null clears it */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() importLoadId?: string | null;
  @IsOptional() @Clean() @IsString() @MaxLength(1000) notes?: string;
}
