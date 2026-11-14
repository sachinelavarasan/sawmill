import { ChevronRightIcon, LogOutIcon, MenuIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SunIcon } from 'lucide-react';
import { Permission } from '@sawmill/shared';
import { Fragment, ReactNode, useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
import { NAV_GROUPS, NAV_ITEMS, navVisible } from '../nav';
import { LogoMark } from './brand';
import { QuickJump } from './quick-jump';
import { useTheme } from '../theme';

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

/** The app frame: collapsible dark-slate sidebar (a slide-in sheet on phones) + a white top bar + page. */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:block print:hidden',
          collapsed ? 'w-[4.25rem]' : 'w-[15.625rem]',
        )}
      >
        <SidebarNav collapsed={collapsed} />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">SAWMILL PRO</SheetDescription>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card px-4 sm:px-6 print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('menu')} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 text-muted-foreground max-lg:hidden"
            aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
            aria-expanded={!collapsed}
            title={collapsed ? t('expandMenu') : t('collapseMenu')}
            onClick={toggle}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
          <Crumbs />
          <div className="flex-1" />
          <QuickJump />
          <ThemeToggle />
          <LangToggle />
          <UserMenu />
        </header>
        <main className="flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}

/** Where you are, in the top bar: the mill, then the open section (the page's own heading names the record). */
function Crumbs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find((n) => (n.path === '/' ? pathname === '/' : pathname === n.path || pathname.startsWith(`${n.path}/`)));
  if (!item) return null;
  return (
    <nav aria-label={t('menu')} className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
      <span className="truncate text-muted-foreground max-md:hidden">{user?.mill.name}</span>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground max-md:hidden" aria-hidden />
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

function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { user, can } = useAuth();
  const pending = usePendingApprovals();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((n) => navVisible(n, can));
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: items.filter((n) => n.group === g.id) })).filter((g) => g.items.length > 0);

  const link = (n: (typeof items)[number]) => {
    const label = t(n.labelKey);
    // Worked out here, not with NavLink's className callback: the tooltip trigger
    // (Radix Slot) merges className as a string, which would stringify a function.
    const isActive = n.path === '/' ? pathname === '/' : pathname === n.path || pathname.startsWith(`${n.path}/`);
    const badge = n.path === '/approvals' && pending > 0 ? (pending > 99 ? '99+' : `${pending}`) : null;
    const item = (
      <NavLink
        key={n.path}
        to={n.path}
        end={n.path === '/'}
        onClick={onNavigate}
        aria-label={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
        className={cn(
          'relative flex shrink-0 items-center rounded-lg text-[0.8125rem] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
          collapsed ? 'size-10 justify-center' : 'min-h-11 gap-3 px-3 lg:min-h-9',
          isActive ? 'bg-sidebar-active font-semibold text-white' : 'font-medium text-sidebar-muted hover:bg-white/[0.07] hover:text-white',
        )}
      >
        {/* the marker of the open page */}
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0 h-5 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-sidebar-accent',
            !isActive && 'hidden',
            collapsed && '-translate-x-3.5',
          )}
        />
        <n.icon className={cn('size-[1.125rem] shrink-0', isActive && 'text-sidebar-accent')} strokeWidth={1.75} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {badge &&
          (collapsed ? (
            <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-sidebar bg-sidebar-accent" aria-hidden="true" />
          ) : (
            <span className="min-w-5 rounded-full bg-sidebar-accent px-1.5 text-center text-xs leading-5 font-bold text-brand-foreground tabular-nums">{badge}</span>
          ))}
      </NavLink>
    );
    if (!collapsed) return item;
    return (
      <Tooltip key={n.path}>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {badge ? `${label} · ${badge}` : label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-white/10', collapsed ? 'justify-center' : 'px-4')}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[0.9375rem] font-bold tracking-tight text-white">Sawmill Pro</div>
              <div className="truncate text-xs text-sidebar-muted">{user?.mill.name}</div>
            </div>
          )}
        </div>

        <nav aria-label={t('menu')} className={cn('scroll-quiet flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-3 py-3', collapsed && 'items-center')}>
          {groups.map((g, i) => (
            <Fragment key={g.id}>
              {/* a group heading; in the icon rail (and for groups without a name) a hairline instead */}
              {g.labelKey && !collapsed ? (
                <div className="shrink-0 truncate px-3 pt-4 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-sidebar-muted/70 uppercase">{t(g.labelKey)}</div>
              ) : (
                i > 0 && <div className={cn('my-2 shrink-0 border-t border-white/10', collapsed ? 'w-8' : 'mx-3')} />
              )}
              {g.items.map(link)}
            </Fragment>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const label = theme === 'dark' ? t('lightTheme') : t('darkTheme');
  return (
    <Button variant="outline" size="icon" className={className} aria-label={label} title={label} onClick={toggle}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
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

function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const isOwner = user?.role === 'OWNER';
  const initial = user?.name.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2.5 px-1.5 sm:px-2" aria-label={user?.name}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary font-bold text-primary-foreground">{initial}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <div className="text-sm leading-tight font-semibold">{user?.name}</div>
            <div className="text-xs leading-tight text-muted-foreground">{isOwner ? t('owner') : t('accountant')}</div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate">{user?.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{user?.username}</span>
          <Badge className="mt-1 w-fit">{isOwner ? t('owner') : t('accountant')}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOutIcon />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
