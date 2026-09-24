/**
 * The one decision `main.tsx` makes before React starts (011): hydrate the
 * markup that is already on the page, or throw it away and render fresh.
 *
 * Pure, because it is the difference between a silent hydration mismatch and a
 * clean boot, and that deserves a test rather than a console.
 */
import type { Embedded } from './data/types';

/** `/a/b/` and `/a/b` are the same route; `/` stays `/`. */
export function normalizePath(path: string): string {
  const rooted = path.startsWith('/') ? path : `/${path}`;
  const trimmed = rooted.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** The route as the router sees it: the deploy base removed. */
export function stripBase(pathname: string, base: string): string {
  const path = normalizePath(pathname);
  const prefix = normalizePath(base);
  if (prefix === '/') return path;
  if (path === prefix) return '/';
  return path.startsWith(`${prefix}/`) ? normalizePath(path.slice(prefix.length)) : path;
}

/**
 * True only when this page was prerendered for exactly this route. A hub deep
 * link served through `404.html` carries no payload at all, and a payload for
 * some other route means the markup is not ours: both render from scratch.
 */
export function shouldHydrate(
  embedded: Embedded | null,
  pathname: string,
  base: string,
): boolean {
  if (embedded === null) return false;
  return stripBase(pathname, base) === normalizePath(embedded.route);
}
