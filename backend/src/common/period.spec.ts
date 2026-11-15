import { BadRequestException } from '@nestjs/common';
import { localToday, resolvePeriod } from './period';

const IST = 330;
// 13 Nov 2026, 20:00 UTC = 14 Nov 2026, 01:30 in India
const NOW = Date.parse('2026-11-13T20:00:00Z');

describe('resolvePeriod', () => {
  it('uses the mill’s local date for "today"', () => {
    expect(localToday(IST, NOW)).toBe('2026-11-14');
    expect(localToday(0, NOW)).toBe('2026-11-13');
  });

  it('defaults to the current month up to today', () => {
    const p = resolvePeriod({}, IST, NOW);
    expect(p.from).toBe('2026-11-01');
    expect(p.to).toBe('2026-11-14');
  });

  it('turns local days into UTC instants: start inclusive, end exclusive', () => {
    const p = resolvePeriod({ from: '2026-11-01', to: '2026-11-30' }, IST, NOW);
    expect(p.start.toISOString()).toBe('2026-10-31T18:30:00.000Z'); // 1 Nov 00:00 IST
    expect(p.end.toISOString()).toBe('2026-11-30T18:30:00.000Z'); // 1 Dec 00:00 IST
  });

  it('accepts a single day and rejects backwards or huge ranges', () => {
    expect(resolvePeriod({ from: '2026-11-05', to: '2026-11-05' }, IST, NOW).end.getTime() - resolvePeriod({ from: '2026-11-05', to: '2026-11-05' }, IST, NOW).start.getTime()).toBe(86_400_000);
    expect(() => resolvePeriod({ from: '2026-11-06', to: '2026-11-05' }, IST, NOW)).toThrow(BadRequestException);
    expect(() => resolvePeriod({ from: '2015-01-01', to: '2026-11-05' }, IST, NOW)).toThrow(BadRequestException);
  });
});
