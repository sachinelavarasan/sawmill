import { FormEvent, useState } from 'react';
import { api } from '../api';
import { LoadState, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
}

type Form = Record<'name' | 'phone' | 'address' | 'gstNumber' | 'notes', string>;
const blank: Form = { name: '', phone: '', address: '', gstNumber: '', notes: '' };

/** Owner-only supplier list. Suppliers are picked on an import's purchase details. */
export function SuppliersPage() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<Supplier[]>('/suppliers'));
  // `id: null` = adding a new supplier
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: e.target.value } } : s));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      await api(editing.id ? `/suppliers/${editing.id}` : '/suppliers', {
        method: editing.id ? 'PATCH' : 'POST',
        body: JSON.stringify(editing.form),
      });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('suppliers')}</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing({ id: null, form: blank })}>
            + {t('addSupplier')}
          </button>
        )}
      </div>

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {editing && (
        <form className="card form-card" onSubmit={submit}>
          <h3>{editing.id ? t('edit') : t('addSupplier')}</h3>
          <div className="form-grid">
            <label className="field">
              <span>{t('name')} *</span>
              <input value={editing.form.name} onChange={set('name')} required maxLength={120} autoFocus />
            </label>
            <label className="field">
              <span>{t('mobile')}</span>
              <input value={editing.form.phone} onChange={set('phone')} inputMode="tel" maxLength={15} />
            </label>
            <label className="field">
              <span>{t('gstNumber')}</span>
              <input value={editing.form.gstNumber} onChange={set('gstNumber')} maxLength={20} />
            </label>
            <label className="field field-wide">
              <span>{t('address')}</span>
              <input value={editing.form.address} onChange={set('address')} maxLength={300} />
            </label>
            <label className="field field-wide">
              <span>{t('notes')}</span>
              <input value={editing.form.notes} onChange={set('notes')} maxLength={1000} />
            </label>
          </div>
          {formError && <div className="notice notice-error">{formError}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {t('save')}
            </button>
          </div>
        </form>
      )}

      {data && (
        <div className="card table-wrap">
          {data.length === 0 ? (
            <div className="empty">{t('noSuppliers')}</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('mobile')}</th>
                  <th>{t('address')}</th>
                  <th>{t('gstNumber')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.notes && <div className="muted small">{s.notes}</div>}
                    </td>
                    <td>{s.phone ?? '—'}</td>
                    <td>{s.address ?? '—'}</td>
                    <td>{s.gstNumber ?? '—'}</td>
                    <td className="actions">
                      <button
                        className="btn btn-small"
                        onClick={() =>
                          setEditing({
                            id: s.id,
                            form: { name: s.name, phone: s.phone ?? '', address: s.address ?? '', gstNumber: s.gstNumber ?? '', notes: s.notes ?? '' },
                          })
                        }
                      >
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
