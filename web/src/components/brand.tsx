import { PointerEvent, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import iconDark from '../assets/brand/icon-dark.png';
import iconLight from '../assets/brand/icon-light.png';
import wordmarkWhite from '../assets/brand/wordmark-white.png';
import wordmark from '../assets/brand/wordmark.png';

/** Which artwork to draw: made for dark surfaces, for light ones, or whichever suits the theme that is on. */
type BrandVariant = 'dark' | 'light' | 'auto';

/** Two images, one per theme; the dark-theme one takes over when the dark theme is on. */
function themed(variant: BrandVariant, onLight: string, onDark: string, className: string) {
  if (variant !== 'auto') return <img src={variant === 'dark' ? onDark : onLight} alt="" draggable={false} className={className} />;
  return (
    <>
      <img src={onLight} alt="" draggable={false} className={cn(className, 'dark:hidden')} />
      <img src={onDark} alt="" draggable={false} className={cn(className, 'hidden dark:block')} />
    </>
  );
}

/**
 * The TimberTrail icon (the mill, the trees and the sawn timber). `dark` is the navy tile, for dark
 * surfaces such as the sidebar; `light` is the white tile; `auto` follows the theme. Decorative:
 * the name is always written beside it. Size it with `className` (e.g. `size-10`).
 */
export function LogoMark({ className, variant = 'dark' }: { className?: string; variant?: BrandVariant }) {
  return (
    // the artwork carries its own rounded corners (a quarter of its width); the box matches them so shadows fit
    <span className={cn('block size-9 shrink-0 overflow-hidden rounded-[25%]', className)} aria-hidden>
      {themed(variant, iconLight, iconDark, 'size-full')}
    </span>
  );
}

/**
 * The TimberTrail wordmark, with its "Sawmill ERP" line. `light` is for light surfaces (slate and
 * saffron), `dark` for dark ones (white and saffron), `auto` follows the theme. Size it by height.
 */
export function Wordmark({ className, variant = 'auto' }: { className?: string; variant?: BrandVariant }) {
  return (
    <span role="img" aria-label="TimberTrail" className={cn('inline-block h-7 shrink-0', className)}>
      {themed(variant, wordmark, wordmarkWhite, 'h-full w-auto')}
    </span>
  );
}

/**
 * The product name as raised lettering: each letter is a short solid block ("Trail" in saffron).
 * The letters rise in a soft swell that follows the pointer along the name: highest under it,
 * falling away to either side. Each letter eases toward its height frame by frame, so the swell
 * glides rather than stepping from letter to letter. Mouse and trackpad only, and still where
 * motion is reduced. For dark surfaces (the sign-in hero). Styles: `.wordmark-3d` in index.css.
 */
export function Wordmark3D({ className }: { className?: string }) {
  const name = 'TimberTrail';
  const root = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null); // where the pointer is along the name, in its own pixels
  const level = useRef<number[]>([]); // each letter's current rise, 0…1
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const tick = () => {
    const el = root.current;
    if (!el) return;
    const letters = Array.from(el.children) as HTMLElement[];
    const reach = el.offsetWidth / letters.length * 1.6; // how far the swell spreads: about a letter and a half each way
    let moving = false;
    letters.forEach((letter, i) => {
      const x = pointer.current;
      const target = x == null ? 0 : Math.exp(-(((letter.offsetLeft + letter.offsetWidth / 2 - x) / reach) ** 2));
      const now = level.current[i] ?? 0;
      const next = Math.abs(target - now) < 0.002 ? target : now + (target - now) * 0.16;
      if (next !== target) moving = true;
      level.current[i] = next;
      letter.style.setProperty('--p', next.toFixed(3));
    });
    frame.current = moving ? requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  };
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    // measured against the name as drawn (it may be tilted), then mapped back to its own width
    pointer.current = ((e.clientX - r.left) / r.width) * el.offsetWidth;
    start();
  };
  const leave = () => {
    pointer.current = null;
    start();
  };

  return (
    <span ref={root} role="img" aria-label={name} onPointerMove={move} onPointerLeave={leave} className={cn('wordmark-3d font-extrabold tracking-[-0.01em] select-none', className)}>
      {[...name].map((ch, i) => (
        <span key={i} aria-hidden className={i < 6 ? 'wm-light' : 'wm-brand'}>
          {ch}
        </span>
      ))}
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
