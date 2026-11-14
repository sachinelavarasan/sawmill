/**
 * Depth and reveal: small, restrained motion that gives the app a sense of layers.
 * Styles live in index.css (.reveal, .stagger, .drift). Everything here stands still for people
 * who ask their device for less motion, and nothing depends on hover (touch screens get the static look).
 */
import { CSSProperties, PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A mouse or trackpad: the only pointers that get the tilt. */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * A section that fades and rises into place the first time it scrolls into view.
 * Shown at once where motion is reduced, where the browser can't watch scrolling, and on paper.
 */
export function Reveal({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(() => reducedMotion() || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (shown || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // start a little before it is fully on screen, so it is settled by the time it is read
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <Tag ref={ref as never} className={cn('reveal', className)} data-shown={shown || undefined}>
      {children}
    </Tag>
  );
}

/**
 * A product preview that leans gently toward the pointer: at most `max` degrees, with perspective,
 * settling back when the pointer leaves. Mouse and trackpad only; a still, slightly tilted resting
 * pose (`rest`) everywhere else. Children may use translateZ to sit in front of the surface.
 */
export function Tilt({
  children,
  className,
  max = 5,
  rest = { x: 8, y: -12 },
}: {
  children: ReactNode;
  className?: string;
  /** most degrees it leans from its resting pose */
  max?: number;
  /** the resting pose, in degrees (x tips the top back, y turns it to the side) */
  rest?: { x: number; y: number };
}) {
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const live = useRef(false);

  useEffect(() => {
    live.current = finePointer() && !reducedMotion();
  }, []);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!live.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // −0.5 … 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    setActive(true);
    setLean({ x: -py * max * 2, y: px * max * 2 });
  };
  const leave = () => {
    setActive(false);
    setLean({ x: 0, y: 0 });
  };

  const style: CSSProperties = {
    transform: `rotateX(${rest.x + lean.x}deg) rotateY(${rest.y + lean.y}deg)`,
    transformStyle: 'preserve-3d',
    // following the pointer is quick; settling back is slow and soft
    transition: active ? 'transform 120ms linear' : 'transform 700ms var(--ease-smooth)',
  };

  return (
    <div className={cn('[perspective:1600px]', className)} onPointerMove={move} onPointerLeave={leave}>
      <div style={style}>{children}</div>
    </div>
  );
}
