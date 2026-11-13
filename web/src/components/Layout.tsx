import { LogOutIcon, MenuIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Permission } from '@sawmill/shared';
import { ReactNode, useEffect, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { Lang, useI18n } from '../i18n';
import { NAV_ITEMS } from '../nav';
import { useTheme } from '../theme';

/** The app frame: green sidebar (a slide-in sheet on phones) + top bar + page. */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground lg:block print:hidden">
        <SidebarNav />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <SheetDescription className="sr-only">SAWMILL PRO</SheetDescription>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur sm:px-6 print:hidden">
          <Button variant="outline" size="icon" className="lg:hidden" aria-label={t('menu')} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <LangToggle />
          <UserMenu />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-7 print:p-0">{children}</main>
      </div>
    </div>
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

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, can } = useAuth();
  const pending = usePendingApprovals();
  const { t } = useI18n();
  const items = NAV_ITEMS.filter((n) => can(n.permission));
  const isOwner = user?.role === 'OWNER';

  const link = (n: (typeof items)[number]) => (
    <NavLink
      key={n.path}
      to={n.path}
      end={n.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-foreground/90 hover:bg-white/8 hover:text-white',
        )
      }
    >
      <n.icon className="size-4.5 shrink-0" />
      <span className="flex-1">{t(n.labelKey)}</span>
      {n.path === '/approvals' && pending > 0 && (
        <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[0.7rem] leading-5 font-bold text-white tabular-nums" aria-label={`${pending}`}>
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-3 px-1 pt-1">
        <div className="grid size-10 place-items-center rounded-xl bg-white text-sm font-extrabold text-primary">SP</div>
        <div className="min-w-0">
          <div className="text-base font-extrabold tracking-wide text-white">SAWMILL PRO</div>
          <div className="truncate text-xs text-sidebar-muted">{user?.mill.name}</div>
        </div>
      </div>
      <nav aria-label={t('menu')} className="flex flex-col gap-1">
        {items.filter((n) => n.section === 'main').map(link)}
        {isOwner && <div className="px-3 pt-4 pb-1 text-[0.7rem] font-bold tracking-wider text-sidebar-muted uppercase">{t('ownerOnly')}</div>}
        {items.filter((n) => n.section === 'owner').map(link)}
      </nav>
    </div>
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
            <AvatarFallback className="bg-primary-soft font-bold text-primary">{initial}</AvatarFallback>
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
