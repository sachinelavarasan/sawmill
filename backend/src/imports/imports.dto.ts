import { ApprovalStatus } from '@sawmill/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const PHONE = /^[0-9+ ]{7,15}$/;
const PHONE_MSG = 'Invalid mobile number';

/** Trim strings; an empty string means "clear this field". */
const Clean = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const Upper = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
/** Optional text that may also be sent as '' to clear it. */
const OptionalText = (max: number) => [IsOptional(), Clean(), IsString(), MaxLength(max)] as const;

function applyAll(decorators: readonly PropertyDecorator[]): PropertyDecorator {
  return (target, key) => decorators.forEach((d) => d(target, key));
}
const Text = (max: number) => applyAll(OptionalText(max));
const Phone = () =>
  applyAll([IsOptional(), Clean(), Matches(new RegExp(`^$|${PHONE.source}`), { message: PHONE_MSG })]);

export class ListImportsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsIn(Object.values(ApprovalStatus)) status?: ApprovalStatus;
  /** `1` = only loads that can still be edited / measured (Draft or Rejected). */
  @IsOptional() @IsIn(['0', '1']) open?: string;
  /** search: record ID, lorry number, wood type (spaces ignored) */
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

export class CreateImportDto {
  /** Defaults to "now" on the server. */
  @IsOptional() @IsISO8601() arrivalAt?: string;
  @Upper() @IsString() @MinLength(4) @MaxLength(20) lorryNumber: string;
  @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType: string;
  @Text(60) woodCategory?: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) lorryOwnerName?: string;
  @Phone() lorryOwnerMobile?: string;
  @Text(120) originLocation?: string;
  @Text(1000) notes?: string;
}

export class UpdateImportDto {
  @IsOptional() @IsISO8601() arrivalAt?: string;
  @IsOptional() @Upper() @IsString() @MinLength(4) @MaxLength(20) lorryNumber?: string;
  @IsOptional() @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType?: string;
  @Text(60) woodCategory?: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) lorryOwnerName?: string;
  @Phone() lorryOwnerMobile?: string;
  @Text(120) originLocation?: string;
  @Text(1000) notes?: string;
}

export class CreateUnloadingDto {
  @Upper() @IsString() @MinLength(2) @MaxLength(20) vehicleNumber: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) vehicleOwnerName?: string;
  /** Defaults to "now" — the phone app starts the clock when unloading begins. */
  @IsOptional() @IsISO8601() startAt?: string;
  @IsOptional() @IsISO8601() endAt?: string;
  /** Defaults to the mill's standard rate. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) ratePerHour?: number;
}

export class UpdateUnloadingDto {
  @IsOptional() @Upper() @IsString() @MinLength(2) @MaxLength(20) vehicleNumber?: string;
  @Text(100) driverName?: string;
  @Phone() driverMobile?: string;
  @Text(100) vehicleOwnerName?: string;
  @IsOptional() @IsISO8601() startAt?: string;
  @IsOptional() @IsISO8601() endAt?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) ratePerHour?: number;
}

/** Girth in inches, length in feet — the two numbers the CFT formula needs. */
export class LogDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) girthIn: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) lengthFt: number;
}

/** Why the owner sent a load back; shown to the accountant. */
export class RejectDto {
  @Clean() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

const Money = () => applyAll([IsOptional(), IsNumber({ maxDecimalPlaces: 2 }), Min(0), Max(999_999_999)]);

/** [OWNER-ONLY] Purchase side of a load. Send the whole form; a missing or null field is cleared. */
export class FinancialsDto {
  @IsOptional() @IsUUID() supplierId?: string | null;
  @Money() purchaseRatePerCft?: number | null;
  @Money() purchaseAmount?: number | null;
  @Money() transportCharges?: number | null;
  @Money() amountPaid?: number | null;
  @Text(1000) notes?: string | null;
}
