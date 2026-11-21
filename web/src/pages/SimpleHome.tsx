import { Permission } from '@timbertrail/shared';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, BoxesIcon, ChevronRightIcon, CircleCheckIcon, PartyPopperIcon, RulerIcon, Undo2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { num3, useLoad } from '../components/common';
import { HomeHero, Page } from '../components/page';
import { QuickActions } from '../components/quick-actions';
import { useI18n } from '../i18n';

/** The few figures the simple home needs, from the endpoints the full dashboards already use. */
interface Today {
  loadsIn: number;
  loadsOut: number;
  /** raw + finished, owner only (the accountant's dashboard carries no stock totals) */
  stockCft: number | null;
  pendingApprovals: number;
  rejected: number;
  toMeasure: number;
  /** where "loads still to measure" leads: the one load when there is just one */
  measureTo: string;
}

/**
 * Home in the simple view (the default for everyone): big picture tiles for the day's work,
 * three numbers for today, and a short list of what is waiting on this person — nothing else.
 */
export function SimpleHome() {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const owner = can(Permission.DASHBOARD_OWNER);

  const { data } = useLoad(async (): Promise<Today> => {
    if (owner) {
      const [d, measuring] = await Promise.all([
        api<{ kpis: { todayImports: number; todayExports: number; rawStockCft: number; finishedStockCft: number; pendingApprovals: number } }>('/dashboard/owner'),
        api<{ total: number }>('/imports?take=1&skip=0&open=1').then((r) => r.total),
      ]);
      const k = d.kpis;
      return {
        loadsIn: k.todayImports,
        loadsOut: k.todayExports,
        stockCft: k.rawStockCft + k.finishedStockCft,
        pendingApprovals: k.pendingApprovals,
        rejected: 0,
        toMeasure: measuring,
        measureTo: '/measurement',
      };
    }
    const d = await api<{ kpis: { todayImports: number; todayExports: number; rejectedEntries: number }; measurementProgress: { id: string }[] }>('/dashboard/accountant');
    const open = d.measurementProgress;
    return {
      loadsIn: d.kpis.todayImports,
      loadsOut: d.kpis.todayExports,
      stockCft: null,
      pendingApprovals: 0,
      rejected: d.kpis.rejectedEntries,
      toMeasure: open.length,
      measureTo: open.length === 1 ? `/imports/${open[0].id}?from=measure#logs` : '/measurement',
    };
  }, [owner]);

  const todo: { key: string; to: string; icon: ReactNode; text: string }[] = data
    ? [
        ...(data.pendingApprovals > 0 ? [{ key: 'approve', to: '/approvals', icon: <CircleCheckIcon />, text: t('nWaitingApproval', { n: data.pendingApprovals }) }] : []),
        ...(data.rejected > 0 ? [{ key: 'rejected', to: '/my-entries', icon: <Undo2Icon />, text: t('rejectedToFix', { n: data.rejected }) }] : []),
        ...(data.toMeasure > 0 ? [{ key: 'measure', to: data.measureTo, icon: <RulerIcon />, text: t('loadsToMeasure', { n: data.toMeasure }) }] : []),
      ]
    : [];

  return (
    <Page>
      <HomeHero name={user?.name}>
        {/* today, in three numbers */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure icon={<ArrowDownToLineIcon />} label={t('loadsInToday')} value={data ? String(data.loadsIn) : '–'} />
          <Figure icon={<ArrowUpFromLineIcon />} label={t('loadsOutToday')} value={data ? String(data.loadsOut) : '–'} />
          {owner && <Figure wide icon={<BoxesIcon />} label={t('totalStock')} value={data?.stockCft != null ? num3(data.stockCft) : '–'} unit="CFT" />}
        </div>
      </HomeHero>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold font-display">{t('whatToDo')}</h2>
        <QuickActions simple pending={data?.pendingApprovals ?? 0} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold font-display">{t('needsAction')}</h2>
        {data && todo.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-card p-5 text-base shadow-card">
            <PartyPopperIcon className="size-7 shrink-0 text-success" aria-hidden />
            {t('allDone')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todo.map((x) => (
              <Link
                key={x.key}
                to={x.to}
                className="flex min-h-16 items-center gap-4 rounded-2xl bg-card px-5 py-3 text-base font-medium shadow-card hover-lift outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-6" aria-hidden>
                  {x.icon}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{x.text}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  {t('open')}
                  <ChevronRightIcon className="size-4" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}

function Figure({ icon, label, value, unit, wide }: { icon: ReactNode; label: string; value: string; unit?: string; /** a full row on a phone */ wide?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-2xl bg-hero-chip p-4', wide && 'max-sm:col-span-2')}>
      <span className="flex items-center gap-2 text-sm text-hero-muted [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-3xl leading-none font-bold tabular-nums font-display">
        {value}
        {unit && <span className="ml-1.5 text-base font-semibold text-hero-muted">{unit}</span>}
      </span>
    </div>
  );
}
