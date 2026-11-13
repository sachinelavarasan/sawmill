import { useState } from 'react';
import { api } from '../api';
import { dateTime, LoadState, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  user: { name: string; username: string; role: string } | null;
}

const PAGE = 50;

export function AuditLogPage() {
  const { t } = useI18n();
  const [skip, setSkip] = useState(0);
  const { data, loading, error, reload } = useLoad(
    () => api<{ items: AuditRow[]; total: number }>(`/audit-logs?take=${PAGE}&skip=${skip}`),
    [skip],
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('auditLog')}</h1>
      </div>
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('time')}</th>
                  <th>{t('user')}</th>
                  <th>{t('action')}</th>
                  <th>{t('record')}</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTime(r.createdAt)}</td>
                    <td>{r.user ? `${r.user.name} (${r.user.username})` : '—'}</td>
                    <td>
                      <code>{r.action}</code>
                    </td>
                    <td>{r.entityType}</td>
                    <td className="muted small">{r.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && <div className="empty">{t('noData')}</div>}
          </div>
          <div className="pager">
            <button className="btn btn-small" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>
              ← {t('previous')}
            </button>
            <span className="muted small">
              {data.total === 0 ? 0 : skip + 1}–{Math.min(skip + PAGE, data.total)} / {data.total}
            </span>
            <button className="btn btn-small" disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>
              {t('next')} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
