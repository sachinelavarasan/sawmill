import { ApprovalStatus } from '@sawmill/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const Clean = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const Upper = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^$|^[0-9+ ]{7,15}$/;

function all(...decorators: PropertyDecorator[]): PropertyDecorator {
  return (target, key) => decorators.forEach((d) => d(target, key));
}
/** Optional free text; '' clears it. */
const Text = (max: number) => all(IsOptional(), Clean(), IsString(), MaxLength(max));
const Phone = () => all(IsOptional(), Clean(), Matches(PHONE, { message: 'Invalid mobile number' }));
const Day = () => all(Matches(DATE, { message: 'exportDate must be YYYY-MM-DD' }), IsISO8601({ strict: true }));
/** null or '' clears a timestamp. */
const When = () => all(IsOptional(), ValidateIf((_, v) => v !== null && v !== ''), IsISO8601());

export class ListExportsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsIn(Object.values(ApprovalStatus)) status?: ApprovalStatus;
  /** search: record ID, lorry number, wood type (spaces ignored) */
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

export class CreateExportDto {
  @Day() exportDate: string;
  @Upper() @IsString() @MinLength(4) @MaxLength(20) lorryNumber: string;
  /** Must match the wood type of the finished stock being loaded. */
  @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) lorryOwnerName?: string;
  @Phone() lorryOwnerMobile?: string;
  @When() startAt?: string | null;
  @When() endAt?: string | null;
  /** Default import load for new lines; each line can name its own. */
  @IsOptional() @IsUUID() importLoadId?: string | null;
  @Text(1000) notes?: string;
}

export class UpdateExportDto {
  @IsOptional() @Day() exportDate?: string;
  @IsOptional() @Upper() @IsString() @MinLength(4) @MaxLength(20) lorryNumber?: string;
  @IsOptional() @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType?: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) lorryOwnerName?: string;
  @Phone() lorryOwnerMobile?: string;
  @When() startAt?: string | null;
  @When() endAt?: string | null;
  @IsOptional() @IsUUID() importLoadId?: string | null;
  @Text(1000) notes?: string;
}

/** One measured line: CFT = T × W × L × pieces / 144, taken from one import load's finished stock. */
export class ExportLineDto {
  /** Defaults to the export's import load. */
  @IsOptional() @IsUUID() importLoadId?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) thicknessIn: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) widthIn: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) lengthFt: number;
  @IsInt() @Min(1) @Max(1_000_000) pieces: number;
}

const Money = () => all(IsOptional(), IsNumber({ maxDecimalPlaces: 2 }), Min(0), Max(999_999_999));

/** [OWNER-ONLY] Sale side of an export. Send the whole form; a missing or null field is cleared. */
export class ExportFinancialsDto {
  @IsOptional() @IsUUID() clientId?: string | null;
  @Money() sellingRatePerCft?: number | null;
  @Money() saleAmount?: number | null;
  @Money() amountReceived?: number | null;
  @Text(1000) notes?: string | null;
}
