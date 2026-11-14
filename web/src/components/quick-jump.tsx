import { Permission } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, FactoryIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { NAV_ITEMS } from '../nav';
import { StatusBadge } from './status-badge';

interface Hit {
  id: string;
  code: string;
  status: string;
  woodType: string;
  lorryNumber?: string;
  importCode?: string;
}
interface Hits {
  imports: Hit[];
  production: Hit[];
  exports: Hit[];
}
const NONE: Hits = { imports: [], production: [], exports: [] };
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * "Search or jump to…" in the top bar (Ctrl/⌘ K, or / anywhere outside a text field):
 * pages, quick actions, and records found by ID, lorry number or wood type.
 */
export function QuickJump() {
  const { t } = useI18n();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<Hits>(NONE);
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);
  const canRecords = can(Permission.OPERATIONS_CREATE);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the target can be the window or document, not only an element
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // records: one search per pause in typing; only the newest answer is shown
  useEffect(() => {
    const q = text.trim();
    if (!open || !canRecords || q.length < 2) {
      setHits(NONE);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const get = (path: string) => api<{ items: Hit[] }>(`${path}?take=5&q=${encodeURIComponent(q)}`).then((r) => r.items).catch(() => []);
      const [imports, production, exports] = await Promise.all([get('/imports'), get('/production'), get('/exports')]);
      if (id !== latest.current) return;
      setHits({ imports, production, exports });
      setSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [text, open, canRecords]);

  const needle = text.trim().toLowerCase();
  const pages = useMemo(
    () => NAV_ITEMS.filter((n) => can(n.permission)).filter((n) => !needle || t(n.labelKey).toLowerCase().includes(needle)),
    [can, t, needle],
  );
  const actions = useMemo(
    () =>
      (canRecords
        ? [
            { to: '/imports/new', label: t('newImport') },
            { to: '/production/new', label: t('newProduction') },
            { to: '/exports/new', label: t('newExport') },
          ]
        : []
      ).filter((a) => !needle || a.label.toLowerCase().includes(needle)),
    [canRecords, t, needle],
  );

  const go = (to: string) => {
    setOpen(false);
    setText('');
    navigate(to);
  };
  const found = hits.imports.length + hits.production.length + hits.exports.length;

  const records: [keyof Hits, string, typeof ArrowDownToLineIcon, string][] = [
    ['imports', t('imports'), ArrowDownToLineIcon, '/imports/'],
    ['production', t('production'), FactoryIcon, '/production/'],
    ['exports', t('exports'), ArrowUpFromLineIcon, '/exports/'],
  ];

  return (
    <>
      {/* wide screens: looks like a search field; phones: an icon */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden w-56 justify-start gap-2 px-3 font-normal text-muted-foreground md:flex xl:w-72"
      >
        <SearchIcon />
        <span className="flex-1 truncate text-left">{t('quickJump')}</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </Button>
      <Button variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t('quickJump')}>
        <SearchIcon />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setText('');
        }}
        title={t('quickJump')}
        description={t('quickJumpHint')}
        className="top-[15%] translate-y-0 sm:max-w-xl"
        commandProps={{ shouldFilter: false, loop: true }}
      >
        <CommandInput value={text} onValueChange={setText} placeholder={canRecords ? t('quickJumpHint') : t('quickJump')} />
        <CommandList className="max-h-[min(60vh,420px)]">
          {!searching && pages.length + actions.length + found === 0 && <CommandEmpty>{t('noMatches', { q: text.trim() })}</CommandEmpty>}

          {records.map(([key, label, Icon, path]) =>
            hits[key].length ? (
              <CommandGroup key={key} heading={label}>
                {hits[key].map((h) => (
                  <CommandItem key={h.id} value={`${key}-${h.id}`} onSelect={() => go(path + h.id)}>
                    <Icon />
                    <span className="font-medium">{h.code}</span>
                    <span className="truncate text-muted-foreground">
                      {[h.lorryNumber ?? h.importCode, h.woodType].filter(Boolean).join(' · ')}
                    </span>
                    <span className="ml-auto">
                      <StatusBadge status={h.status} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null,
          )}

          {pages.length > 0 && (
            <CommandGroup heading={t('pages')}>
              {pages.map((n) => (
                <CommandItem key={n.path} value={`page-${n.path}`} onSelect={() => go(n.path)}>
                  <n.icon />
                  {t(n.labelKey)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {actions.length > 0 && (
            <CommandGroup heading={t('actions')}>
              {actions.map((a) => (
                <CommandItem key={a.to} value={`action-${a.to}`} onSelect={() => go(a.to)}>
                  <PlusIcon />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className={cn('flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground')}>
          <span>
            <CommandShortcut className="ml-0 tracking-normal">↑↓</CommandShortcut> {t('toMove')}
          </span>
          <span>
            <CommandShortcut className="ml-0 tracking-normal">↵</CommandShortcut> {t('toOpen')}
          </span>
          <span>
            <CommandShortcut className="ml-0 tracking-normal">Esc</CommandShortcut> {t('toClose')}
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
