import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';

// Motion, iOS-style: things slide/fade/scale in and out with a soft ease-out
// instead of snapping (keyframes live in app.css). Honors "Reduce Motion".

export const MOTION_MS = 260;

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type PresenceState = 'open' | 'closing';

/**
 * Keeps something on screen for its exit animation. While `value` is set, returns it with
 * state "open"; when it becomes empty, returns the LAST value with state "closing" for `ms`,
 * then null. Render with data-state={state} and let the CSS animate.
 */
export function usePresence<T>(value: T | null | undefined | false, ms = MOTION_MS): { item: T | null; state: PresenceState | null } {
  const [last, setLast] = useState<T | null>(value || null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (value) {
      setLast(value);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setLast(null);
      setClosing(false);
    }, reducedMotion() ? 0 : ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  if (value) return { item: value, state: 'open' };
  if (last && closing) return { item: last, state: 'closing' };
  return { item: null, state: null };
}

/**
 * Swipe-down-to-close for bottom sheets on phones. Spread `handle` on the grab area and
 * put `ref` on the sheet. The sheet follows the finger; a long or quick swipe closes it,
 * otherwise it springs back.
 */
export function useSheetDrag(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number; id: number } | null>(null);
  const setY = (dy: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${MOTION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)` : 'none';
    el.style.transform = dy ? `translateY(${dy}px)` : '';
  };
  const handle = {
    onPointerDown: (e: RPointerEvent) => {
      drag.current = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: RPointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      d.dy = Math.max(0, e.clientY - d.y0);
      setY(d.dy, false);
    },
    onPointerUp: (e: RPointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.id !== e.pointerId) return;
      const speed = d.dy / Math.max(1, performance.now() - d.t0); // px per ms
      if (d.dy > 90 || (d.dy > 20 && speed > 0.6)) onClose();
      else setY(0, true); // spring back
    },
    onPointerCancel: () => {
      drag.current = null;
      setY(0, true);
    },
    style: { touchAction: 'none' } as CSSProperties,
  };
  return { ref, handle };
}
