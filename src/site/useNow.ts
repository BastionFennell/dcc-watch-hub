/**
 * The clock, kept out of `gate.ts` so the gate stays pure (011).
 *
 * A prerendered page is HTML written at build time: its first client render
 * must produce exactly the same markup or React reports a hydration mismatch.
 * So `useNow` returns the value it was given - the caller passes whatever the
 * server used, typically `status.generatedAt` - and only then, after mount,
 * starts telling the truth.
 */
import { useEffect, useState } from 'react';

/**
 * @param intervalMs how often to re-read the clock after mount; `0` re-reads
 *   once and stops, which is all a page with no visible countdown needs.
 * @param initial the value of the first render. Defaults to now, which is
 *   right for every page that was not prerendered.
 */
export function useNow(intervalMs: number, initial: number = Date.now()): number {
  const [now, setNow] = useState(initial);

  useEffect(() => {
    setNow(Date.now());
    if (!(intervalMs > 0)) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
