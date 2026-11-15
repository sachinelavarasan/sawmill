import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceDue, paymentStatusFor, withRunningBalance } from './payments';

test('payment status follows what has been paid against the bill', () => {
  assert.equal(paymentStatusFor(1000, 0), 'UNPAID');
  assert.equal(paymentStatusFor(1000, 400), 'PARTIAL');
  assert.equal(paymentStatusFor(1000, 1000), 'PAID');
  assert.equal(paymentStatusFor(1000, 1200), 'PAID');
});

test('a payment before the bill amount is known is an advance (partial)', () => {
  assert.equal(paymentStatusFor(null, 500), 'PARTIAL');
  assert.equal(paymentStatusFor(undefined, 0), 'UNPAID');
});

test('balance due never goes negative and has no float artefacts', () => {
  assert.equal(balanceDue(1000.3, 400.1), 600.2);
  assert.equal(balanceDue(1000, 1500), 0);
  assert.equal(balanceDue(null, 100), 0);
});

test('running balance: bills add, payments subtract, bill first on the same day', () => {
  const rows = withRunningBalance([
    { date: '2026-03-02', type: 'PAYMENT' as const, amount: 300 },
    { date: '2026-03-01', type: 'BILL' as const, amount: 1000 },
    { date: '2026-03-05', type: 'PAYMENT' as const, amount: 200 },
    { date: '2026-03-05', type: 'BILL' as const, amount: 500 },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.date, r.type, r.balance]),
    [
      ['2026-03-01', 'BILL', 1000],
      ['2026-03-02', 'PAYMENT', 700],
      ['2026-03-05', 'BILL', 1200],
      ['2026-03-05', 'PAYMENT', 1000],
    ],
  );
});
