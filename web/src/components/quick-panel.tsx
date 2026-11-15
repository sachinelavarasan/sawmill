/**
 * A record opened beside its list, as a floating panel: a summary card, then whatever the
 * record needs (next step, details, lines). The list stays readable behind it.
 */
import { ArrowUpRightIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

export function QuickPanel({
  open,
  onClose,
  title,
  icon,
  code,
  sub,
  tags,
  fullTo,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** the panel's name, e.g. "Import Details" */
  title: string;
  icon: ReactNode;
  code?: string;
  sub?: ReactNode;
  /** status badge and a few Tag figures */
  tags?: ReactNode;
  /** the full record page */
  fullTo?: string;
  /** the decision to take on the record (e.g. Approve / Reject), kept in view at the bottom */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        // floats over the list with the page still readable behind it; fills the screen on a phone
        overlayClassName="bg-[rgb(17_17_19/0.18)] backdrop-blur-[2px]"
        // z-60: above the list's selected row (z-55), which itself sits above the backdrop (z-50)
        className="inset-0 z-[60] w-full gap-0 overflow-hidden border-0 bg-card sm:inset-y-3 sm:right-3 sm:left-auto sm:h-auto sm:w-[34rem] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-3xl sm:shadow-pop"
      >
        <div className="flex min-h-16 items-center border-b border-border px-6 py-4 pr-16 text-base font-semibold tracking-tight font-display">{title}</div>
        <div className="scroll-quiet flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-4 rounded-2xl bg-secondary p-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-card text-saffron [&_svg]:size-7 [&_svg]:stroke-[1.75]">{icon}</span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl leading-tight">{code}</SheetTitle>
              <SheetDescription className="mt-0.5 truncate">{sub}</SheetDescription>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{tags}</div>
            </div>
          </div>
          {children}
        </div>
        {(fullTo || actions) && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-6 py-4">
            {fullTo && (
              <Button asChild variant={actions ? 'ghost' : 'outline'} className={actions ? 'mr-auto' : undefined}>
                <Link to={fullTo}>
                  <ArrowUpRightIcon /> {t('openFullRecord')}
                </Link>
              </Button>
            )}
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A small grey figure beside the status badge. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground/70 tabular-nums">{children}</span>;
}

/** Read-only values laid out like a form: two to a row. */
export function Boxes({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-4">{children}</div>;
}

/** A read-only value drawn like a form field: label above, the value in a bordered box. `wide` spans the row. */
export function Box({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex min-h-11 items-center rounded-xl bg-secondary px-3.5 py-2.5 text-sm font-medium break-words">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

/** A bordered card for the record's lines: a summary and an action in its header, a small table below. */
export function LinesCard({
  label,
  summary,
  action,
  head,
  rows,
  empty,
  loading,
}: {
  label: string;
  summary: ReactNode;
  action?: ReactNode;
  /** column headings; the first is left-aligned, the rest right-aligned */
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
          <span className="text-sm text-muted-foreground tabular-nums">{summary}</span>
          {action}
        </div>
        {loading ? (
          <div className="m-4 h-24 animate-pulse rounded-lg bg-muted" />
        ) : rows.length === 0 ? (
          <p className="border-t px-4 py-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border bg-secondary text-xs">
                {head.map((h, i) => (
                  <th key={h} className={cn('px-4 py-2.5 font-medium', i ? 'text-right' : 'text-left')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 tabular-nums">
              {rows.map((r) => (
                <tr key={r.key}>
                  {r.cells.map((c, i) => (
                    <td key={i} className={cn('px-4 py-2.5', i && 'text-right', i === r.cells.length - 1 && 'font-medium')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
