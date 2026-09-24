/**
 * Privacy-respecting analytics (011 §7): Plausible, cookieless, and absent
 * unless the deploy asks for it. No banner, no identifiers, no fallback
 * provider - if `VITE_PLAUSIBLE_DOMAIN` is unset, not a byte is loaded and
 * `track` is a no-op, which is exactly what `npm run dev` and every test get.
 */

/** The outbound-links build counts YouTube and Discord clicks on its own. */
const SCRIPT_SRC = 'https://plausible.io/js/script.outbound-links.js';
const SCRIPT_ID = 'plausible-analytics';

type PlausibleFn = ((name: string, options?: { props?: Record<string, unknown> }) => void) & {
  q?: unknown[];
};

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/** The configured site domain, or `null` when analytics is off. */
export function analyticsDomain(): string | null {
  const domain = import.meta.env?.VITE_PLAUSIBLE_DOMAIN;
  return domain === undefined || domain === '' ? null : domain;
}

/**
 * One custom event. Silent when the script was never installed, so a call site
 * never has to ask whether analytics is on (011: `hub_open`, `crawler_view`).
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const plausible = window.plausible;
  if (typeof plausible !== 'function') return;
  if (props === undefined) plausible(name);
  else plausible(name, { props });
}

/**
 * Appends the script, once, and only when a domain is configured. The queue
 * shim is Plausible's own: an event fired before the script finishes loading
 * is held and replayed rather than lost.
 */
export function installAnalytics(): void {
  if (typeof document === 'undefined') return;
  const domain = analyticsDomain();
  if (domain === null) return;
  if (document.getElementById(SCRIPT_ID) !== null) return;

  if (typeof window.plausible !== 'function') {
    const queued: PlausibleFn = ((...args: unknown[]) => {
      (queued.q = queued.q ?? []).push(args);
    }) as PlausibleFn;
    window.plausible = queued;
  }

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.defer = true;
  script.src = SCRIPT_SRC;
  script.setAttribute('data-domain', domain);
  document.head.appendChild(script);
}
