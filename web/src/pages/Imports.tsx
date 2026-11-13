import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, Icon, LoadState, num3, StatusBadge, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

export interface ImportSummary {
  id: string;
  code: string;
  arrivalAt: string;
  lorryNumber: string;
  woodType: string;
  totalLogs: number;
  totalCft: number;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
}

/** The fields a person types for an import load. Empty string = not filled in. */
export interface ImportForm {
  arrivalAt: string; // datetime-local value
  lorryNumber: string;
  woodType: string;
  woodCategory: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  originLocation: string;
  notes: string;
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

export const emptyImportForm = (): ImportForm => ({
  arrivalAt: toLocalInput(new Date()),
  lorryNumber: '',
  woodType: '',
  woodCategory: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  originLocation: '',
  notes: '',
});

export const importFormBody = (f: ImportForm) => JSON.stringify({ ...f, arrivalAt: fromLocalInput(f.arrivalAt) });

const PAGE = 50;
const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;

/** `/imports` lists every load; `/measurement` (openOnly) lists the ones still being measured. */
export function ImportsPage({ openOnly = false }: { openOnly?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [status, setStatus] = useState('');
  const [skip, setSkip] = useState(0);
  const query = `take=${PAGE}&skip=${skip}${openOnly ? '&open=1' : status ? `&status=${status}` : ''}`;
  const { data, loading, error, reload } = useLoad(
    () => api<{ items: ImportSummary[]; total: number }>(`/imports?${query}`),
    [query],
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t(openOnly ? 'measurement' : 'imports')}</h1>
        <div className="head-tools">
          {!openOnly && (
            <select
              className="select"
              aria-label={t('status')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setSkip(0);
              }}
            >
              <option value="">{t('allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(s === 'SUBMITTED' ? 'pending' : (s.toLowerCase() as 'draft' | 'approved' | 'rejected'))}
                </option>
              ))}
            </select>
          )}
          <Link className="btn btn-primary" to="/imports/new">
            + {t('newImport')}
          </Link>
        </div>
      </div>

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card table-wrap">
            {data.items.length === 0 ? (
              <div className="empty">{t(openOnly ? 'noOpenLoads' : 'noImports')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('importId')}</th>
                    <th className="hide-sm">{t('arrival')}</th>
                    <th className="hide-sm">{t('lorry')}</th>
                    <th className="hide-sm">{t('woodType')}</th>
                    <th className="num hide-sm">{t('logs')}</th>
                    <th className="num">{t('totalCft')}</th>
                    <th>{t('status')}</th>
                    {isOwner && <th className="hide-sm">{t('createdBy')}</th>}
                    <th className="hide-sm" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link className="row-link" to={`/imports/${l.id}`}>
                          {l.code}
                        </Link>
                        <div className="muted small show-sm">{l.lorryNumber}</div>
                      </td>
                      <td className="hide-sm">{dateTime(l.arrivalAt)}</td>
                      <td className="hide-sm">{l.lorryNumber}</td>
                      <td className="hide-sm">{l.woodType}</td>
                      <td className="num hide-sm">{l.totalLogs}</td>
                      <td className="num">{num3(l.totalCft)}</td>
                      <td>
                        <StatusBadge status={l.status} />
                      </td>
                      {isOwner && <td className="hide-sm">{l.createdByName}</td>}
                      <td className="actions hide-sm">
                        <Link className="btn btn-small" to={`/imports/${l.id}${openOnly ? '#logs' : ''}`}>
                          {openOnly && <Icon name="measurement" size={16} />}
                          {t(openOnly ? 'measure' : 'open')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {data.total > PAGE && (
            <div className="pager">
              <button className="btn btn-small" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>
                ← {t('previous')}
              </button>
              <span className="muted small">
                {skip + 1}–{Math.min(skip + PAGE, data.total)} / {data.total}
              </span>
              <button className="btn btn-small" disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>
                {t('next')} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The import form fields, shared by "New Import" and the edit panel on the detail page. */
export function ImportFields({ form, onChange }: { form: ImportForm; onChange: (f: ImportForm) => void }) {
  const { t } = useI18n();
  const set = (k: keyof ImportForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  return (
    <div className="form-grid">
      <label className="field">
        <span>{t('lorryNumber')} *</span>
        <input value={form.lorryNumber} onChange={set('lorryNumber')} required minLength={4} maxLength={20} autoCapitalize="characters" placeholder="TN 45 AB 1234" />
      </label>
      <label className="field">
        <span>{t('woodType')} *</span>
        <input value={form.woodType} onChange={set('woodType')} required minLength={2} maxLength={60} />
        <small className="muted">{t('woodTypeHint')}</small>
      </label>
      <label className="field">
        <span>{t('arrivalDateTime')}</span>
        <input type="datetime-local" value={form.arrivalAt} onChange={set('arrivalAt')} required />
      </label>
      <label className="field">
        <span>{t('woodCategory')}</span>
        <input value={form.woodCategory} onChange={set('woodCategory')} maxLength={60} />
      </label>
      <label className="field">
        <span>{t('driverName')}</span>
        <input value={form.driverName} onChange={set('driverName')} maxLength={100} />
      </label>
      <label className="field">
        <span>{t('driverMobile')}</span>
        <input value={form.driverMobile} onChange={set('driverMobile')} inputMode="tel" maxLength={15} />
      </label>
      <label className="field">
        <span>{t('lorryOwnerName')}</span>
        <input value={form.lorryOwnerName} onChange={set('lorryOwnerName')} maxLength={100} />
      </label>
      <label className="field">
        <span>{t('lorryOwnerMobile')}</span>
        <input value={form.lorryOwnerMobile} onChange={set('lorryOwnerMobile')} inputMode="tel" maxLength={15} />
      </label>
      <label className="field">
        <span>{t('originLocation')}</span>
        <input value={form.originLocation} onChange={set('originLocation')} maxLength={120} />
      </label>
      <label className="field field-wide">
        <span>{t('notes')}</span>
        <input value={form.notes} onChange={set('notes')} maxLength={1000} />
      </label>
    </div>
  );
}

export function NewImportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyImportForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/imports', { method: 'POST', body: importFormBody(form) });
      navigate(`/imports/${created.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link className="back-link" to="/imports">
            ← {t('imports')}
          </Link>
          <h1>{t('newImport')}</h1>
        </div>
      </div>
      <form className="card form-card" onSubmit={submit}>
        <ImportFields form={form} onChange={setForm} />
        {error && <div className="notice notice-error">{error}</div>}
        <div className="form-actions">
          <Link className="btn btn-ghost" to="/imports">
            {t('cancel')}
          </Link>
          <button className="btn btn-primary" disabled={busy}>
            {t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
