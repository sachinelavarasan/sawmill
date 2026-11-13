/**
 * Small SVG charts following the dataviz spec: 2px lines, ≤24px bars with a 4px
 * rounded data-end (square at the baseline), 2px surface gaps, hairline solid grid,
 * legend for ≥2 series, crosshair/hover tooltip (also on keyboard), and a table
 * view so no value is gated behind hover. Colours come from --chart-* tokens
 * (validated for light and dark); text always uses text tokens.
 */
import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

export interface Series {
  key: string;
  label: string;
  /** a CSS colour, normally var(--chart-1) / var(--chart-2) */
  color: string;
}
type Datum = Record<string, string | number>;

// ───────── helpers ─────────

/** The element's width: measured right away on mount, then kept current on resize. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean axis ticks from 0 to ≥max. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
export const axisNumber = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : n.toLocaleString('en-IN'));

/** A vertical bar: 4px rounded top (data end), square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
/** A horizontal segment; `roundEnd` rounds the right (data) end. */
function hbarPath(x: number, y: number, w: number, h: number, roundEnd: boolean) {
  if (!roundEnd) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

// ───────── frame: card, legend, tooltip, table view ─────────

export function ChartCard({
  title,
  subtitle,
  series,
  table,
  empty,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  /** legend entries; omitted for a single series (the title names it) */
  series?: (Series & { shape?: 'line' | 'rect' })[];
  /** rows for the table view */
  table: { columns: string[]; rows: (string | number)[][] };
  empty?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <CardDescription className="mt-0.5 text-xs">{subtitle}</CardDescription>}
        </div>
        {!empty && (
          <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs text-muted-foreground" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? t('showChart') : t('showTable')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4">
        {series && series.length > 1 && !asTable && !empty && (
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                {s.shape === 'line' ? (
                  <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
                ) : (
                  <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
                )}
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {empty ? (
          <div className="grid h-44 place-items-center text-sm text-muted-foreground">{t('noChartData')}</div>
        ) : asTable ? (
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {table.columns.map((c, i) => (
                    <TableHead key={c} className={cn('h-8 text-xs', i > 0 && 'text-right')}>
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r, ri) => (
                  <TableRow key={ri}>
                    {r.map((v, i) => (
                      <TableCell key={i} className={cn('py-1.5 text-xs', i > 0 && 'text-right tabular-nums')}>
                        {v}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Tooltip box: values lead (strong), series names follow; line keys, not boxes. */
function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: { label: string; value: string; color: string }[] }) {
  const left = Math.min(Math.max(x + 12, 0), Math.max(width - 168, 0));
  return (
    <div className="pointer-events-none absolute z-10 w-40 rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md" style={{ left, top: Math.max(y - 8, 0) }} role="presentation">
      <div className="mb-1 text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
          <span className="font-semibold text-foreground tabular-nums">{r.value}</span>
          <span className="truncate text-muted-foreground">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const PAD = { top: 8, right: 8, bottom: 22, left: 44 };

/** Gridlines + y ticks + baseline, shared by line and column charts. */
function YAxis({ ticks, y, width, format }: { ticks: number[]; y: (v: number) => number; width: number; format: (n: number) => string }) {
  return (
    <g>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} className={tk === 0 ? 'stroke-chart-axis' : 'stroke-border'} strokeWidth={1} shapeRendering="crispEdges" />
          <text x={PAD.left - 6} y={y(tk)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
            {format(tk)}
          </text>
        </g>
      ))}
    </g>
  );
}

// ───────── line chart (trend over time) ─────────

export function LineChart({
  data,
  xKey,
  series,
  formatX,
  formatValue,
  height = 200,
  ariaLabel,
}: {
  data: Datum[];
  xKey: string;
  series: Series[];
  formatX: (v: string) => string;
  formatValue: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]))));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - v / top) * (height - PAD.top - PAD.bottom);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));

  const pick = (clientX: number, el: Element) => {
    const rx = clientX - el.getBoundingClientRect().left;
    setHover(Math.min(n - 1, Math.max(0, Math.round(((rx - PAD.left) / plotW) * (n - 1)))));
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
            else return;
            e.preventDefault();
          }}
        >
          <YAxis ticks={ticks} y={y} width={width} format={axisNumber} />
          {data.map((d, i) =>
            (i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.75) || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
                {formatX(String(d[xKey]))}
              </text>
            ) : null,
          )}
          {series.length === 1 && (
            <path
              d={`M${x(0)},${y(0)} ${data.map((d, i) => `L${x(i)},${y(Number(d[series[0].key]))}`).join(' ')} L${x(n - 1)},${y(0)}Z`}
              style={{ fill: series[0].color }}
              fillOpacity={0.1}
            />
          )}
          {series.map((s) => (
            <path
              key={s.key}
              d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(d[s.key]))}`).join(' ')}
              fill="none"
              style={{ stroke: s.color }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* end markers: ≥8px, 2px surface ring */}
          {series.map((s) => (
            <circle key={s.key} cx={x(n - 1)} cy={y(Number(data[n - 1]?.[s.key] ?? 0))} r={4} style={{ fill: s.color }} className="stroke-card" strokeWidth={2} />
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} className="stroke-muted-foreground/50" strokeWidth={1} shapeRendering="crispEdges" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]))} r={4} style={{ fill: s.color }} className="stroke-card" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <Tooltip
          x={x(hover)}
          y={PAD.top}
          width={width}
          title={formatX(String(data[hover][xKey]))}
          rows={series.map((s) => ({ label: s.label, value: formatValue(Number(data[hover][s.key])), color: s.color }))}
        />
      )}
    </div>
  );
}

// ───────── column chart (compare per period; grouped for ≥2 series) ─────────

export function ColumnChart({
  data,
  xKey,
  series,
  formatX,
  formatValue,
  formatAxis = axisNumber,
  height = 200,
  ariaLabel,
}: {
  data: Datum[];
  xKey: string;
  series: Series[];
  formatX: (v: string) => string;
  formatValue: (n: number) => string;
  formatAxis?: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]))));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const band = plotW / Math.max(n, 1);
  const gap = 2; // surface gap between touching bars
  const barW = Math.min(24, Math.max(3, (band * 0.7 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => PAD.top + (1 - v / top) * (height - PAD.top - PAD.bottom);
  const base = y(0);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 44))));

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
            else return;
            e.preventDefault();
          }}
        >
          <YAxis ticks={ticks} y={y} width={width} format={formatAxis} />
          {data.map((d, i) => {
            const gx = PAD.left + band * i + (band - groupW) / 2;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                {/* hit target: the whole band, bigger than the marks */}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={base - PAD.top} fill="transparent" />
                {series.map((s, si) => {
                  const v = Number(d[s.key]);
                  const h = Math.max(base - y(v), 0);
                  return h > 0 ? (
                    <path key={s.key} d={columnPath(gx + si * (barW + gap), base - h, barW, h)} style={{ fill: s.color }} opacity={hover == null || hover === i ? 1 : 0.55} />
                  ) : null;
                })}
                {((i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.75) || i === n - 1) && (
                  <text x={PAD.left + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {formatX(String(d[xKey]))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && (
        <Tooltip
          x={PAD.left + band * hover + band / 2}
          y={PAD.top}
          width={width}
          title={formatX(String(data[hover][xKey]))}
          rows={series.map((s) => ({ label: s.label, value: formatValue(Number(data[hover][s.key])), color: s.color }))}
        />
      )}
    </div>
  );
}

// ───────── horizontal stacked bars (part-to-whole per row) ─────────

export function StackedBars({
  rows,
  series,
  formatValue,
  ariaLabel,
}: {
  rows: { label: string; values: Record<string, number> }[];
  series: Series[];
  formatValue: (n: number) => string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ row: number; key: string; x: number; y: number } | null>(null);
  const BAR = 20;
  const ROW = 36;
  const labelW = Math.min(110, Math.max(70, width * 0.28));
  // room for the total printed after each bar (≈6.2px per character at 11px)
  const valueW = 12 + 6.2 * Math.max(...rows.map((r) => formatValue(series.reduce((a, s) => a + Math.max(0, r.values[s.key] ?? 0), 0)).length), 4);
  const plotW = Math.max(width - labelW - valueW, 10);
  const max = Math.max(1, ...rows.map((r) => series.reduce((a, s) => a + Math.max(0, r.values[s.key] ?? 0), 0)));
  const height = rows.length * ROW;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block" onPointerLeave={() => setHover(null)}>
          {rows.map((r, ri) => {
            const y0 = ri * ROW + (ROW - BAR) / 2;
            const parts = series.map((s) => ({ s, v: Math.max(0, r.values[s.key] ?? 0) })).filter((p) => p.v > 0);
            const total = parts.reduce((a, p) => a + p.v, 0);
            let cursor = labelW;
            return (
              <g key={r.label}>
                <text x={0} y={y0 + BAR / 2} dy="0.32em" className="fill-foreground text-xs">
                  {r.label.length > 14 ? `${r.label.slice(0, 13)}…` : r.label}
                </text>
                {parts.map((p, pi) => {
                  const w = (p.v / max) * plotW;
                  const isLast = pi === parts.length - 1;
                  const segW = Math.max(w - (isLast ? 0 : 2), 1); // 2px surface gap between segments
                  const x0 = cursor;
                  cursor += w;
                  return (
                    <path
                      key={p.s.key}
                      d={hbarPath(x0, y0, segW, BAR, isLast)}
                      style={{ fill: p.s.color }}
                      opacity={!hover || (hover.row === ri && hover.key === p.s.key) ? 1 : 0.55}
                      onPointerEnter={() => setHover({ row: ri, key: p.s.key, x: x0 + segW / 2, y: y0 })}
                    />
                  );
                })}
                <text x={cursor + 6} y={y0 + BAR / 2} dy="0.32em" className="fill-muted-foreground text-[11px] tabular-nums">
                  {formatValue(total)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <Tooltip
          x={hover.x}
          y={hover.y + 24}
          width={width}
          title={rows[hover.row].label}
          rows={series.map((s) => ({ label: s.label, value: formatValue(rows[hover.row].values[s.key] ?? 0), color: s.color }))}
        />
      )}
    </div>
  );
}
