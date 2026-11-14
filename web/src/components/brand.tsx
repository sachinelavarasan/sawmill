import { cn } from '@/lib/utils';

/** The app mark: the end grain of a sawn log on a saffron tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground', className)}>
      <svg viewBox="0 0 24 24" className="size-[64%]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12.4" cy="11.7" r="5.6" />
        <circle cx="12.8" cy="11.4" r="1.9" />
        <path d="M12 2.5v3.4" />
      </svg>
    </span>
  );
}

/** Growth rings, drawn large and faint behind the login hero. */
export function GrowthRings({ className }: { className?: string }) {
  return (
    <svg className={cn('pointer-events-none absolute', className)} viewBox="0 0 420 420" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden>
      {[26, 52, 80, 110, 141, 173, 205].map((r, i) => (
        <circle key={r} cx={210 + i * 2} cy={210 - i * 1.5} r={r} />
      ))}
    </svg>
  );
}
