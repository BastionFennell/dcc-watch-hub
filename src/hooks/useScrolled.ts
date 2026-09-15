import { useEffect, useState } from 'react';

/**
 * True once the window is scrolled past `threshold` pixels. Drives the header's
 * shrink (FR-051) without measuring layout on every frame: a passive listener and
 * a boolean, so React only re-renders on the crossing.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () => setScrolled(window.scrollY > threshold);
    read();
    window.addEventListener('scroll', read, { passive: true });
    return () => window.removeEventListener('scroll', read);
  }, [threshold]);

  return scrolled;
}

export default useScrolled;
