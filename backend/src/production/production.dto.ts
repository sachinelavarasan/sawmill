import { ApprovalStatus } from '@sawmill/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const Clean = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Optional free text; '' clears it. */
function Text(max: number): PropertyDecorator {
  return (target, key) => [IsOptional(), Clean(), IsString(), MaxLength(max)].forEach((d) => d(target, key));
}

/** CFT with up to 3 decimals; null clears it. */
function Cft(): PropertyDecorator {
  return (target, key) =>
    [ValidateIf((_, v) => v !== null && v !== undefined), IsNumber({ maxDecimalPlaces: 3 }), Min(0.001), Max(1_000_000)].forEach((d) =>
      d(target, key),
    );
}

export class ListProductionQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsIn(Object.values(ApprovalStatus)) status?: ApprovalStatus;
  @IsOptional() @IsUUID() importLoadId?: string;
  /** search: record ID, import ID, wood type (spaces ignored) */
  @IsOptional() @IsString() @MaxLength(60) q?: string;
}

export class CreateProductionDto {
  /** The approved import load whose raw stock is being sawn. */
  @IsUUID() importLoadId: string;
  @Matches(DATE, { message: 'productionDate must be YYYY-MM-DD' }) @IsISO8601({ strict: true }) productionDate: string;
  @Text(100) cuttingMachine?: string;
  @Text(100) machineOperator?: string;
  @Text(500) workerDetails?: string;
  @IsOptional() @IsISO8601() startAt?: string;
  @IsOptional() @IsISO8601() endAt?: string;
  /** Raw CFT taken from the load for this run. Can be filled in later, but is needed to submit. */
  @Cft() inputCft?: number | null;
  @Text(1000) wasteNotes?: string;
}

export class UpdateProductionDto {
  @IsOptional() @IsUUID() importLoadId?: string;
  @IsOptional() @Matches(DATE, { message: 'productionDate must be YYYY-MM-DD' }) @IsISO8601({ strict: true }) productionDate?: string;
  @Text(100) cuttingMachine?: string;
  @Text(100) machineOperator?: string;
  @Text(500) workerDetails?: string;
  /** '' or null clears it. */
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601() startAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601() endAt?: string | null;
  @Cft() inputCft?: number | null;
  @Text(1000) wasteNotes?: string;
}

/** One finished size: CFT = T × W × L × pieces / 144. */
export class OutputDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) thicknessIn: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) widthIn: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999) lengthFt: number;
  @IsInt() @Min(1) @Max(1_000_000) pieces: number;
}
