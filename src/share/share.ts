/**
 * Building and delivering a link to a moment (004 US2, FR-302/304/305,
 * contracts/deep-link.md).
 *
 * Framework-free on purpose: the URL rules and the delivery ladder are the part
 * worth testing without a DOM, and a later surface (timeline markers, a gallery)
 * can reuse them without dragging React in.
 *
 * Nothing here touches playback (FR-306) — a share reads the playhead, it never
 * moves it.
 */
import { momentSearch } from '../playback/deepLink';

/**
 * What became of a share.
 *
 * `'cancelled'` is not in the spec's `copied | shared | shown` list because it
 * produces no viewer-facing outcome at all: a dismissed share sheet is silent
 * (US2 scenario 3), so the UI shows nothing for it. It is a fourth *result*
 * precisely so the caller can tell "nothing to say" apart from "say the link is
 * on the clipboard". Recorded as an appended line in contracts/deep-link.md.
 */
export type DeliverResult = 'shared' | 'copied' | 'shown' | 'cancelled';

/** Just enough of the platform to be stubbable in a test. */
export interface ShareEnv {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
  /**
   * True on the devices whose viewers expect the share sheet rather than a
   * silent copy: a coarse pointer or a narrow viewport (research R3).
   */
  preferShare?: boolean;
}

export interface MomentUrlArgs {
  /** `window.location.origin` — scheme, host, port, no trailing slash. */
  origin: string;
  /** `import.meta.env.BASE_URL`; normalized here so callers need not care. */
  base: string;
  episodeId: number;
  t: number;
}

/** The viewport/pointer test that decides share-sheet-first (research R3). */
export const SHARE_SHEET_MAX_WIDTH = 900;

/**
 * The absolute link a share hands out. Never carries the dev flags (FR-305):
 * it is built from parts, not from the current location.
 */
export function momentUrl({ origin, base, episodeId, t }: MomentUrlArgs): string {
  const path = base === '' ? '/' : base.endsWith('/') ? base : `${base}/`;
  return `${origin}${path}ep/${episodeId}${momentSearch(t)}`;
}

/** A share sheet the viewer dismissed. Duck-typed: stubs throw plain objects. */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Phones and tablets get the sheet; a mouse and a wide window get a copy. */
export function prefersShareSheet(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
    return window.innerWidth <= SHARE_SHEET_MAX_WIDTH;
  } catch {
    // A browser that cannot answer the question gets the desktop behaviour.
    return false;
  }
}

/** What the browser actually offers, read lazily so imports stay side-effect free. */
export function defaultShareEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    share: typeof nav?.share === 'function' ? nav.share.bind(nav) : undefined,
    clipboard: typeof nav?.clipboard?.writeText === 'function' ? nav.clipboard : undefined,
    preferShare: prefersShareSheet(),
  };
}

/**
 * Share sheet → clipboard → show it (research R3). Every step is wrapped: a
 * refused permission, an insecure context or a missing API falls through to the
 * next one, and the last one cannot fail (FR-304, "nothing may throw").
 */
export async function deliver(
  url: string,
  title: string,
  env: ShareEnv = defaultShareEnv(),
): Promise<DeliverResult> {
  if (env.preferShare === true && env.share !== undefined) {
    try {
      await env.share({ title, url });
      return 'shared';
    } catch (error) {
      // A dismissed sheet is an answer, not a failure: say nothing at all.
      if (isAbort(error)) return 'cancelled';
      // Anything else (unsupported data, a host that refused) tries the clipboard.
    }
  }

  if (env.clipboard !== undefined) {
    try {
      await env.clipboard.writeText(url);
      return 'copied';
    } catch {
      // Insecure context, denied permission, no focus: show the link instead.
    }
  }

  return 'shown';
}
