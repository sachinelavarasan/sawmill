import { FormEvent, useState } from 'react';
import { useAuth } from '../auth';
import { LangToggle, ThemeToggle } from '../components/ui';
import { useI18n } from '../i18n';

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        {/* growth rings of a sawn log */}
        <svg className="login-rings" aria-hidden width="560" height="560" viewBox="0 0 420 420" fill="none" stroke="#fff" strokeWidth="1.2">
          {[30, 62, 96, 132, 168, 204].map((r) => (
            <circle key={r} cx="210" cy="210" r={r} />
          ))}
        </svg>
        <div className="brand-mark large">SP</div>
        <h1>SAWMILL PRO</h1>
        <p>{t('appTagline')}</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-head">
          <h2>{t('login')}</h2>
          <div className="login-card-tools">
            <ThemeToggle />
            <LangToggle />
          </div>
        </div>
        <label className="field">
          <span>{t('username')}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span>{t('password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="notice notice-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t('signingIn') : t('signIn')}
        </button>
        {import.meta.env.DEV && (
          <p className="muted small">Dev accounts: owner / Owner@123 · accountant / Accountant@123</p>
        )}
      </form>
    </div>
  );
}
