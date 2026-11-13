import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

/** Line icons: a 24×24 stroke path, coloured by the surrounding text. */
export const ICONS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  imports: 'M12 3v11m0 0l-4-4m4 4l4-4M4 17v3h16v-3',
  measurement: 'M3 8h18v8H3zM7 8v3M11 8v4M15 8v3',
  production: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  stock: 'M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5',
  exports: 'M12 14V3m0 0L8 7m4-4l4 4M4 17v3h16v-3',
  reports: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6',
  approvals: 'M4 12l5 5L20 6',
  clients: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  suppliers: 'M2 6h11v10H2zM13 10h5l3 3v3h-8zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  accounts: 'M7 4h10M7 9h10M7 4c7 0 7 9 0 9l8 7',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 4.5a3.5 3.5 0 010 6.5M19 15c2 .8 3 2.4 3 5',
  audit: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 14 ? 2.3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const label = theme === 'dark' ? t('lightTheme') : t('darkTheme');
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={toggle}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
        EN
      </button>
      <button className={lang === 'ta' ? 'on' : ''} onClick={() => setLang('ta')}>
        தமிழ்
      </button>
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  tone,
  hint,
  hero,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'warn' | 'good' | 'bad';
  hint?: ReactNode;
  /** Wide, filled card for the one number that matters most on the page. */
  hero?: boolean;
}) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ''}${hero ? ' kpi-hero' : ''}`}>
      <div className="kpi-label">
        {tone && !hero && <span className="kpi-dot" />}
        {label}
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, Parameters<typeof t>[0]> = {
    DRAFT: 'draft',
    SUBMITTED: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  };
  return <span className={`status status-${status.toLowerCase()}`}>{map[status] ? t(map[status]) : status}</span>;
}

/** Tiny data loader with loading / error / retry states. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    run()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  if (error)
    return (
      <div className="notice notice-error">
        {t('error')}: {error}{' '}
        <button type="button" className="btn btn-small" onClick={onRetry}>
          {t('retry')}
        </button>
      </div>
    );
  if (loading) return <div className="muted">{t('loading')}</div>;
  return null;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (n: number) => inr.format(n);
export const num3 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const cft = (n: number) => `${n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} CFT`;
export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
