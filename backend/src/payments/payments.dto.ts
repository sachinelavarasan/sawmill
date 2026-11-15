import { PAYMENT_MODES, type PaymentMode } from '@timbertrail/shared';
import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../common/dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** [OWNER-ONLY] One payment to a supplier (import load) or from a client (export load). */
export class CreatePaymentDto {
  /** The day the money changed hands, in the mill's calendar; not in the future. */
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' }) @IsISO8601({ strict: true }) date: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999_999_999) amount: number;
  @IsIn(PAYMENT_MODES) mode: PaymentMode;
  /** UPI / cheque / bank transaction number */
  @Trim() @IsOptional() @IsString() @MaxLength(60) reference?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}
