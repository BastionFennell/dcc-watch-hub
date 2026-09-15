/**
 * Deep links to a moment (004 US1, FR-300, contracts/deep-link.md).
 *
 * `/ep/<id>?t=<seconds>` names a whole second inside the final edit. Parsing is
 * framework-free and total: anything that is not a finite second inside the
 * episode is `null`, which every caller reads as "no link was given" — the page
 * then behaves exactly as it does on a bare visit (spec US1 scenario 3).
 *
 * Constitution I is untouched by any of this: a deep link only moves the
 * playhead. The overlay is recomputed from `initialState` at the new time like
 * it is after any other seek.
 */

/** The one query parameter this feature owns. */
export const DEEP_LINK_PARAM = 't';

/**
 * The moment `search` names, or `null`.
 *
 * `search` may be given with or without its leading `?` (`useLocation().search`
 * carries one, a hand-built string often does not). Decimals are floored, so
 * `?t=156.9` is 2:36 and not 2:37 — the second the viewer was watching.
 */
export function parseDeepLinkT(search: string, durationSec: number): number | null {
  if (!Number.isFinite(durationSec) || durationSec < 0) return null;

  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
    DEEP_LINK_PARAM,
  );
  if (raw === null || raw.trim() === '') return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  const t = Math.floor(value);
  if (t < 0 || t > durationSec) return null;
  return t;
}

/** The search string a share link carries — never the dev flags (FR-305). */
export function momentSearch(t: number): string {
  const whole = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
  return `?${DEEP_LINK_PARAM}=${whole}`;
}
