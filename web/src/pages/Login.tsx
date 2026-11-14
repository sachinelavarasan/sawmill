import { ArrowBigUpIcon, ArrowRightIcon, BellIcon, EyeIcon, EyeOffIcon, LayersIcon, LayoutDashboardIcon, LockIcon, LogInIcon, PackageIcon, RulerIcon, UserIcon } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { GrowthRings, LogoMark, Wordmark, Wordmark3D } from '../components/brand';
import { Tilt } from '../components/depth';
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
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

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

  /** The hero's call to action: bring the form into view (on a phone it sits below) and start typing. */
  const toForm = () => {
    userRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    userRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ── the hero: what TimberTrail is, and the product itself ── */}
      <section className="relative isolate flex flex-col overflow-hidden bg-hero px-6 pt-10 pb-12 text-white sm:px-10 lg:min-h-svh lg:px-14 lg:pt-12 lg:pb-0">
        {/* growth rings of a sawn log, faint, behind everything */}
        <div className="pointer-events-none absolute -top-40 -left-40 -z-10 size-[720px] opacity-[0.07]" aria-hidden>
          <GrowthRings className="inset-0 size-full" />
        </div>
        {/* a soft saffron glow where the preview sits */}
        <div className="pointer-events-none absolute right-[-10%] bottom-[-20%] -z-10 hidden size-[640px] rounded-full bg-brand/20 blur-3xl lg:block" aria-hidden />

        {/* the name leans toward the pointer like the preview below; the wordmark floats in front of the logo */}
        <Tilt className="w-fit" rest={{ x: 0, y: 0 }} max={9}>
          <div className="flex items-center gap-4 pb-3" style={{ transformStyle: 'preserve-3d' }}>
            <LogoMark className="size-14 shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_12px_24px_-8px_rgb(0_0_0/0.65)] sm:size-16" />
            <span style={{ transform: 'translateZ(36px)' }}>
              <Wordmark3D className="text-4xl sm:text-5xl" />
            </span>
          </div>
        </Tilt>

        <div className="mt-10 max-w-xl animate-in duration-500 ease-smooth fade-in-0 slide-in-from-bottom-2 lg:mt-16">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">{t('heroEyebrow')}</p>
          <h1 className="mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em] text-balance sm:text-[2.5rem] lg:text-[3.25rem]">{t('heroTitle')}</h1>
          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-pretty text-white/75 sm:text-base">{t('heroSub')}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={toForm} className="bg-brand text-brand-foreground shadow-[0_8px_24px_-8px_rgb(229_160_0/0.6)] hover:bg-brand/90">
              {t('heroCta')}
              <ArrowRightIcon />
            </Button>
          </div>
        </div>

        {/* the product, in perspective: from a tablet up, where it can be read */}
        <div className="relative mt-12 hidden flex-1 items-end md:flex lg:mt-14" role="img" aria-label={t('heroPreview')}>
          <HeroPreview />
        </div>
      </section>

      {/* ── signing in ── */}
      <div className="relative isolate flex flex-col overflow-hidden px-4 py-6 sm:px-8 lg:min-h-svh">
        {/* the same growth rings as the hero, very faint, in the far corner */}
        <div className="pointer-events-none absolute -right-48 -bottom-48 -z-10 size-[620px] text-foreground opacity-[0.045]" aria-hidden>
          <GrowthRings className="inset-0 size-full" />
        </div>

        {/* page-level choices sit in the corner, out of the form's way */}
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <LangToggle />
        </div>

        <div className="flex flex-1 items-start justify-center py-8 lg:items-center">
          <div className="w-full max-w-[26rem] animate-in duration-500 ease-smooth fade-in-0 slide-in-from-bottom-3">
            <Card className="gap-0 overflow-hidden py-0 shadow-widget">
              {/* a saffron hairline ties the form to the brand */}
              <div className="h-1 bg-[linear-gradient(90deg,var(--saffron),color-mix(in_oklab,var(--saffron),transparent_70%))]" aria-hidden />
              <div className="px-7 pt-8 pb-8 sm:px-9 sm:pt-9">
                <LogoMark variant="auto" className="size-14 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_8px_18px_-8px_rgb(15_23_42/0.35)]" />
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{t('loginWelcome')}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t('loginSub')}</p>

                <form onSubmit={submit} className="mt-7 grid gap-5">
                  <Field id="login-username" label={t('username')}>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        ref={userRef}
                        id="login-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoFocus
                        required
                        className="h-12 pl-10"
                      />
                    </div>
                  </Field>
                  <Field id="login-password" label={t('password')}>
                    <div className="relative">
                      <LockIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="login-password"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                        onBlur={() => setCaps(false)}
                        autoComplete="current-password"
                        required
                        className="h-12 px-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? t('hidePassword') : t('showPassword')}
                        title={showPw ? t('hidePassword') : t('showPassword')}
                        aria-pressed={showPw}
                        className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {showPw ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                      </button>
                    </div>
                    {caps && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-warning" role="status">
                        <ArrowBigUpIcon className="size-3.5" aria-hidden />
                        {t('capsLockOn')}
                      </p>
                    )}
                  </Field>
                  {error && <Notice tone="error">{error}</Notice>}
                  <Button type="submit" size="lg" className="mt-1 h-12 w-full text-[0.9375rem]" disabled={busy}>
                    <LogInIcon />
                    {busy ? t('signingIn') : t('signIn')}
                  </Button>
                </form>
              </div>

              {/* development only: fill in a seeded account with one click */}
              {import.meta.env.DEV && (
                <div className="flex flex-wrap items-center gap-2 border-t bg-muted/60 px-7 py-3.5 text-xs text-muted-foreground sm:px-9">
                  <span className="font-medium">Dev accounts</span>
                  {(
                    [
                      ['owner', 'Owner@123'],
                      ['accountant', 'Accountant@123'],
                    ] as const
                  ).map(([u, p]) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        setUsername(u);
                        setPassword(p);
                      }}
                      className="rounded-full border bg-card px-2.5 py-1 font-medium text-foreground shadow-xs transition-colors outline-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="flex justify-center opacity-80">
          <Wordmark className="h-8" />
        </div>
      </div>
    </div>
  );
}

/** Illustrative figures for the preview (not anyone's data): a week of wood received and shipped, in CFT. */
const FLOW = [
  [420, 180],
  [610, 260],
  [380, 330],
  [720, 290],
  [540, 410],
  [830, 360],
  [660, 450],
] as const;

/**
 * The dashboard, drawn small and set in perspective: a main window with stock figures and a chart,
 * and two panels floating in front of it (a log being measured, an entry waiting for approval).
 * Built from the app's own colours, so it follows the light and dark themes. Decorative: the
 * section carries one description for screen readers, and nothing inside it can be focused.
 */
function HeroPreview() {
  const { t } = useI18n();
  const max = Math.max(...FLOW.flat());
  return (
    <Tilt className="w-full max-w-[40rem] translate-y-6 lg:translate-x-6" rest={{ x: 7, y: -10 }} max={4}>
      <div aria-hidden className="relative" style={{ transformStyle: 'preserve-3d' }}>
        {/* soft ambient shadow under the window */}
        <div className="absolute inset-x-10 -bottom-6 h-16 rounded-[50%] bg-black/40 blur-2xl" style={{ transform: 'translateZ(-40px)' }} />

        {/* ── the main window ── */}
        <div className="overflow-hidden rounded-2xl bg-background text-foreground shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_30px_70px_-20px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-1.5 border-b bg-card px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-[#ef6b5f]" />
            <span className="size-2.5 rounded-full bg-[#f3be4f]" />
            <span className="size-2.5 rounded-full bg-[#5fc463]" />
            <span className="ml-3 text-[0.6875rem] font-medium text-muted-foreground">TimberTrail / {t('dashboard')}</span>
          </div>
          <div className="flex">
            {/* the sidebar, as an icon rail */}
            <div className="flex w-12 shrink-0 flex-col items-center gap-3 bg-sidebar py-4 text-sidebar-muted">
              <LogoMark className="size-7" />
              <span className="mt-2 grid size-7 place-items-center rounded-md bg-sidebar-active text-sidebar-accent">
                <LayoutDashboardIcon className="size-3.5" />
              </span>
              <LayersIcon className="size-3.5" />
              <RulerIcon className="size-3.5" />
              <PackageIcon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    [t('rawStock'), '2,705.737', 'CFT'],
                    [t('finishedStock'), '4,716.026', 'CFT'],
                    [t('pendingApprovals'), '8', ''],
                  ] as const
                ).map(([label, value, unit]) => (
                  <div key={label} className="rounded-lg bg-card p-2.5 shadow-card">
                    <div className="truncate text-[0.625rem] font-medium text-muted-foreground">{label}</div>
                    <div className="mt-1 text-sm leading-none font-semibold tabular-nums">
                      {value}
                      {unit && <span className="ml-0.5 text-[0.5625rem] font-medium text-muted-foreground">{unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 rounded-lg bg-card p-3 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="text-[0.6875rem] font-semibold">{t('chartFlowTitle')}</div>
                  <div className="flex gap-2 text-[0.5625rem] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-chart-1" />
                      {t('receivedCft')}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-chart-2" />
                      {t('shippedCft')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex h-24 items-end gap-2.5">
                  {FLOW.map(([inn, out], i) => (
                    <div key={i} className="flex h-full flex-1 items-end gap-0.5">
                      <span className="flex-1 rounded-t-sm bg-chart-1" style={{ height: `${(inn / max) * 100}%` }} />
                      <span className="flex-1 rounded-t-sm bg-chart-2" style={{ height: `${(out / max) * 100}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── a log being measured, floating in front at the lower left ── */}
        <div className="absolute -bottom-8 -left-8 w-56" style={{ transform: 'translateZ(70px)' }}>
          <div className="drift rounded-xl bg-card p-3.5 text-foreground shadow-pop">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold">
              <span className="grid size-6 place-items-center rounded-md bg-brand/15 text-brand">
                <RulerIcon className="size-3.5" />
              </span>
              {t('logNo')} 10
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[0.625rem]">
              <div className="rounded-md bg-muted px-2 py-1.5">
                <div className="text-muted-foreground">{t('girth')}</div>
                <div className="text-sm font-semibold tabular-nums">62.5</div>
              </div>
              <div className="rounded-md bg-muted px-2 py-1.5">
                <div className="text-muted-foreground">{t('lengthFt')}</div>
                <div className="text-sm font-semibold tabular-nums">16</div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between text-[0.625rem] text-muted-foreground">
              {t('thisLog')}
              <span className="text-sm font-semibold text-foreground tabular-nums">
                27.127 <span className="text-[0.5625rem] font-medium text-muted-foreground">CFT</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── an entry waiting for approval, floating at the upper right ── */}
        <div className="absolute -top-7 -right-6 w-60" style={{ transform: 'translateZ(50px)' }}>
          <div className="drift-slow flex items-start gap-2.5 rounded-xl bg-card p-3 text-foreground shadow-pop">
            <span className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
              <BellIcon className="size-3.5" />
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-card" />
            </span>
            <div className="min-w-0 text-[0.625rem] leading-snug">
              <div className="text-[0.6875rem] font-semibold">IMP-2026-0032</div>
              <div className="truncate text-muted-foreground">{t('waitingForApproval')}</div>
              <div className="mt-0.5 font-medium tabular-nums">844.381 CFT · Teak</div>
            </div>
          </div>
        </div>
      </div>
    </Tilt>
  );
}
