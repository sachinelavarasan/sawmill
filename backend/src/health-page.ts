/**
 * The API's front page (GET /): a small status page for people — and the picture Vercel
 * shows as the deployment preview, since it screenshots the deployment's root URL.
 * Machines keep using GET /api/health (JSON).
 *
 * Deliberately shows nothing sensitive: no hostnames, connection strings or user data.
 */

export interface HealthReport {
  database: { ok: boolean; ms: number };
  /** e.g. "production", "preview", "development" */
  environment: string;
  /** Vercel region id (e.g. "sin1"), or null off Vercel */
  region: string | null;
  /** short git commit, or null when unknown */
  commit: string | null;
  uptimeSeconds: number;
  checkedAt: Date;
}

/** Collect the deployment facts from the environment (Vercel sets the VERCEL_* ones). */
export function deploymentInfo(env: Record<string, string | undefined>) {
  return {
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? 'development',
    region: env.VERCEL_REGION ?? null,
    commit: env.VERCEL_GIT_COMMIT_SHA ? env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function formatUptime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function renderHealthPage(r: HealthReport): string {
  const ok = r.database.ok;
  const headline = ok ? 'All systems operational' : 'Database unreachable';
  const rows: [string, string, 'ok' | 'down' | null][] = [
    ['API', 'Responding', 'ok'],
    ['Database', ok ? `Connected · ${r.database.ms} ms` : 'Not responding', ok ? 'ok' : 'down'],
    ['Environment', r.environment, null],
    ['Region', r.region ?? 'local', null],
    ['Commit', r.commit ?? '—', null],
    ['Uptime', formatUptime(r.uptimeSeconds), null],
  ];
  const rowHtml = rows
    .map(
      ([label, value, state]) => `
        <div class="row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${state ? `<span class="dot ${state}"></span>` : ''}${escapeHtml(value)}</dd>
        </div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>TimberTrail API · ${ok ? 'Operational' : 'Degraded'}</title>
<style>
  :root {
    --bg: #fafafa; --card: #ffffff; --fg: #111113; --muted: #6b6b73; --border: #ebebed;
    --ok: #16a34a; --ok-soft: #dcfce7; --down: #dc2626; --down-soft: #fee2e2;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0b0d; --card: #141417; --fg: #f4f4f5; --muted: #9a9aa3; --border: #26262b;
      --ok: #4ade80; --ok-soft: #12301d; --down: #f87171; --down-soft: #3a1414;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 16px;
    background: var(--bg); color: var(--fg);
    font: 15px/1.5 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { width: 100%; max-width: 560px; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .logo {
    width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
    background: var(--fg); color: var(--bg);
  }
  .brand h1 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
  .brand p { margin: 0; color: var(--muted); font-size: 13px; }
  .status {
    display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-radius: 14px;
    font-size: 19px; font-weight: 600; margin-bottom: 16px;
    background: var(--${ok ? 'ok' : 'down'}-soft); color: var(--${ok ? 'ok' : 'down'});
  }
  .pulse { width: 12px; height: 12px; border-radius: 50%; background: currentColor; flex: none;
    box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 22%, transparent); }
  dl { margin: 0; background: var(--card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 13px 20px; }
  .row + .row { border-top: 1px solid var(--border); }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 550; display: flex; align-items: center; gap: 8px; text-align: right;
    font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .dot.ok { background: var(--ok); } .dot.down { background: var(--down); }
  footer { margin-top: 16px; color: var(--muted); font-size: 12.5px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
</head>
<body>
<main>
  <div class="brand">
    <div class="logo" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2 5 12h4l-3 5h12l-3-5h4z"/><path d="M12 17v5"/>
      </svg>
    </div>
    <div>
      <h1>TimberTrail API</h1>
      <p>Service status</p>
    </div>
  </div>
  <div class="status" role="status"><span class="pulse"></span>${headline}</div>
  <dl>${rowHtml}
  </dl>
  <footer>
    <span>Checked ${escapeHtml(r.checkedAt.toISOString().replace('T', ' ').slice(0, 19))} UTC</span>
    <span>JSON: <code>/api/health</code></span>
  </footer>
</main>
</body>
</html>`;
}
