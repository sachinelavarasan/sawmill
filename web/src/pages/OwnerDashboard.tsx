import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, Icon, Kpi, LoadState, money, num3, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

interface OwnerDashboardData {
  kpis: {
    totalImportLoads: number;
    totalExportLoads: number;
    rawStockCft: number;
    finishedStockCft: number;
    todayImports: number;
    todayExports: number;
    pendingApprovals: number;
    totalSales: number;
    totalExpenses: number;
    pendingReceivables: number;
    pendingPayables: number;
    profitLoss: number;
  };
  accountantActivity: {
    accountantId: string;
    accountantName: string;
    isActive: boolean;
    lastEntryType: string | null;
    lastEntryAt: string | null;
    logsMeasured: number;
    totalCft: number;
    draftEntries: number;
    pendingEntries: number;
    approvedEntries: number;
    rejectedEntries: number;
  }[];
}

export function OwnerDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<OwnerDashboardData>('/dashboard/owner'));
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
        {!!k?.pendingApprovals && (
          <div className="banner">
            <span>{t('approvalsWaiting', { n: k.pendingApprovals })}</span>
            <Link className="banner-action" to="/approvals">
              {t('review')}
            </Link>
          </div>
        )}
      </div>
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          <h2 className="section-title">{t('operations')}</h2>
          <div className="kpi-grid">
            <Kpi label={t('totalImportLoads')} value={k.totalImportLoads} />
            <Kpi label={t('totalExportLoads')} value={k.totalExportLoads} />
            <Kpi label={t('rawStock')} value={num3(k.rawStockCft)} unit="CFT" />
            <Kpi label={t('finishedStock')} value={num3(k.finishedStockCft)} unit="CFT" />
            <Kpi label={t('todayImports')} value={k.todayImports} />
            <Kpi label={t('todayExports')} value={k.todayExports} />
            <Kpi label={t('pendingApprovals')} value={k.pendingApprovals} tone={k.pendingApprovals > 0 ? 'warn' : undefined} />
          </div>

          <h2 className="section-title">
            {t('financials')}{' '}
            <span className="lock">
              <Icon name="lock" size={12} />
              {t('ownerOnly')}
            </span>
          </h2>
          <div className="kpi-grid">
            <Kpi
              hero
              label={t('profitLoss')}
              value={money(k.profitLoss)}
              tone={k.profitLoss < 0 ? 'bad' : undefined}
              hint={`${t('totalSales')} ${money(k.totalSales)} − ${t('totalExpenses')} ${money(k.totalExpenses)}`}
            />
            <Kpi label={t('totalSales')} value={money(k.totalSales)} />
            <Kpi label={t('totalExpenses')} value={money(k.totalExpenses)} />
            <Kpi label={t('pendingReceivables')} value={money(k.pendingReceivables)} />
            <Kpi label={t('pendingPayables')} value={money(k.pendingPayables)} />
          </div>

          <h2 className="section-title">{t('accountantActivity')}</h2>
          <div className="card table-wrap">
            {data!.accountantActivity.length === 0 ? (
              <div className="empty">{t('noAccountants')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('accountant')}</th>
                    <th>{t('lastEntry')}</th>
                    <th className="num">{t('logsMeasured')}</th>
                    <th className="num">{t('totalCft')}</th>
                    <th className="num">{t('pending')}</th>
                    <th className="num">{t('approved')}</th>
                    <th className="num">{t('rejected')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.accountantActivity.map((a) => (
                    <tr key={a.accountantId}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar small">{a.accountantName.charAt(0).toUpperCase()}</span>
                          {a.accountantName}
                          {!a.isActive && <span className="status status-rejected">{t('disabled')}</span>}
                        </div>
                      </td>
                      <td>
                        {a.lastEntryType ? (
                          <>
                            {a.lastEntryType} <span className="muted small">{dateTime(a.lastEntryAt)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">{a.logsMeasured}</td>
                      <td className="num">{a.totalCft.toFixed(3)}</td>
                      <td className={`num${a.pendingEntries ? ' tone-warn' : ''}`}>{a.pendingEntries}</td>
                      <td className={`num${a.approvedEntries ? ' tone-good' : ''}`}>{a.approvedEntries}</td>
                      <td className={`num${a.rejectedEntries ? ' tone-bad' : ''}`}>{a.rejectedEntries}</td>
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
