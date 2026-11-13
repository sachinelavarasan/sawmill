import { FormEvent, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, LoadState, useLoad } from '../components/ui';
import { useI18n } from '../i18n';

interface UserRow {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  role: 'OWNER' | 'ACCOUNTANT';
  isActive: boolean;
  lastLoginAt: string | null;
}

export function UsersPage() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<UserRow[]>('/users'));
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function toggleActive(u: UserRow) {
    setMessage(null);
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) });
      reload();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('users')}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + {t('addAccountant')}
        </button>
      </div>

      {message && <div className={`notice notice-${message.kind}`}>{message.text}</div>}
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {showForm && (
        <CreateUserForm
          onDone={(ok) => {
            setShowForm(false);
            if (ok) {
              setMessage({ kind: 'ok', text: t('saved') });
              reload();
            }
          }}
        />
      )}
      {resetFor && (
        <ResetPasswordForm
          user={resetFor}
          onDone={(ok) => {
            setResetFor(null);
            if (ok) setMessage({ kind: 'ok', text: t('saved') });
          }}
        />
      )}

      {data && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th className="hide-sm">{t('username')}</th>
                <th className="hide-sm">{t('mobile')}</th>
                <th>{t('role')}</th>
                <th>{t('status')}</th>
                <th className="hide-sm">{t('lastLogin')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="hide-sm">{u.username}</td>
                  <td className="hide-sm">{u.phone ?? '—'}</td>
                  <td>
                    <span className={`role-badge ${u.role === 'OWNER' ? 'owner' : 'accountant'}`}>
                      {u.role === 'OWNER' ? t('owner') : t('accountant')}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${u.isActive ? 'status-approved' : 'status-rejected'}`}>
                      {u.isActive ? t('active') : t('disabled')}
                    </span>
                  </td>
                  <td className="hide-sm">{u.lastLoginAt ? dateTime(u.lastLoginAt) : t('never')}</td>
                  <td className="actions">
                    {u.id !== me?.id && (
                      <>
                        <button className="btn btn-small" onClick={() => setResetFor(u)}>
                          {t('resetPassword')}
                        </button>
                        <button className="btn btn-small btn-ghost" onClick={() => toggleActive(u)}>
                          {u.isActive ? t('disable') : t('enable')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ onDone }: { onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', role: 'ACCOUNTANT' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, phone: form.phone || undefined }),
      });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <h3>{t('addAccountant')}</h3>
      <div className="form-grid">
        <label className="field">
          <span>{t('name')}</span>
          <input value={form.name} onChange={set('name')} required minLength={2} />
        </label>
        <label className="field">
          <span>{t('username')}</span>
          <input value={form.username} onChange={set('username')} required autoCapitalize="none" />
        </label>
        <label className="field">
          <span>{t('mobile')}</span>
          <input value={form.phone} onChange={set('phone')} inputMode="tel" />
        </label>
        <label className="field">
          <span>{t('role')}</span>
          <select value={form.role} onChange={set('role')}>
            <option value="ACCOUNTANT">{t('accountant')}</option>
            <option value="OWNER">{t('owner')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('password')}</span>
          <input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          <small className="muted">{t('passwordRule')}</small>
        </label>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
          {t('cancel')}
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: UserRow; onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <h3>
        {t('resetPassword')} — {user.name}
      </h3>
      <label className="field">
        <span>{t('newPassword')}</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        <small className="muted">{t('passwordRule')}</small>
      </label>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
          {t('cancel')}
        </button>
        <button className="btn btn-primary">{t('save')}</button>
      </div>
    </form>
  );
}
