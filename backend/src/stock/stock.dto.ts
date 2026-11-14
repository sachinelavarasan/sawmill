import { ApprovalStatus } from '@sawmill/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const Clean = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const KINDS = ['RAW', 'FINISHED'] as const;
export type StockKind = (typeof KINDS)[number];

export class MovementsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsUUID() importLoadId?: string;
  @IsOptional() @IsIn(KINDS) kind?: StockKind;
  /** `in` = movements that added stock, `out` = movements that took stock away */
  @IsOptional() @IsIn(['in', 'out']) direction?: 'in' | 'out';
}

export class ListAdjustmentsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsIn(Object.values(ApprovalStatus)) status?: ApprovalStatus;
}

const Dim = () => (target: object, key: string | symbol) =>
  [ValidateIf((_: unknown, v: unknown) => v !== null && v !== undefined), IsNumber({ maxDecimalPlaces: 2 }), Min(0.01), Max(999)].forEach((d) =>
    d(target, key),
  );

/**
 * A correction to stock (breakage, recount, theft …). Positive adds, negative removes.
 * RAW: enter the CFT change (and optionally logs). FINISHED: give the size and the
 * pieces change; the CFT is calculated from them.
 */
export class CreateAdjustmentDto {
  @IsIn(KINDS) kind: StockKind;
  @IsUUID() importLoadId: string;
  /** Finished stock only; defaults to the load's wood type. */
  @IsOptional() @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType?: string;
  @Dim() thicknessIn?: number | null;
  @Dim() widthIn?: number | null;
  @Dim() lengthFt?: number | null;
  @IsOptional() @IsInt() @Min(-1_000_000) @Max(1_000_000) piecesDelta?: number;
  /** Raw stock only (finished CFT is calculated). */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(-1_000_000) @Max(1_000_000) cftDelta?: number;
  @Clean() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class UpdateAdjustmentDto {
  @IsOptional() @IsIn(KINDS) kind?: StockKind;
  @IsOptional() @IsUUID() importLoadId?: string;
  @IsOptional() @Clean() @IsString() @MinLength(2) @MaxLength(60) woodType?: string;
  @Dim() thicknessIn?: number | null;
  @Dim() widthIn?: number | null;
  @Dim() lengthFt?: number | null;
  @IsOptional() @IsInt() @Min(-1_000_000) @Max(1_000_000) piecesDelta?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(-1_000_000) @Max(1_000_000) cftDelta?: number;
  @IsOptional() @Clean() @IsString() @MinLength(3) @MaxLength(500) reason?: string;
}
