import { BarChart3Icon, LogInIcon, RulerIcon, ShieldCheckIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { LangToggle, ThemeToggle } from '../components/Layout';
import { Field, Notice } from '../components/page';
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
      // known answers in the user's language; anything else (network, server) as sent
      const status = err instanceof ApiError ? err.status : 0;
      setError(status === 401 ? t('loginWrong') : status === 429 ? t('loginLocked') : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden bg-hero px-6 py-12 text-center text-white lg:py-0">
        {/* growth rings of a sawn log */}
        <svg
          className="pointer-events-none absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 opacity-10"
          aria-hidden
          viewBox="0 0 420 420"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          {[30, 62, 96, 132, 168, 204].map((r) => (
            <circle key={r} cx="210" cy="210" r={r} />
          ))}
        </svg>
        <div className="relative grid size-14 place-items-center rounded-2xl bg-white text-lg font-extrabold text-primary shadow-lg lg:size-20 lg:text-2xl">SP</div>
        <h1 className="relative text-2xl font-extrabold tracking-wide lg:text-4xl">SAWMILL PRO</h1>
        <p className="relative max-w-sm text-sm opacity-80 lg:text-base">{t('appTagline')}</p>
        <ul className="relative mt-8 hidden max-w-xs flex-col gap-3 text-left text-sm lg:flex">
          {(
            [
              [RulerIcon, 'loginFeature1'],
              [ShieldCheckIcon, 'loginFeature2'],
              [BarChart3Icon, 'loginFeature3'],
            ] as const
          ).map(([Icon, key]) => (
            <li key={key} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                <Icon className="size-4" />
              </span>
              <span className="opacity-90">{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start justify-center px-4 py-8 lg:items-center lg:py-12">
        <Card className="w-full max-w-sm py-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-6">
            <CardTitle className="text-xl">{t('login')}</CardTitle>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LangToggle />
            </div>
          </CardHeader>
          <CardContent className="px-6">
            <form onSubmit={submit} className="grid gap-4">
              <Field id="login-username" label={t('username')}>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  required
                />
              </Field>
              <Field id="login-password" label={t('password')}>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              {error && <Notice tone="error">{error}</Notice>}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                <LogInIcon />
                {busy ? t('signingIn') : t('signIn')}
              </Button>
              {import.meta.env.DEV && <p className="text-xs text-muted-foreground">Dev accounts: owner / Owner@123 · accountant / Accountant@123</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
