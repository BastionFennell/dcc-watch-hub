import { useCallback, useEffect, useState } from 'react';

export interface UseMiniPlayerOptions {
  /** Phone widths only (`useIsPhone`); desktop never docks (FR-505). */
  enabled: boolean;
  /** How far the sticky header reaches down the viewport. */
  headerPx?: number;
  /**
   * Force the full stage back: the resume offer and the ended card need it
   * (FR-501), so while either is showing the mini-player is cancelled.
   */
  cancel?: boolean;
}

export interface MiniPlayerApi {
  /** True while the stage's slot has scrolled up past the header. */
  docked: boolean;
  /** Callback ref for the 1 px sentinel at the top of the stage's slot. */
  sentinelRef: (element: HTMLElement | null) => void;
  /** Scroll back to the full stage (FR-501), reduced-motion aware (FR-506). */
  exitMini(): void;
}

/** jsdom has no `matchMedia`, and neither does a very old browser. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The phone mini-player's one bit of state (FR-500, research R1).
 *
 * An `IntersectionObserver` watches a sentinel at the top of the stage's slot,
 * inset by the header's height, and reports "scrolled past" — not merely "out of
 * view", which is also true before the viewer has reached the stage at all.
 * Hence the `boundingClientRect.top` check: only a sentinel that has gone *up*
 * past the header docks the player.
 *
 * Nothing is re-parented and nothing remounts: the page turns `docked` into a
 * `data-mini` attribute and CSS does the rest, so the host iframe never reloads
 * (constitution II, spec assumption 1).
 *
 * Where `IntersectionObserver` is missing (jsdom, very old browsers) the player
 * simply never docks.
 */
export function useMiniPlayer({
  enabled,
  headerPx = 48,
  cancel = false,
}: UseMiniPlayerOptions): MiniPlayerApi {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [past, setPast] = useState(false);

  const sentinelRef = useCallback((element: HTMLElement | null) => {
    setSentinel(element);
  }, []);

  useEffect(() => {
    setPast(false);
    if (!enabled || !sentinel) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < headerPx);
      },
      { rootMargin: `-${headerPx}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, headerPx, sentinel]);

  const exitMini = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);

  return { docked: enabled && !cancel && past, sentinelRef, exitMini };
}

export default useMiniPlayer;
