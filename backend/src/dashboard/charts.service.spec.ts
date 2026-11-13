import { lastDays, lastMonths } from './charts.service';

describe('chart axes', () => {
  it('lastDays: n days ending today, oldest first, across a month end', () => {
    expect(lastDays('2026-03-02', 4)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('lastMonths: n months ending this month, the current one capped at today, across a year end', () => {
    expect(lastMonths('2026-02-14', 3)).toEqual([
      { month: '2025-12', from: '2025-12-01', to: '2025-12-31' },
      { month: '2026-01', from: '2026-01-01', to: '2026-01-31' },
      { month: '2026-02', from: '2026-02-01', to: '2026-02-14' },
    ]);
  });
});
