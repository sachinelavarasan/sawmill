import { BellIcon, CheckCheckIcon, ChevronDownIcon, ChevronsUpDownIcon, LogOutIcon, MenuIcon, MonitorIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SunIcon, Undo2Icon } from 'lucide-react';
import { Permission } from '@timbertrail/shared';
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

const SIDEBAR_KEY = 'timbertrail.sidebar';

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
 * The app frame. Desktop: a navy sidebar (full, or an icon rail by choice) beside a sticky top bar.
 * Tablet: the sidebar is always the compact icon rail. Phone: the sidebar becomes an off-canvas drawer.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  // the browser tab carries the company's name while signed in
  const mill = user?.mill.name;
  useEffect(() => {
    if (!mill) return;
    document.title = `${mill} · TimberTrail`;
    return () => {
      document.title = 'TimberTrail';
    };
  }, [mill]);
  const desktop = useMedia('(min-width: 1024px)');
  // on a tablet there is room for the rail, not for the full sidebar
  const rail = collapsed || !desktop;
  const scrolled = useScrolled();

  return (
    <div className="min-h-svh bg-background">
      {/*
       * The sidebar: a panel floating inside the window, --sidebar-inset from its edges, never a full-height bar.
       * Its size, inset and corners are tokens (tokens.css); the page leaves room for it below.
       */}
      <aside
        className={cn(
          'fixed inset-y-(--sidebar-inset) left-(--sidebar-inset) z-40 hidden overflow-hidden rounded-(--sidebar-radius) bg-sidebar text-sidebar-foreground shadow-card transition-[width] duration-300 ease-smooth md:block print:hidden',
          rail ? 'w-(--sidebar-rail)' : 'w-(--sidebar-width)',
        )}
      >
        <SidebarNav collapsed={rail} />
      </aside>

      {/* on a phone the same sidebar slides in over the page, floating with the same inset */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          // no close button: it would sit on the mill's name; tapping outside or any link closes the drawer
          showCloseButton={false}
          className="inset-y-(--sidebar-inset) left-(--sidebar-inset) h-auto w-(--sidebar-width) max-w-[calc(100vw-2*var(--sidebar-inset))] overflow-hidden rounded-(--sidebar-radius) border-0 bg-sidebar p-0 text-sidebar-foreground sm:inset-y-(--sidebar-inset) sm:left-(--sidebar-inset) sm:max-w-[calc(100vw-2*var(--sidebar-inset))] sm:rounded-(--sidebar-radius)"
        >
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">{user?.mill.name ?? 'TimberTrail'}</SheetDescription>
          <SidebarNav onNavigate={() => setOpen(false)} touch />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          'flex min-h-svh min-w-0 flex-col transition-[padding] duration-300 ease-smooth print:pl-0',
          rail ? 'md:pl-[calc(var(--sidebar-rail)+var(--sidebar-inset))]' : 'md:pl-[calc(var(--sidebar-width)+var(--sidebar-inset))]',
        )}
      >
        {/* the workspace toolbar: a white panel, sticky; it casts a soft shadow once the page slides under it */}
        <div className="sticky top-0 z-30 bg-background px-3 pt-3 md:px-(--sidebar-inset) md:pt-(--sidebar-inset) print:hidden">
        <header
          className={cn(
            'flex h-[4.25rem] items-center gap-2 rounded-3xl bg-card/95 px-3 backdrop-blur-xl transition-shadow duration-300 sm:px-4 lg:px-5',
            scrolled ? 'shadow-lift' : 'shadow-card',
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
            <Notifications />
            <ThemeToggle className="max-sm:hidden" />
            <LangToggle className="max-md:hidden" />
          </div>
        </header>
        </div>
        <main className="flex-1 px-3 pt-4 pb-12 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6 print:p-0">{children}</main>
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

/**
 * Where you are, in the top bar: the open section (the page's own heading names the record).
 * The mill's name is not repeated here; the sidebar already leads with it.
 */
function Crumbs() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find((n) => (n.path === '/' ? pathname === '/' : pathname === n.path || pathname.startsWith(`${n.path}/`)));
  if (!item) return null;
  return (
    <nav aria-label={t('menu')} className="flex min-w-0 items-center gap-2 text-sm">
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

const GROUPS_KEY = 'timbertrail.nav.closed';
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

/** Which nested lists (an item's sections) the person opened or closed by hand; otherwise one is open while its page is. */
function useSubmenus() {
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const isOpen = useCallback((path: string, active: boolean) => manual[path] ?? active, [manual]);
  const toggle = useCallback((path: string, active: boolean) => setManual((m) => ({ ...m, [path]: !(m[path] ?? active) })), []);
  return { isOpen, toggle };
}

/** The look of one sidebar row: neutral at rest, a quiet grey on hover, the orange gradient pill (white type) for the open page. */
const rowClass = (active: boolean, collapsed: boolean, touch: boolean) =>
  cn(
    'group/nav relative flex shrink-0 items-center rounded-xl text-sm transition-[background-color,color] duration-200 ease-smooth outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
    collapsed ? 'size-11 justify-center' : cn('w-full gap-3 px-3', touch ? 'min-h-12' : 'min-h-10'),
    active ? 'bg-brand-gradient font-semibold text-brand-foreground' : 'font-medium text-sidebar-foreground/75 hover:bg-sidebar-hover hover:text-sidebar-foreground',
  );
const iconClass = (active: boolean) =>
  cn('size-[1.125rem] shrink-0 transition-colors duration-200 ease-smooth', active ? 'text-brand-foreground' : 'text-sidebar-muted group-hover/nav:text-sidebar-foreground');

/**
 * The sidebar's contents: brand, grouped navigation (an item may hold its page's sections, nested),
 * and at the foot Settings, who is signed in, and sign-out. The same component fills the desktop
 * panel (full or as an icon rail) and the phone drawer.
 */
function SidebarNav({ onNavigate, collapsed = false, touch = false }: { onNavigate?: () => void; collapsed?: boolean; /** the phone drawer: taller, touch-sized rows */ touch?: boolean }) {
  const { user, can, logout } = useAuth();
  const pending = usePendingApprovals();
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const { closed, toggle } = useClosedGroups();
  const subs = useSubmenus();
  const items = NAV_ITEMS.filter((n) => navVisible(n, can));
  const footer = items.filter((n) => n.footer);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: items.filter((n) => n.group === g.id && !n.footer) })).filter((g) => g.items.length > 0);
  const activeOf = (path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`));
  const tabNow = new URLSearchParams(search).get('tab');

  /** A tooltip naming the item, for the icon rail (where labels are hidden). */
  const withTip = (key: string, label: string, node: ReactNode) =>
    collapsed ? (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {label}
        </TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  const link = (n: (typeof items)[number]) => {
    const label = t(n.labelKey);
    // Worked out here, not with NavLink's className callback: the tooltip trigger
    // (Radix Slot) merges className as a string, which would stringify a function.
    const isActive = activeOf(n.path);
    const badge = n.path === '/approvals' && pending > 0 ? (pending > 99 ? '99+' : `${pending}`) : null;
    const nested = !collapsed && n.children && n.children.length > 0 ? n.children : null;
    const subOpen = nested ? subs.isOpen(n.path, isActive) : false;
    const subId = `sub-${n.path.replace(/\W/g, '')}`;

    const row = (
      <NavLink
        to={n.path}
        end={n.path === '/'}
        onClick={onNavigate}
        aria-label={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
        className={cn(rowClass(isActive, collapsed, touch), nested && 'pr-10')}
      >
        <n.icon className={iconClass(isActive)} strokeWidth={isActive ? 2 : 1.75} />
        {/* long labels (Tamil) wrap to a second line rather than being cut off */}
        {!collapsed && <span className="line-clamp-2 min-w-0 flex-1 animate-in py-2 leading-snug duration-300 fade-in-0">{label}</span>}
        {badge &&
          (collapsed ? (
            <span className={cn('absolute top-1.5 right-1.5 size-2.5 animate-in rounded-full ring-2 duration-300 zoom-in-50', isActive ? 'bg-white ring-transparent' : 'bg-sidebar-accent ring-sidebar')} aria-hidden="true" />
          ) : (
            // the count: a saffron pill; on the open page's orange pill, frosted white. It pops in when the number changes.
            <span
              key={badge}
              className={cn(
                'min-w-5 animate-in rounded-full px-1.5 text-center text-[0.6875rem] leading-5 font-bold tabular-nums duration-300 zoom-in-75 fade-in-0',
                isActive ? 'bg-white/25 text-white ring-1 ring-white/40' : 'bg-sidebar-accent text-brand-foreground',
              )}
            >
              {badge}
            </span>
          ))}
      </NavLink>
    );

    if (!nested) return withTip(n.path, badge ? `${label} · ${badge}` : label, <div key={n.path} className={cn(collapsed && 'flex justify-center')}>{row}</div>);

    const current = nested.some((c) => c.tab === tabNow) ? tabNow : nested[0].tab;
    return (
      <div key={n.path} className="flex flex-col">
        <div className="relative">
          {row}
          {/* opens and closes the page's sections without leaving the page you're on */}
          <button
            type="button"
            onClick={() => subs.toggle(n.path, isActive)}
            aria-expanded={subOpen}
            aria-controls={subId}
            aria-label={label}
            className={cn(
              'absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
              isActive ? 'text-brand-foreground hover:bg-white/20' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground',
            )}
          >
            <ChevronDownIcon className={cn('size-4 transition-transform duration-300 ease-smooth', !subOpen && '-rotate-90')} aria-hidden />
          </button>
        </div>
        <div id={subId} className={cn('grid transition-[grid-template-rows] duration-300 ease-smooth', subOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!subOpen}>
          <div className="min-h-0 overflow-hidden">
            {/* a hairline guide under the parent's icon; the open section marks it in saffron */}
            <div className="mt-0.5 mb-1 ml-[1.3rem] flex flex-col gap-0.5 border-l border-border pl-2.5">
              {nested.map((c, i) => {
                const on = isActive && c.tab === current;
                return (
                  <Link
                    key={c.tab}
                    to={i === 0 ? n.path : `${n.path}?tab=${c.tab}`}
                    onClick={onNavigate}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center rounded-lg px-3 text-[0.8125rem] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
                      touch ? 'min-h-11' : 'min-h-9',
                      'before:absolute before:inset-y-2 before:-left-[calc(0.625rem+1.5px)] before:w-0.5 before:rounded-full before:transition-colors',
                      on ? 'font-semibold text-sidebar-selected-foreground before:bg-sidebar-accent' : 'text-sidebar-muted before:bg-transparent hover:bg-sidebar-hover hover:text-sidebar-foreground',
                    )}
                  >
                    <span className="line-clamp-2 py-1.5 leading-snug">{t(c.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        {/* brand: the logo tile, the mill, the product name */}
        <div className={cn('flex h-[4.25rem] shrink-0 items-center gap-3', collapsed ? 'justify-center' : 'px-4')}>
          <span className="size-9 shrink-0 overflow-hidden rounded-lg">
            <LogoMark variant="auto" className="size-full" />
          </span>
          {!collapsed && (
            <div className="min-w-0 animate-in leading-tight duration-300 fade-in-0">
              {/* inside the app the company's own name leads; the product is the small print */}
              <div className="truncate text-[0.9375rem] font-bold tracking-tight font-display" title={user?.mill.name}>
                {user?.mill.name}
              </div>
              <div className="mt-0.5 truncate text-xs text-sidebar-muted">TimberTrail</div>
            </div>
          )}
        </div>

        {/* navigation scrolls on its own; the brand and the footer stay put */}
        <nav aria-label={t('menu')} className={cn('scroll-quiet flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3', touch ? 'py-2' : 'py-1', collapsed && 'items-center')}>
          {groups.map((g, i) => {
            const holdsActive = g.items.some((n) => activeOf(n.path));
            // a group folds away only when expanded; the one holding the open page always stays open
            const open = collapsed || !g.labelKey || holdsActive || !closed.includes(g.id);
            return (
              <div key={g.id} className={cn('flex flex-col', collapsed && 'items-center')}>
                {g.labelKey && !collapsed ? (
                  <button
                    type="button"
                    onClick={() => !holdsActive && toggle(g.id)}
                    aria-expanded={open}
                    disabled={holdsActive}
                    className={cn(
                      touch ? 'mt-4 mb-1 py-1' : 'mt-4 mb-1 py-0.5',
                      'group/head flex shrink-0 animate-in items-center gap-2 rounded-md px-3 text-left text-[0.6875rem] font-semibold tracking-wide text-sidebar-muted/80 uppercase transition-colors duration-200 fade-in-0 outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-accent disabled:cursor-default disabled:hover:text-sidebar-muted/80',
                    )}
                  >
                    <span className="flex-1 truncate">{t(g.labelKey)}</span>
                    {!holdsActive && <ChevronDownIcon className={cn('size-3.5 transition-transform duration-300 ease-smooth', !open && '-rotate-90')} aria-hidden />}
                  </button>
                ) : (
                  i > 0 && <div className={cn('shrink-0 border-t border-border/70', touch ? 'my-3' : 'my-2.5', collapsed ? 'w-6' : 'mx-3')} />
                )}
                {/* the group's items slide open and closed; folded items are out of the tab order */}
                <div className={cn('grid w-full transition-[grid-template-rows] duration-300 ease-smooth', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!open}>
                  <div className={cn('flex min-h-0 flex-col overflow-hidden', touch ? 'gap-1' : 'gap-0.5', collapsed && 'items-center')}>{g.items.map(link)}</div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* the foot: Settings, who is signed in, and the way out */}
        <div className={cn('flex shrink-0 flex-col gap-0.5 border-t border-border/70 p-3', collapsed && 'items-center')}>
          {footer.map(link)}
          <div className={cn('flex items-center', collapsed ? 'mt-1 flex-col gap-1' : 'mt-1 gap-1')}>
            <ProfileMenu variant="sidebar" collapsed={collapsed} />
            {withTip(
              'logout',
              t('logout'),
              <button
                type="button"
                onClick={logout}
                aria-label={t('logout')}
                title={collapsed ? undefined : t('logout')}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-sidebar-muted transition-colors duration-200 outline-none hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-sidebar-accent"
              >
                <LogOutIcon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
              </button>,
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
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
        <Button variant="secondary" size="icon" className={cn('relative overflow-hidden text-foreground/80', className)} aria-label={t('theme')} title={t('theme')}>
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
 * A thumbnail of the app in a theme: the white sidebar panel with its saffron marker, and two cards on the page.
 * The colours are the themes' own (fixed here, since each tile shows its theme whatever theme is on now).
 * "System" shows light and dark split on the diagonal.
 */
function ThemePreview({ mode }: { mode: ThemeChoice }) {
  const scene = (d: boolean) => (
    <div className="flex size-full" style={{ background: d ? '#0b0b0d' : '#eeeef0' }}>
      <div className="m-1 mr-0 flex w-3.5 flex-col items-center gap-1 rounded-[3px] pt-1" style={{ background: d ? '#161619' : '#ffffff' }}>
        <span className="h-1 w-2 rounded-full" style={{ background: d ? '#f47a33' : '#f26b1d' }} />
        <span className="h-0.5 w-1.5 rounded-full" style={{ background: d ? '#3a3a40' : '#d4d4d8' }} />
        <span className="h-0.5 w-1.5 rounded-full" style={{ background: d ? '#3a3a40' : '#d4d4d8' }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1 w-8 rounded-full" style={{ background: d ? '#9a9aa3' : '#111113' }} />
        <div className="flex flex-1 gap-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 flex-col justify-end gap-0.5 rounded-sm p-1" style={{ background: d ? '#161619' : '#ffffff' }}>
              <span className="h-0.5 w-3/4 rounded-full" style={{ background: d ? '#34343a' : '#e1e1e5' }} />
              <span className="h-1 w-1/2 rounded-full" style={{ background: i ? (d ? '#f47a33' : '#f26b1d') : d ? '#9a9aa3' : '#6b6b74' }} />
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
        <Button variant="secondary" size="icon" className="relative text-foreground/80" aria-label={total ? `${t('notifications')} (${total})` : t('notifications')} title={t('notifications')}>
          <BellIcon />
          {total > 0 && (
            <span key={total} className="absolute top-2 right-2 grid min-w-4 animate-in place-items-center rounded-full bg-brand px-1 text-[0.625rem] leading-4 font-bold text-brand-foreground tabular-nums ring-2 ring-secondary duration-300 zoom-in-50">
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
    // a quiet segmented switch: the chosen language is a white pill on grey, so the top bar's only
    // black control stays the Create button
    <ToggleGroup
      type="single"
      spacing={1}
      value={lang}
      onValueChange={(v) => v && setLang(v as Lang)}
      aria-label="Language"
      className={cn('rounded-full bg-control p-1', className)}
    >
      {(
        [
          ['en', 'EN'],
          ['ta', 'தமிழ்'],
        ] as const
      ).map(([v, label]) => (
        <ToggleGroupItem
          key={v}
          value={v}
          className="h-8 px-3 text-[0.8125rem] font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card"
        >
          {label}
        </ToggleGroupItem>
      ))}
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
    <Avatar className="size-9">
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
              'flex items-center rounded-xl text-left transition-colors duration-200 outline-none hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-sidebar-accent',
              collapsed ? 'p-0.5' : 'min-w-0 flex-1 gap-3 p-1.5',
            )}
          >
            {avatar}
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 animate-in leading-tight duration-300 fade-in-0">
                  <span className="block truncate text-sm font-semibold text-sidebar-foreground">{user?.name}</span>
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
