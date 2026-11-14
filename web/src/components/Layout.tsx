import { ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, LogOutIcon, MenuIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Permission } from '@sawmill/shared';
import { ReactNode, useCallback, useEffect, useState } from 'react';
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
import { NAV_ITEMS } from '../nav';
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

/** The app frame: collapsible dark sidebar (a slide-in sheet on phones) + a glass top bar + page. */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:block print:hidden',
          collapsed ? 'w-[4.75rem]' : 'w-[17rem]',
        )}
      >
        <SidebarNav collapsed={collapsed} onToggle={toggle} />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">SAWMILL PRO</SheetDescription>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8 print:hidden">
          <Button variant="outline" size="icon" className="lg:hidden" aria-label={t('menu')} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          <Crumbs />
          <div className="flex-1" />
          <QuickJump />
          <ThemeToggle />
          <LangToggle />
          <UserMenu />
        </header>
        <main className="flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-7 lg:px-8 print:p-0">{children}</main>
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

function SidebarNav({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const { user, can } = useAuth();
  const pending = usePendingApprovals();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((n) => can(n.permission));
  const isOwner = user?.role === 'OWNER';

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
          'relative flex shrink-0 items-center rounded-lg text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
          collapsed ? 'size-11 justify-center' : 'min-h-11 gap-3 px-3 lg:min-h-10',
          isActive ? 'bg-sidebar-active font-semibold text-white' : 'font-medium text-sidebar-muted hover:bg-white/[0.06] hover:text-white',
        )}
      >
        {/* the marker of the open page */}
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0 h-5 w-[3px] -translate-x-3 -translate-y-1/2 rounded-full bg-sidebar-accent',
            !isActive && 'hidden',
            collapsed && '-translate-x-4',
          )}
        />
        <n.icon className={cn('size-[1.125rem] shrink-0', isActive && 'text-sidebar-accent')} strokeWidth={1.75} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {badge &&
          (collapsed ? (
            <span className="absolute top-2 right-2 size-2.5 rounded-full border-2 border-sidebar bg-sidebar-accent" aria-hidden="true" />
          ) : (
            <span className="min-w-5 rounded-full bg-sidebar-accent px-1.5 text-center text-xs leading-5 font-bold text-hero tabular-nums">{badge}</span>
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

  const ToggleIcon = collapsed ? ChevronsRightIcon : ChevronsLeftIcon;
  const toggleLabel = collapsed ? t('expandMenu') : t('collapseMenu');

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        <div className={cn('flex h-16 shrink-0 items-center gap-3', collapsed ? 'justify-center' : 'px-5')}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[0.9375rem] font-bold tracking-tight text-white">Sawmill Pro</div>
              <div className="truncate text-xs text-sidebar-muted">{user?.mill.name}</div>
            </div>
          )}
        </div>

        <nav aria-label={t('menu')} className={cn('scroll-quiet flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-3 py-2', collapsed && 'items-center')}>
          {items.filter((n) => n.section === 'main').map(link)}
          {isOwner &&
            (collapsed ? (
              <div className="my-2 w-8 shrink-0 border-t border-white/10" />
            ) : (
              <div className="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-sidebar-muted uppercase">{t('ownerOnly')}</div>
            ))}
          {items.filter((n) => n.section === 'owner').map(link)}
        </nav>

        {onToggle && (
          <div className={cn('flex shrink-0 border-t border-white/10 p-3', collapsed && 'justify-center')}>
            <button
              type="button"
              onClick={onToggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              title={collapsed ? toggleLabel : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium text-sidebar-muted transition-colors outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-accent',
                collapsed ? 'size-11 justify-center' : 'min-h-10 w-full gap-3 px-3',
              )}
            >
              <ToggleIcon className="size-[1.125rem] shrink-0" strokeWidth={1.75} />
              {!collapsed && <span>{toggleLabel}</span>}
            </button>
          </div>
        )}
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
