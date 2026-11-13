import { api } from '../api';
import { useAuth } from '../auth';
import { Kpi, LoadState, StatusBadge, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

interface AccountantDashboardData {
  kpis: {
    todayImports: number;
    todayExports: number;
    draftEntries: number;
    pendingSubmissions: number;
    approvedEntries: number;
    rejectedEntries: number;
  };
  measurementProgress: {
    id: string;
    code: string;
    lorryNumber: string;
    woodType: string;
    totalLogs: number;
    totalCft: number;
    status: string;
    rejectionReason: string | null;
  }[];
}

export function AccountantDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<AccountantDashboardData>('/dashboard/accountant'));
  const k = data?.kpis;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('dashboard')}</h1>
          <p className="muted">
            {t('welcome')}, {user?.name}
          </p>
        </div>
      </div>
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          <div className="kpi-grid">
            <Kpi label={t('todayImports')} value={k.todayImports} />
            <Kpi label={t('todayExports')} value={k.todayExports} />
            <Kpi label={t('draftEntries')} value={k.draftEntries} />
            <Kpi label={t('pendingSubmissions')} value={k.pendingSubmissions} tone={k.pendingSubmissions ? 'warn' : undefined} />
            <Kpi label={t('approvedEntries')} value={k.approvedEntries} tone="good" />
            <Kpi label={t('rejectedEntries')} value={k.rejectedEntries} tone={k.rejectedEntries ? 'bad' : undefined} />
          </div>

          <h2 className="section-title">{t('measurementProgress')}</h2>
          <div className="card table-wrap">
            {data!.measurementProgress.length === 0 ? (
              <div className="empty">{t('noData')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('lorry')}</th>
                    <th>{t('woodType')}</th>
                    <th className="num">{t('logs')}</th>
                    <th className="num">{t('totalCft')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.measurementProgress.map((l) => (
                    <tr key={l.id}>
                      <td>{l.code}</td>
                      <td>{l.lorryNumber}</td>
                      <td>{l.woodType}</td>
                      <td className="num">{l.totalLogs}</td>
                      <td className="num">{l.totalCft.toFixed(3)}</td>
                      <td>
                        <StatusBadge status={l.status} />
                        {l.rejectionReason && <div className="muted small">{l.rejectionReason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
