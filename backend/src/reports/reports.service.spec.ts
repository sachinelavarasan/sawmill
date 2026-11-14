import ExcelJS from 'exceljs';
import type { AuthUser } from '../common/types';
import { ReportsService } from './reports.service';

const owner: AuthUser = { id: 'u1', millId: 'm1', name: 'Owner', username: 'owner', role: 'OWNER' };
const accountant: AuthUser = { ...owner, id: 'u2', role: 'ACCOUNTANT' };

/** The service with no database: only list() and the Excel writer are exercised. */
const service = () => new ReportsService(null as never, null as never, null as never);

describe('ReportsService.list', () => {
  it('offers financial reports to the owner only', () => {
    const ownerKeys = service().list(owner).map((r) => r.key);
    const accKeys = service().list(accountant).map((r) => r.key);
    expect(ownerKeys).toEqual(['imports', 'production', 'exports', 'stock', 'pnl', 'payables', 'receivables', 'expenses']);
    expect(accKeys).toEqual(['imports', 'production', 'exports', 'stock']);
  });

  it('treats object built-ins as unknown reports, not a server error', async () => {
    for (const key of ['constructor', '__proto__', 'toString', 'nope']) {
      await expect(service().run(owner, key, {})).rejects.toThrow('Report not found');
    }
  });

  it('translates titles', () => {
    expect(service().list(owner, 'ta').find((r) => r.key === 'pnl')?.title).toBe('லாப நஷ்ட அறிக்கை');
  });
});

describe('ReportsService.excel', () => {
  it('writes title, period, a coloured header, typed cells and a totals row', async () => {
    const s = service();
    jest.spyOn(s, 'run').mockResolvedValue({
      key: 'imports',
      title: 'Import Register',
      millName: 'Test Mill',
      group: 'operational',
      periodic: true,
      statusFilter: true,
      period: { from: '2026-11-01', to: '2026-11-30' },
      approvedOnly: true,
      generatedAt: '2026-11-13T10:00:00.000Z',
      columns: [
        { key: 'code', label: 'Import ID', type: 'text', total: false },
        { key: 'arrivalAt', label: 'Arrival', type: 'datetime', total: false },
        { key: 'totalLogs', label: 'Logs', type: 'int', total: true },
        { key: 'totalCft', label: 'Total CFT', type: 'cft', total: true },
      ],
      rows: [
        { code: 'IMP-2026-0001', arrivalAt: '2026-11-02T05:30:00.000Z', totalLogs: 4, totalCft: 10 },
        { code: 'IMP-2026-0002', arrivalAt: '2026-11-03T05:30:00.000Z', totalLogs: 2, totalCft: 5.25 },
      ],
      totals: { totalLogs: 6, totalCft: 15.25 },
      totalLabel: 'Total',
    });

    const { filename, buffer } = await s.excel(owner, 'imports', { from: '2026-11-01', to: '2026-11-30' });
    expect(filename).toBe('imports_2026-11-01_2026-11-30.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Import Register');
    expect(ws.getCell('A1').value).toBe('Test Mill');
    expect(ws.getCell('A2').value).toBe('Import Register');
    expect(String(ws.getCell('A3').value)).toContain('2026-11-01 – 2026-11-30');
    expect(ws.getRow(5).values).toEqual([undefined, 'Import ID', 'Arrival', 'Logs', 'Total CFT']);
    expect(ws.getCell('B6').value).toBeInstanceOf(Date);
    expect(ws.getCell('D7').value).toBe(5.25);
    expect(ws.getColumn(4).numFmt).toBe('#,##0.000');
    expect(ws.getRow(8).values).toEqual([undefined, 'Total', undefined, 6, 15.25]);
  });
});
