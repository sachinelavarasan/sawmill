import { BellIcon, CheckCheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronsUpDownIcon, LogOutIcon, MenuIcon, MonitorIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SunIcon, Undo2Icon } from 'lucide-react';
import { Permission } from '@sawmill/shared';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { Lang, useI18n } from '../i18n';
import { NAV_GROUPS, NAV_ITEMS, type NavGroup, navVisible } from '../nav';
import { LogoMark } from './brand';
import { CreateMenu } from './create-menu';
import { QuickJump } from './quick-jump';
import { type ThemeChoice, useTheme } from '../theme';
import { dateTime } from './common';

const SIDEBAR_KEY = 'sawmill.sidebar';

/** Desktop sidebar width: full, or collapsed to an icon rail. Remembered per browser. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? 'expanded' : 'collapsed');
      } catch {
        /* private mode: the choice just isn't remembered */
      }
      return !c;
    });
  }, []);
  return { collapsed, toggle };
}

/** True while the media query matches (e.g. a desktop-width window). */
function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * The app frame. Desktop: a deep-slate sidebar (full, or an icon rail by choice) beside a sticky top bar.
 * Tablet: the sidebar is always the compact icon rail. Phone: the sidebar becomes an off-canvas drawer.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const desktop = useMedia('(min-width: 1024px)');
  // on a tablet there is room for the rail, not for the full sidebar
  const rail = collapsed || !desktop;
  const scrolled = useScrolled();

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'sticky top-0 z-40 hidden h-svh shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-smooth md:block print:hidden',
          // depth: a touch lighter at the top, a hairline on the edge and a soft shadow cast onto the page
          'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--side),white_6%),var(--side)_40%)] shadow-[inset_-1px_0_0_rgb(255_255_255/0.06),8px_0_28px_-16px_rgb(15_23_42/0.55)]',
          rail ? 'w-[4.75rem]' : 'w-[16.5rem]',
        )}
      >
        <SidebarNav collapsed={rail} />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[17.5rem] border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">SAWMILL PRO</SheetDescription>
          <SidebarNav onNavigate={() => setOpen(false)} touch />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* the workspace toolbar: sticky and translucent; it gains a shadow once the page slides under it */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-300 sm:px-5 lg:px-7 print:hidden',
            // always lifted off the page; a little higher once the page slides under it
            scrolled
              ? 'border-border/80 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_-10px_rgb(15_23_42/0.28)]'
              : 'border-border/70 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_4px_14px_-8px_rgb(15_23_42/0.18)]',
          )}
        >
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('menu')} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          {/* the sidebar's collapse toggle lives here, where it is always in the same place (desktop only) */}
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 text-muted-foreground max-lg:hidden"
            aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
            aria-expanded={!collapsed}
            title={collapsed ? t('expandMenu') : t('collapseMenu')}
            onClick={toggle}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
          <Crumbs />
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <QuickJump />
            <CreateMenu />
            <ApprovalsShortcut />
            <Notifications />
            <ThemeToggle className="max-sm:hidden" />
            <LangToggle className="max-md:hidden" />
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-12 sm:px-6 sm:pt-7 lg:px-8 lg:pt-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

/** True once the page has scrolled under the top bar. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return scrolled;
}

/** Where you are, in the top bar: the mill, then the open section (the page's own heading names the record). */
function Crumbs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find((n) => (n.path === '/' ? pathname === '/' : pathname === n.path || pathname.startsWith(`${n.path}/`)));
  if (!item) return null;
  return (
    <nav aria-label={t('menu')} className="flex min-w-0 items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground max-lg:hidden">{user?.mill.name}</span>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/70 max-lg:hidden" aria-hidden />
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80 shadow-xs max-sm:hidden [&_svg]:size-4" aria-hidden>
        <item.icon strokeWidth={1.75} />
      </span>
      {/* on a record or form inside the section, the section name leads back to its list */}
      {pathname === item.path ? (
        <span className="truncate font-semibold" aria-current="page">
          {t(item.labelKey)}
        </span>
      ) : (
        <NavLink to={item.path} className="truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          {t(item.labelKey)}
        </NavLink>
      )}
    </nav>
  );
}

/** Number of records waiting for the owner, for the Approvals menu badge. Refreshed on navigation and every minute. */
function usePendingApprovals() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const allowed = can(Permission.OPERATIONS_APPROVE);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    const load = () =>
      api<{ total: number }>('/approvals/count')
        .then((r) => live && setN(r.total))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [allowed, pathname]);
  return n;
}

const GROUPS_KEY = 'sawmill.nav.closed';
/** Which navigation groups the person has folded away, remembered per browser. */
function useClosedGroups() {
  const [closed, setClosed] = useState<NavGroup[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const toggle = useCallback((id: NavGroup) => {
    setClosed((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  }, []);
  return { closed, toggle };
}

function SidebarNav({ onNavigate, collapsed = false, touch = false }: { onNavigate?: () => void; collapsed?: boolean; /** the phone drawer: taller, touch-sized rows */ touch?: boolean }) {
  const { user, can } = useAuth();
  const pending = usePendingApprovals();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { closed, toggle } = useClosedGroups();
  const items = NAV_ITEMS.filter((n) => navVisible(n, can));
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: items.filter((n) => n.group === g.id) })).filter((g) => g.items.length > 0);
  const activeOf = (path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`));

  const link = (n: (typeof items)[number]) => {
    const label = t(n.labelKey);
    // Worked out here, not with NavLink's className callback: the tooltip trigger
    // (Radix Slot) merges className as a string, which would stringify a function.
    const isActive = activeOf(n.path);
    const badge = n.path === '/approvals' && pending > 0 ? (pending > 99 ? '99+' : `${pending}`) : null;
    const item = (
      <NavLink
        key={n.path}
        to={n.path}
        end={n.path === '/'}
        onClick={onNavigate}
        aria-label={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
        className={cn(
          'group/nav relative flex shrink-0 items-center rounded-xl text-[0.8125rem] transition-[background-color,color,box-shadow] duration-200 ease-smooth outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
          collapsed ? 'size-11 justify-center' : cn('gap-3 px-3', touch ? 'min-h-12' : 'min-h-10'),
          isActive
            ? // the open page floats: a lighter slate surface, a lit top edge, a soft drop and a faint saffron wash from the left
              'bg-sidebar-active bg-[linear-gradient(90deg,rgb(229_160_0/0.14),transparent_60%)] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_0_0_1px_rgb(255_255_255/0.05),0_8px_18px_-8px_rgb(0_0_0/0.6)]'
            : 'font-medium text-sidebar-muted hover:bg-white/[0.06] hover:text-white',
        )}
      >
        {/* the saffron marker of the open page: it grows into place */}
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-sidebar-accent shadow-[0_0_10px_rgb(229_160_0/0.6)] transition-[height,opacity] duration-300 ease-smooth',
            isActive ? 'h-6 opacity-100' : 'h-0 opacity-0',
            collapsed && '-translate-x-3.5',
          )}
        />
        <n.icon
          className={cn(
            'size-[1.125rem] shrink-0 transition-colors duration-200 ease-smooth',
            isActive ? 'text-sidebar-accent drop-shadow-[0_0_6px_rgb(229_160_0/0.45)]' : 'group-hover/nav:text-white',
          )}
          strokeWidth={isActive ? 2 : 1.75}
        />
        {!collapsed && <span className="flex-1 animate-in truncate duration-300 fade-in-0">{label}</span>}
        {badge &&
          (collapsed ? (
            <span className="absolute top-1.5 right-1.5 size-2.5 animate-in rounded-full border-2 border-sidebar bg-sidebar-accent duration-300 zoom-in-50" aria-hidden="true" />
          ) : (
            // the count: a saffron pill with a lit edge; it pops in when the number changes
            <span
              key={badge}
              className="min-w-5 animate-in rounded-full bg-sidebar-accent px-1.5 text-center text-[0.6875rem] leading-5 font-bold text-brand-foreground tabular-nums shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_2px_8px_-2px_rgb(229_160_0/0.7)] duration-300 zoom-in-75 fade-in-0"
            >
              {badge}
            </span>
          ))}
      </NavLink>
    );
    if (!collapsed) return item;
    return (
      <Tooltip key={n.path}>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {badge ? `${label} · ${badge}` : label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        {/* brand: the logo on a raised tile, the product name, the mill */}
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.08]', collapsed ? 'justify-center' : 'px-4')}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(255_255_255/0.06),0_6px_14px_-6px_rgb(0_0_0/0.6)]">
            <LogoMark className="size-8" />
          </span>
          {!collapsed && (
            <div className="min-w-0 animate-in leading-tight duration-300 fade-in-0">
              <div className="text-[0.9375rem] font-bold tracking-[0.06em] text-white">SAWMILL PRO</div>
              <div className="mt-0.5 truncate text-xs text-sidebar-muted">{user?.mill.name}</div>
            </div>
          )}
        </div>

        {/* navigation scrolls on its own; the brand and the profile stay put */}
        <nav aria-label={t('menu')} className={cn('scroll-quiet flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-3', collapsed && 'items-center')}>
          {groups.map((g, i) => {
            const holdsActive = g.items.some((n) => activeOf(n.path));
            // a group folds away only when expanded; the one holding the open page always stays open
            const open = collapsed || !g.labelKey || holdsActive || !closed.includes(g.id);
            return (
              <div key={g.id} className="flex flex-col">
                {g.labelKey && !collapsed ? (
                  <button
                    type="button"
                    onClick={() => !holdsActive && toggle(g.id)}
                    aria-expanded={open}
                    disabled={holdsActive}
                    className="group/head mt-4 mb-1 flex shrink-0 animate-in items-center gap-2 rounded-md px-3 py-1 text-left text-[0.6875rem] font-semibold tracking-[0.08em] text-sidebar-muted/65 uppercase transition-colors duration-200 fade-in-0 outline-none hover:text-sidebar-muted focus-visible:ring-2 focus-visible:ring-sidebar-accent disabled:cursor-default disabled:hover:text-sidebar-muted/65"
                  >
                    <span className="flex-1 truncate">{t(g.labelKey)}</span>
                    {!holdsActive && <ChevronDownIcon className={cn('size-3.5 transition-transform duration-300 ease-smooth', !open && '-rotate-90')} aria-hidden />}
                  </button>
                ) : (
                  i > 0 && <div className={cn('my-3 shrink-0 border-t border-white/[0.08]', collapsed ? 'mx-auto w-8' : 'mx-3')} />
                )}
                {/* the group's items slide open and closed; folded items are out of the tab order */}
                <div className={cn('grid transition-[grid-template-rows] duration-300 ease-smooth', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!open}>
                  <div className={cn('flex min-h-0 flex-col gap-1 overflow-hidden', collapsed && 'items-center')}>{g.items.map(link)}</div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* who is signed in: a raised panel anchored at the foot */}
        <div className={cn('shrink-0 border-t border-white/[0.08] p-3', collapsed && 'flex justify-center')}>
          <div className={cn(!collapsed && 'rounded-xl bg-white/[0.04] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_0_0_1px_rgb(255_255_255/0.05)]')}>
            <ProfileMenu variant="sidebar" collapsed={collapsed} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** The owner's shortcut to the approval queue, with its count. Hidden for anyone who can't approve. */
function ApprovalsShortcut() {
  const pending = usePendingApprovals();
  const { can } = useAuth();
  const { t } = useI18n();
  if (!can(Permission.OPERATIONS_APPROVE)) return null;
  return (
    <Button asChild variant="outline" className="h-11 gap-2 px-3 max-lg:hidden">
      <Link to="/approvals" aria-label={pending ? `${t('approvals')} (${pending})` : t('approvals')}>
        <CheckCheckIcon className={pending ? 'text-warning' : 'text-muted-foreground'} />
        <span className="max-xl:sr-only">{t('approvals')}</span>
        <span
          key={pending}
          className={cn(
            'min-w-5 animate-in rounded-full px-1.5 text-center text-xs leading-5 font-bold tabular-nums duration-300 zoom-in-75 fade-in-0',
            pending ? 'bg-brand text-brand-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]' : 'bg-muted text-muted-foreground',
          )}
        >
          {pending}
        </span>
      </Link>
    </Button>
  );
}

/** Light, dark, or follow the device: a small menu in the top bar (and on the sign-in screen). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, choice, setChoice } = useTheme();
  const { t } = useI18n();
  const dark = theme === 'dark';
  const options: { v: ThemeChoice; label: string; Icon: typeof SunIcon }[] = [
    { v: 'light', label: t('themeLight'), Icon: SunIcon },
    { v: 'dark', label: t('themeDark'), Icon: MoonIcon },
    { v: 'system', label: t('themeSystem'), Icon: MonitorIcon },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative overflow-hidden text-muted-foreground', className)} aria-label={t('theme')} title={t('theme')}>
          {/* the sun sets and the moon rises (and back), rather than one icon snapping to the other */}
          <SunIcon className={cn('absolute transition-all duration-500 ease-smooth', dark ? 'translate-y-5 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} aria-hidden />
          <MoonIcon className={cn('absolute transition-all duration-500 ease-smooth', dark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-5 -rotate-90 opacity-0')} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[18.5rem] p-3">
        <div className="px-1 pb-2.5 text-xs font-medium text-muted-foreground">{t('theme')}</div>
        <div role="group" aria-label={t('theme')} className="grid grid-cols-3 gap-2">
          {options.map(({ v, label, Icon }) => {
            const on = choice === v;
            return (
              <DropdownMenuItem
                key={v}
                role="menuitemradio"
                aria-checked={on}
                onSelect={() => setChoice(v)}
                className={cn(
                  'flex cursor-pointer flex-col items-stretch gap-2 rounded-xl p-1.5 ring-1 transition-[box-shadow,background-color] duration-200 focus:bg-muted/60',
                  on ? 'bg-muted/50 ring-2 ring-brand' : 'ring-border hover:ring-input',
                )}
              >
                <ThemePreview mode={v} />
                <span className="flex items-center justify-center gap-1.5 pb-0.5 text-xs font-medium">
                  <Icon className={cn('size-3.5', on ? 'text-brand' : 'text-muted-foreground')} aria-hidden />
                  {label}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A thumbnail of the app in a theme: the slate sidebar with its saffron marker, and two cards on the page.
 * The colours are the themes' own (fixed here, since each tile shows its theme whatever theme is on now).
 * "System" shows light and dark split on the diagonal.
 */
function ThemePreview({ mode }: { mode: ThemeChoice }) {
  const scene = (d: boolean) => (
    <div className="flex size-full" style={{ background: d ? '#0f172a' : '#f1f5f9' }}>
      <div className="flex w-3.5 flex-col items-center gap-1 pt-1.5" style={{ background: d ? '#172033' : '#1e293b' }}>
        <span className="size-1.5 rounded-full" style={{ background: '#e5a000' }} />
        <span className="h-0.5 w-1.5 rounded-full bg-white/40" />
        <span className="h-0.5 w-1.5 rounded-full bg-white/25" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1 w-8 rounded-full" style={{ background: d ? '#94a3b8' : '#334155' }} />
        <div className="flex flex-1 gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 flex-col justify-end gap-0.5 rounded-sm p-1 shadow-sm" style={{ background: d ? '#1e293b' : '#ffffff' }}>
              <span className="h-0.5 w-3/4 rounded-full" style={{ background: d ? '#475569' : '#cbd5e1' }} />
              <span className="h-1 w-1/2 rounded-full" style={{ background: i ? '#e5a000' : d ? '#94a3b8' : '#64748b' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <div className="relative h-14 overflow-hidden rounded-lg ring-1 ring-black/5" aria-hidden>
      {mode === 'system' ? (
        <>
          {scene(false)}
          <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
            {scene(true)}
          </div>
        </>
      ) : (
        scene(mode === 'dark')
      )}
    </div>
  );
}

/** One thing waiting for someone: a record to approve (owner) or one sent back to correct (accountant). */
interface Note {
  key: string;
  to: string;
  code: string;
  line: string;
  at: string | null;
  kind: 'approve' | 'correct';
}
const NOTE_PATH: Record<string, (id: string) => string> = {
  IMPORT: (id) => `/imports/${id}`,
  PRODUCTION: (id) => `/production/${id}`,
  EXPORT: (id) => `/exports/${id}`,
  ADJUSTMENT: () => '/stock?tab=adjustments',
};

/**
 * The bell in the top bar. The owner sees what is waiting for approval; an accountant sees their own entries
 * that came back rejected. Read from the lists the app already has, refreshed on navigation and every two minutes.
 */
function Notifications() {
  const { can } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const owner = can(Permission.OPERATIONS_APPROVE);
  const operator = can(Permission.OPERATIONS_CREATE);
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!owner && !operator) return;
    let live = true;
    const load = async () => {
      try {
        if (owner) {
          const q = await api<{ items: { type: string; id: string; code: string; createdByName: string; submittedAt: string }[]; counts: { total: number } }>('/approvals');
          if (!live) return;
          setTotal(q.counts.total);
          setNotes(
            q.items.slice(0, 6).map((i) => ({ key: `${i.type}-${i.id}`, to: NOTE_PATH[i.type]?.(i.id) ?? '/approvals', code: i.code, line: i.createdByName, at: i.submittedAt, kind: 'approve' })),
          );
        } else {
          // an accountant's own rejected entries (the lists are already scoped to whoever is signed in)
          type Row = { id: string; code: string; rejectionReason: string | null; updatedAt?: string | null };
          const get = (path: string) => api<{ items: Row[]; total: number }>(`${path}?take=3&skip=0&status=REJECTED`).catch(() => ({ items: [] as Row[], total: 0 }));
          const [i, p, e] = await Promise.all([get('/imports'), get('/production'), get('/exports')]);
          if (!live) return;
          setTotal(i.total + p.total + e.total);
          const rows = [
            ...i.items.map((r) => ({ r, to: `/imports/${r.id}` })),
            ...p.items.map((r) => ({ r, to: `/production/${r.id}` })),
            ...e.items.map((r) => ({ r, to: `/exports/${r.id}` })),
          ];
          setNotes(rows.slice(0, 6).map(({ r, to }) => ({ key: to, to, code: r.code, line: r.rejectionReason ?? '', at: r.updatedAt ?? null, kind: 'correct' })));
        }
      } catch {
        /* the bell stays as it was; the pages themselves report errors */
      }
    };
    load();
    const timer = setInterval(load, 120_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [owner, operator, pathname]);

  if (!owner && !operator) return null;
  const heading = owner ? t('waitingForApproval') : t('returnedForCorrection');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label={total ? `${t('notifications')} (${total})` : t('notifications')} title={t('notifications')}>
          <BellIcon />
          {total > 0 && (
            <span key={total} className="absolute top-2 right-2 grid min-w-4 animate-in place-items-center rounded-full bg-brand px-1 text-[0.625rem] leading-4 font-bold text-brand-foreground tabular-nums ring-2 ring-card duration-300 zoom-in-50">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{t('notifications')}</div>
            <div className="text-xs text-muted-foreground">{heading}</div>
          </div>
          {total > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning tabular-nums">{total}</span>}
        </div>
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success">
              <CheckCheckIcon className="size-5" aria-hidden />
            </span>
            {t('noNotifications')}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {notes.map((n) => (
              <DropdownMenuItem key={n.key} asChild className="items-start gap-3 rounded-lg px-2.5 py-2.5">
                <Link to={n.to}>
                  <span
                    className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', n.kind === 'approve' ? 'bg-warning-soft text-warning' : 'bg-destructive-soft text-destructive')}
                    aria-hidden
                  >
                    {n.kind === 'approve' ? <CheckCheckIcon className="size-4" /> : <Undo2Icon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.code}</span>
                    {n.line && <span className="block truncate text-xs text-muted-foreground">{n.line}</span>}
                    {n.at && <span className="block text-[0.6875rem] text-muted-foreground/80">{dateTime(n.at)}</span>}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <div className="border-t p-1.5">
          <DropdownMenuItem asChild className="justify-center rounded-lg py-2 text-sm font-medium">
            <Link to={owner ? '/approvals' : '/my-entries'}>{t('viewAll')}</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={lang}
      onValueChange={(v) => v && setLang(v as Lang)}
      aria-label="Language"
      className={cn('bg-card', className)}
    >
      <ToggleGroupItem value="en" className="px-3 font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        EN
      </ToggleGroupItem>
      <ToggleGroupItem value="ta" className="px-3 font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        தமிழ்
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Who is signed in, and the way out. At the foot of the sidebar (name and role, or just the avatar
 * when the sidebar is collapsed) and, where the sidebar is a drawer, as an avatar in the top bar.
 */
function ProfileMenu({ variant, collapsed = false }: { variant: 'sidebar' | 'header'; collapsed?: boolean }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const isOwner = user?.role === 'OWNER';
  const role = isOwner ? t('owner') : t('accountant');
  const initial = user?.name.charAt(0).toUpperCase();
  const avatar = (
    <Avatar className={variant === 'sidebar' ? 'size-9 ring-2 ring-white/10' : 'size-9'}>
      <AvatarFallback className={variant === 'sidebar' ? 'bg-brand font-bold text-brand-foreground' : 'bg-primary font-bold text-primary-foreground'}>{initial}</AvatarFallback>
    </Avatar>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'header' ? (
          <Button variant="ghost" className="size-11 rounded-full p-0" aria-label={user?.name}>
            {avatar}
          </Button>
        ) : (
          <button
            type="button"
            aria-label={user?.name}
            title={collapsed ? `${user?.name} · ${role}` : undefined}
            className={cn(
              'flex items-center rounded-lg text-left transition-colors duration-200 outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-sidebar-accent',
              collapsed ? 'p-0.5' : 'w-full gap-3 p-2.5',
            )}
          >
            {avatar}
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 animate-in leading-tight duration-300 fade-in-0">
                  <span className="block truncate text-sm font-semibold text-white">{user?.name}</span>
                  <span className="block truncate text-xs text-sidebar-muted">{role}</span>
                </span>
                <ChevronsUpDownIcon className="size-4 shrink-0 text-sidebar-muted" aria-hidden />
              </>
            )}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === 'sidebar' ? 'start' : 'end'} side={variant === 'sidebar' ? 'top' : 'bottom'} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary font-bold text-primary-foreground">{initial}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block text-xs font-normal text-muted-foreground">{t('signedInAs')}</span>
            <span className="block truncate">{user?.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">@{user?.username}</span>
          </span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Badge variant="secondary" className="rounded-full">
            {role}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        {/* on a phone the language switch lives here, the top bar being short of room */}
        <div className="px-2 py-1.5 sm:hidden">
          <LangToggle className="w-full [&>*]:flex-1" />
        </div>
        <DropdownMenuItem onSelect={logout} variant="destructive">
          <LogOutIcon />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
