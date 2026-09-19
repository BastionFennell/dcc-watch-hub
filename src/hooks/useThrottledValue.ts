import { useEffect, useRef, useState } from 'react';

/**
 * `value`, but changing at most once every `ms`.
 *
 * The broadcast log's count sits in a polite live region, and while the
 * broadcast plays it changes every time an event elapses. Without a floor a
 * screen reader would read a queue of counts nobody asked for (005 FR-406,
 * research R5). The first change after mount lands immediately - it is the
 * follow-up storm that needs spacing - and the last value in any window always
 * wins, so the text is never left stale.
 *
 * This throttles a *viewer notice*, never overlay state: the value handed in is
 * already a pure function of the playhead, and this only delays saying it.
 */
export function useThrottledValue<T>(value: T, ms = 1000): T {
  const [shown, setShown] = useState(value);
  // 0, not `Date.now()`: nothing has been announced yet, so the first change
  // is not competing with anything.
  const lastRef = useRef(0);

  useEffect(() => {
    if (Object.is(shown, value)) return;

    const wait = lastRef.current + ms - Date.now();
    if (wait <= 0) {
      lastRef.current = Date.now();
      setShown(value);
      return;
    }

    // A later change inside the window replaces this one: the cleanup drops the
    // pending announcement and the new effect re-measures the same window.
    const timer = setTimeout(() => {
      lastRef.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, ms, shown]);

  return shown;
}

export default useThrottledValue;
