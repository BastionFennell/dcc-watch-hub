/**
 * The one decision `main.tsx` makes before React starts (011): hydrate the
 * markup that is already on the page, or throw it away and render fresh.
 *
 * Pure, because it is the difference between a silent hydration mismatch and a
 * clean boot, and that deserves a test rather than a console.
 */
import type { Embedded } from './data/types';

/**
 * The attribute the prerenderer's head tags carry (`src/site/seo.tsx` writes
 * it) and the browser strips. It lives here, in the viewer's entry chunk,
 * because `main.tsx` needs it before anything else loads - and because the
 * marketing chunk must not be pulled in to read one string.
 */
export const PRERENDERED_HEAD_ATTR = 'data-dcc-head';

/**
 * The shell's own placeholder head (`index.html`, and therefore `404.html`).
 * A hub route boots from that shell, so its title and description are what the
 * tab shows until the page's own `<Seo>` lands - and then they are one title
 * too many, so `<Seo>` removes them on mount.
 */
export const SHELL_HEAD_ATTR = 'data-dcc-shell';

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

/**
 * Takes the prerenderer's head tags out, just before React renders the same
 * values as its own hoistables. Without this every prerendered page ends up
 * with two titles, two canonicals and two of each OpenGraph tag - identical in
 * content, but a crawler that reads the rendered DOM has to pick one.
 *
 * Only what the prerenderer wrote is marked, so the shell's own `<title>` and
 * description survive on a hub route, where they are the placeholder until the
 * page's own head lands.
 */
export function clearPrerenderedHead(doc: Document): number {
  const marked = doc.head.querySelectorAll(`[${PRERENDERED_HEAD_ATTR}]`);
  for (const node of marked) node.remove();
  return marked.length;
}
