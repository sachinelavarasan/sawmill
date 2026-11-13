import { formatDuration, importLogCft, Permission } from '@sawmill/shared';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, Icon, Kpi, LoadState, money, num3, StatusBadge, useLoad } from '../components/ui';
import { useI18n } from '../i18n';
import { fromLocalInput, ImportFields, ImportForm, importFormBody, ImportSummary, toLocalInput } from './Imports';

interface Unloading {
  id: string;
  vehicleNumber: string;
  driverName: string | null;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  ratePerHour: number | null;
  totalCharges: number | null;
}
interface Log {
  id: string;
  logNumber: number;
  girthIn: number;
  lengthFt: number;
  cft: number;
}
interface ImportDetail extends ImportSummary {
  woodCategory: string | null;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  originLocation: string | null;
  notes: string | null;
  editable: boolean;
  defaultUnloadingRate: number | null;
  unloadings: Unloading[];
  logs: Log[];
}

/** A positive number typed by the user, or null while the field is empty / invalid. */
const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const errorText = (e: unknown) => (e as Error).message;

export function ImportDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { can } = useAuth();
  const { hash } = useLocation();
  const { data: load, loading, error, reload } = useLoad(() => api<ImportDetail>(`/imports/${id}`), [id]);

  // Arriving from the Measurement list: jump straight to log entry.
  const loaded = !!load;
  useEffect(() => {
    if (loaded && hash === '#logs') document.getElementById('logs')?.scrollIntoView();
  }, [loaded, hash]);

  const unloadingTotal = load?.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0) ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link className="back-link" to="/imports">
            ← {t('imports')}
          </Link>
          <h1 className="title-row">
            {load?.code ?? t('importDetails')}
            {load && <StatusBadge status={load.status} />}
          </h1>
          {load && (
            <p className="muted">
              {t('lorry')} {load.lorryNumber} · {load.woodType} · {dateTime(load.arrivalAt)}
            </p>
          )}
        </div>
      </div>

      <LoadState loading={loading && !load} error={error} onRetry={reload} />

      {load && (
        <>
          {!load.editable && <div className="notice notice-info">{t('lockedRecord')}</div>}
          {load.rejectionReason && <div className="notice notice-error">{load.rejectionReason}</div>}

          <div className="kpi-grid">
            <Kpi label={t('logsMeasured')} value={load.totalLogs} />
            <Kpi label={t('totalCft')} value={num3(load.totalCft)} unit="CFT" />
            <Kpi label={t('totalUnloadingCharges')} value={money(unloadingTotal)} />
          </div>

          <DetailsSection load={load} onSaved={reload} />
          <UnloadingSection load={load} onChanged={reload} />
          {can(Permission.FINANCE_VIEW) && <PurchaseSection load={load} canPickSupplier={can(Permission.SUPPLIERS_MANAGE)} />}
          <LogsSection load={load} onChanged={reload} />
        </>
      )}
    </div>
  );
}

function Section({ title, tools, children }: { title: ReactNode; tools?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {tools}
      </div>
      {children}
    </>
  );
}

// ───────── details ─────────

function DetailsSection({ load, onSaved }: { load: ImportDetail; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<ImportForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () =>
    setForm({
      arrivalAt: toLocalInput(load.arrivalAt),
      lorryNumber: load.lorryNumber,
      woodType: load.woodType,
      woodCategory: load.woodCategory ?? '',
      driverName: load.driverName ?? '',
      driverMobile: load.driverMobile ?? '',
      lorryOwnerName: load.lorryOwnerName ?? '',
      lorryOwnerMobile: load.lorryOwnerMobile ?? '',
      originLocation: load.originLocation ?? '',
      notes: load.notes ?? '',
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/imports/${load.id}`, { method: 'PATCH', body: importFormBody(form) });
      setForm(null);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, string | null][] = [
    [t('driverName'), load.driverName],
    [t('driverMobile'), load.driverMobile],
    [t('lorryOwnerName'), load.lorryOwnerName],
    [t('lorryOwnerMobile'), load.lorryOwnerMobile],
    [t('originLocation'), load.originLocation],
    [t('woodCategory'), load.woodCategory],
    [t('createdBy'), load.createdByName],
    [t('notes'), load.notes],
  ];

  return (
    <Section
      title={t('importDetails')}
      tools={
        load.editable &&
        !form && (
          <button className="btn btn-small" onClick={startEdit}>
            {t('edit')}
          </button>
        )
      }
    >
      {form ? (
        <form className="card form-card" onSubmit={submit}>
          <ImportFields form={form} onChange={setForm} />
          {error && <div className="notice notice-error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {t('save')}
            </button>
          </div>
        </form>
      ) : (
        <dl className="card facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

// ───────── unloading ─────────

function UnloadingSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const blank = () => ({
    vehicleNumber: '',
    driverName: '',
    startAt: toLocalInput(new Date()),
    endAt: '',
    ratePerHour: load.defaultUnloadingRate != null ? String(load.defaultUnloadingRate) : '',
  });
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ReturnType<typeof blank>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    run(async () => {
      await api(`/imports/${load.id}/unloading`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
          driverName: form.driverName,
          startAt: fromLocalInput(form.startAt),
          endAt: fromLocalInput(form.endAt),
          ratePerHour: form.ratePerHour === '' ? undefined : Number(form.ratePerHour),
        }),
      });
      setForm(null);
    });
  }

  const endNow = (u: Unloading) =>
    run(() => api(`/imports/${load.id}/unloading/${u.id}`, { method: 'PATCH', body: JSON.stringify({ endAt: new Date().toISOString() }) }));
  const remove = (u: Unloading) => {
    if (window.confirm(t('confirmDelete'))) run(() => api(`/imports/${load.id}/unloading/${u.id}`, { method: 'DELETE' }));
  };

  return (
    <Section
      title={t('unloading')}
      tools={
        load.editable &&
        !form && (
          <button className="btn btn-small" onClick={() => setForm(blank())}>
            + {t('addUnloading')}
          </button>
        )
      }
    >
      {error && <div className="notice notice-error">{error}</div>}
      {form && (
        <form className="card form-card" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>{t('vehicleNumber')} *</span>
              <input value={form.vehicleNumber} onChange={set('vehicleNumber')} required minLength={2} maxLength={20} autoFocus />
            </label>
            <label className="field">
              <span>{t('driverName')}</span>
              <input value={form.driverName} onChange={set('driverName')} maxLength={100} />
            </label>
            <label className="field">
              <span>{t('startTime')}</span>
              <input type="datetime-local" value={form.startAt} onChange={set('startAt')} required />
            </label>
            <label className="field">
              <span>{t('endTime')}</span>
              <input type="datetime-local" value={form.endAt} onChange={set('endAt')} min={form.startAt} />
            </label>
            <label className="field">
              <span>{t('ratePerHour')}</span>
              <input type="number" value={form.ratePerHour} onChange={set('ratePerHour')} min={0} step="0.01" inputMode="decimal" />
              <small className="muted">{t('calcFromRate')}</small>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary">{t('save')}</button>
          </div>
        </form>
      )}
      <div className="card table-wrap">
        {load.unloadings.length === 0 ? (
          <div className="empty">{t('noUnloading')}</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('vehicleNumber')}</th>
                <th className="hide-sm">{t('startTime')}</th>
                <th className="hide-sm">{t('endTime')}</th>
                <th className="num">{t('duration')}</th>
                <th className="num hide-sm">{t('ratePerHour')}</th>
                <th className="num">{t('totalCharges')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {load.unloadings.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.vehicleNumber}
                    {u.driverName && <div className="muted small">{u.driverName}</div>}
                  </td>
                  <td className="hide-sm">{dateTime(u.startAt)}</td>
                  <td className="hide-sm">{u.endAt ? dateTime(u.endAt) : '—'}</td>
                  <td className="num">
                    {u.durationMinutes != null ? (
                      formatDuration(u.durationMinutes)
                    ) : (
                      <span className="status status-submitted">{t('inProgress')}</span>
                    )}
                  </td>
                  <td className="num hide-sm">{u.ratePerHour != null ? money(u.ratePerHour) : '—'}</td>
                  <td className="num">{u.totalCharges != null ? money(u.totalCharges) : '—'}</td>
                  <td className="actions">
                    {load.editable && (
                      <>
                        {!u.endAt && (
                          <button className="btn btn-small" onClick={() => endNow(u)}>
                            {t('endNow')}
                          </button>
                        )}
                        <button className="btn btn-small btn-ghost" aria-label={t('delete')} onClick={() => remove(u)}>
                          <Icon name="trash" size={16} />
                          <span className="btn-label">{t('delete')}</span>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ───────── purchase details (owner only) ─────────

interface Financials {
  supplierId: string | null;
  purchaseRatePerCft: number | null;
  purchaseAmount: number | null;
  transportCharges: number | null;
  amountPaid: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
}

const str = (n: number | null) => (n == null ? '' : String(n));
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function PurchaseSection({ load, canPickSupplier }: { load: ImportDetail; canPickSupplier: boolean }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<Financials>(`/imports/${load.id}/financials`), [load.id]);
  const suppliers = useLoad(() => (canPickSupplier ? api<{ id: string; name: string }[]>('/suppliers') : Promise.resolve([])), [canPickSupplier]);
  const [form, setForm] = useState<Record<'supplierId' | 'rate' | 'amount' | 'transport' | 'paid' | 'notes', string> | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (data)
      setForm({
        supplierId: data.supplierId ?? '',
        rate: str(data.purchaseRatePerCft),
        amount: str(data.purchaseAmount),
        transport: str(data.transportCharges),
        paid: data.amountPaid ? String(data.amountPaid) : '',
        notes: data.notes ?? '',
      });
  }, [data]);

  const set = (k: keyof NonNullable<typeof form>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);
    try {
      await api(`/imports/${load.id}/financials`, {
        method: 'PUT',
        body: JSON.stringify({
          supplierId: form.supplierId || null,
          purchaseRatePerCft: numOrNull(form.rate),
          purchaseAmount: numOrNull(form.amount),
          transportCharges: numOrNull(form.transport),
          amountPaid: numOrNull(form.paid),
          notes: form.notes,
        }),
      });
      setMessage({ kind: 'ok', text: t('saved') });
      reload();
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    }
  }

  const rate = form ? positive(form.rate) : null;
  const fillAmount = () => rate != null && setForm((f) => (f ? { ...f, amount: (rate * load.totalCft).toFixed(2) } : f));
  const balance = data?.purchaseAmount != null ? data.purchaseAmount - data.amountPaid : null;
  const payKey = ({ UNPAID: 'unpaid', PARTIAL: 'partial', PAID: 'paid' } as const)[data?.paymentStatus ?? 'UNPAID'];
  const payClass = { UNPAID: 'status-draft', PARTIAL: 'status-submitted', PAID: 'status-approved' }[data?.paymentStatus ?? 'UNPAID'];

  return (
    <Section
      title={
        <>
          {t('purchaseDetails')}{' '}
          <span className="lock">
            <Icon name="lock" size={12} />
            {t('ownerOnly')}
          </span>
        </>
      }
    >
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {form && (
        <form className="card form-card" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>{t('supplier')}</span>
              <select value={form.supplierId} onChange={set('supplierId')}>
                <option value="">{t('noSupplier')}</option>
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('purchaseRate')}</span>
              <input type="number" value={form.rate} onChange={set('rate')} min={0} step="0.01" inputMode="decimal" />
            </label>
            <label className="field">
              <span>{t('purchaseAmount')}</span>
              <input type="number" value={form.amount} onChange={set('amount')} min={0} step="0.01" inputMode="decimal" />
              <button type="button" className="link-btn" disabled={rate == null} onClick={fillAmount}>
                {t('rateTimesCft')}
                {rate != null && ` = ${money(rate * load.totalCft)}`}
              </button>
            </label>
            <label className="field">
              <span>{t('transportCharges')}</span>
              <input type="number" value={form.transport} onChange={set('transport')} min={0} step="0.01" inputMode="decimal" />
            </label>
            <label className="field">
              <span>{t('amountPaid')}</span>
              <input type="number" value={form.paid} onChange={set('paid')} min={0} step="0.01" inputMode="decimal" />
            </label>
            <label className="field">
              <span>{t('notes')}</span>
              <input value={form.notes} onChange={set('notes')} maxLength={1000} />
            </label>
          </div>
          {message && <div className={`notice notice-${message.kind}`}>{message.text}</div>}
          <div className="form-actions">
            <span className="form-summary">
              {t('paymentStatus')}: <span className={`status ${payClass}`}>{t(payKey)}</span>
              {balance != null && (
                <>
                  {' '}
                  · {t('balance')}: <strong>{money(balance)}</strong>
                </>
              )}
            </span>
            <button className="btn btn-primary">{t('save')}</button>
          </div>
        </form>
      )}
    </Section>
  );
}

// ───────── log measurement ─────────

function LogsSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const [girth, setGirth] = useState('');
  const [length, setLength] = useState('');
  const [editing, setEditing] = useState<{ id: string; girth: string; length: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const girthRef = useRef<HTMLInputElement>(null);

  const g = positive(girth);
  const l = positive(length);
  const liveCft = g != null && l != null ? importLogCft(g, l) : null;
  const nextNo = (load.logs[load.logs.length - 1]?.logNumber ?? 0) + 1;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (g == null || l == null) return;
    run(async () => {
      await api(`/imports/${load.id}/logs`, { method: 'POST', body: JSON.stringify({ girthIn: g, lengthFt: l }) });
      setGirth('');
      setLength('');
      girthRef.current?.focus(); // ready for the next log without touching the mouse
    });
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const eg = positive(editing.girth);
    const el = positive(editing.length);
    if (eg == null || el == null) return;
    run(async () => {
      await api(`/imports/${load.id}/logs/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ girthIn: eg, lengthFt: el }) });
      setEditing(null);
    });
  }

  const remove = (log: Log) => {
    if (window.confirm(t('confirmDelete'))) run(() => api(`/imports/${load.id}/logs/${log.id}`, { method: 'DELETE' }));
  };

  const newestFirst = [...load.logs].reverse();

  return (
    <section id="logs" className="page-section">
      <Section title={t('measurement')}>
        {load.editable && (
          <form className="card log-entry" onSubmit={add}>
            <div className="log-entry-no">
              <span className="muted small">{t('logNo')}</span>
              <strong>{nextNo}</strong>
            </div>
            <label className="field">
              <span>{t('girth')}</span>
              <input ref={girthRef} type="number" value={girth} onChange={(e) => setGirth(e.target.value)} min={0.01} max={999} step="0.01" inputMode="decimal" required />
            </label>
            <label className="field">
              <span>{t('lengthFt')}</span>
              <input type="number" value={length} onChange={(e) => setLength(e.target.value)} min={0.01} max={999} step="0.01" inputMode="decimal" required />
            </label>
            <div className="log-entry-cft">
              <span className="muted small">CFT</span>
              <strong>{liveCft != null ? num3(liveCft) : '0.000'}</strong>
            </div>
            <button className="btn btn-primary" disabled={busy || liveCft == null}>
              {t('saveLog', { n: nextNo })}
            </button>
          </form>
        )}
        {error && <div className="notice notice-error">{error}</div>}

        <div className="card table-wrap">
          {load.logs.length === 0 ? (
            <div className="empty">{t('noLogs')}</div>
          ) : (
            <form onSubmit={saveEdit}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('logNo')}</th>
                    <th className="num">{t('girth')}</th>
                    <th className="num">{t('lengthFt')}</th>
                    <th className="num">CFT</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((log) =>
                    editing?.id === log.id ? (
                      <tr key={log.id}>
                        <td>{log.logNumber}</td>
                        <td className="num">
                          <input className="cell-input" type="number" aria-label={t('girth')} value={editing.girth} onChange={(e) => setEditing({ ...editing, girth: e.target.value })} min={0.01} max={999} step="0.01" required autoFocus />
                        </td>
                        <td className="num">
                          <input className="cell-input" type="number" aria-label={t('lengthFt')} value={editing.length} onChange={(e) => setEditing({ ...editing, length: e.target.value })} min={0.01} max={999} step="0.01" required />
                        </td>
                        <td className="num">
                          {positive(editing.girth) != null && positive(editing.length) != null
                            ? num3(importLogCft(positive(editing.girth)!, positive(editing.length)!))
                            : '—'}
                        </td>
                        <td className="actions">
                          <button className="btn btn-small btn-primary" disabled={busy}>
                            {t('save')}
                          </button>
                          <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing(null)}>
                            {t('cancel')}
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={log.id}>
                        <td>{log.logNumber}</td>
                        <td className="num">{log.girthIn}</td>
                        <td className="num">{log.lengthFt}</td>
                        <td className="num">{num3(log.cft)}</td>
                        <td className="actions">
                          {load.editable && (
                            <>
                              <button type="button" className="btn btn-small" aria-label={t('edit')} onClick={() => setEditing({ id: log.id, girth: String(log.girthIn), length: String(log.lengthFt) })}>
                                <Icon name="edit" size={16} />
                                <span className="btn-label">{t('edit')}</span>
                              </button>
                              <button type="button" className="btn btn-small btn-ghost" aria-label={t('delete')} onClick={() => remove(log)}>
                                <Icon name="trash" size={16} />
                                <span className="btn-label">{t('delete')}</span>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      {t('logsMeasured')}: {load.totalLogs}
                    </td>
                    <td className="num">{num3(load.totalCft)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </form>
          )}
        </div>
      </Section>
    </section>
  );
}
