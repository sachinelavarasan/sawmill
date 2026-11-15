import { deploymentInfo, renderHealthPage, type HealthReport } from './health-page';

const report = (over: Partial<HealthReport> = {}): HealthReport => ({
  database: { ok: true, ms: 12 },
  environment: 'production',
  region: 'sin1',
  commit: 'abc1234',
  uptimeSeconds: 3_725,
  checkedAt: new Date('2026-11-15T10:00:00Z'),
  ...over,
});

describe('renderHealthPage', () => {
  it('shows an operational page with the deployment facts', () => {
    const html = renderHealthPage(report());
    expect(html).toContain('All systems operational');
    expect(html).toContain('Connected · 12 ms');
    expect(html).toContain('sin1');
    expect(html).toContain('abc1234');
    expect(html).toContain('1h 2m');
    expect(html).toContain('2026-11-15 10:00:00 UTC');
  });

  it('says so when the database is down', () => {
    const html = renderHealthPage(report({ database: { ok: false, ms: 3000 } }));
    expect(html).toContain('Database unreachable');
    expect(html).toContain('Not responding');
    expect(html).not.toContain('All systems operational');
  });

  it('escapes values taken from the environment', () => {
    const html = renderHealthPage(report({ environment: '<script>x</script>' }));
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('deploymentInfo', () => {
  it('reads the Vercel variables', () => {
    expect(deploymentInfo({ VERCEL_ENV: 'preview', VERCEL_REGION: 'sin1', VERCEL_GIT_COMMIT_SHA: 'abcdef0123456' })).toEqual({
      environment: 'preview',
      region: 'sin1',
      commit: 'abcdef0',
    });
  });

  it('falls back off Vercel', () => {
    expect(deploymentInfo({ NODE_ENV: 'development' })).toEqual({ environment: 'development', region: null, commit: null });
  });
});
