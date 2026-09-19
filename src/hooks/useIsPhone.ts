import { useEffect, useState } from 'react';

/**
 * The stacked layout's breakpoint, shared with `usePanel`'s overlay rule and the
 * page's own media queries (spec 006: "≤ 900 px, the existing breakpoint").
 */
const PHONE_QUERY = '(max-width: 900px)';

/** jsdom has no `matchMedia`, and neither does a very old browser. */
function phoneQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(PHONE_QUERY);
  } catch {
    return null;
  }
}

/**
 * True at phone/tablet widths (≤ 900 px), false wherever `matchMedia` is
 * missing - so a host without it (or jsdom) always gets the desktop tree, which
 * is the one every existing test asserts (FR-505).
 *
 * Viewer state, not overlay state (constitution I): nothing here is derived from
 * the event log, and nothing is persisted.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => phoneQuery()?.matches ?? false);

  useEffect(() => {
    const query = phoneQuery();
    if (!query) return;
    const apply = () => setPhone(query.matches);
    // The width may have changed between the first render and this effect.
    apply();
    const listen = typeof query.addEventListener === 'function';
    if (listen) query.addEventListener('change', apply);
    return () => {
      if (listen) query.removeEventListener('change', apply);
    };
  }, []);

  return phone;
}

export default useIsPhone;
