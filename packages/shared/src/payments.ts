/**
 * Payments against a load: money paid to a supplier for an import, or received from a client
 * for an export. Each payment is its own record; the load's "paid" figure is their sum.
 */

export const PAYMENT_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

/** Paise-exact rounding for money (avoids 0.1 + 0.2 artefacts when summing payments). */
export const roundMoney = (v: number) => Math.round(v * 100) / 100;

/**
 * Nothing paid → UNPAID; paid at least the bill → PAID; otherwise PARTIAL.
 * With no bill amount yet, any payment is PARTIAL (an advance).
 */
export function paymentStatusFor(billAmount: number | null | undefined, paid: number): PaymentStatus {
  if (paid <= 0) return 'UNPAID';
  return billAmount != null && paid >= billAmount ? 'PAID' : 'PARTIAL';
}

/** What is still owed on a load; never negative (an over-payment shows as 0 here, not as credit). */
export function balanceDue(billAmount: number | null | undefined, paid: number): number {
  if (billAmount == null) return 0;
  return Math.max(0, roundMoney(billAmount - paid));
}

export interface StatementEntry {
  date: string;
  /** BILL raises what is owed; PAYMENT lowers it */
  type: 'BILL' | 'PAYMENT';
  amount: number;
}

/**
 * Running balance for a party statement: bills add, payments subtract, in date order
 * (a bill sorts before a payment made the same day). Returns the entries with `balance` after each.
 */
export function withRunningBalance<T extends StatementEntry>(entries: T[]): (T & { balance: number })[] {
  const sorted = [...entries].sort((a, b) => (a.date === b.date ? (a.type === b.type ? 0 : a.type === 'BILL' ? -1 : 1) : a.date < b.date ? -1 : 1));
  let balance = 0;
  return sorted.map((e) => {
    balance = roundMoney(balance + (e.type === 'BILL' ? e.amount : -e.amount));
    return { ...e, balance };
  });
}
