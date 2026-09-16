/**
 * Applying `?t=` once per visit (004 US1, FR-300, contracts/deep-link.md).
 *
 * The hook is deliberately tiny: it reads the moment out of the location, and
 * the first time a `TimeSource` exists for that `(episode, search)` pair it
 * seeks there — once. The YouTube adapter queues a seek issued before the
 * player is ready (time-source contract §6), so calling this above the source
 * is safe and is in fact the normal case.
 *
 * `linkedT` is returned straight from the parse, so the page knows a link is in
 * play on the very first render — before the seek has had a chance to run —
 * which is what `useResume`'s `suppressOffer` needs (FR-301).
 *
 * Constitution I/II: the only thing that happens here is `source.seek(t)`. No
 * overlay state is written, and the playhead is reached through `TimeSource`.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import type { EpisodeMeta } from '../data/types';
import type { TimeSource } from './TimeSource';
import { parseDeepLinkT } from './deepLink';

export interface DeepLink {
  /** The linked second, or `null` when the URL names none (or names a bad one). */
  linkedT: number | null;
}

export function useDeepLink(meta: EpisodeMeta | undefined, source: TimeSource | null): DeepLink {
  const { search } = useLocation();
  const linkedT = meta === undefined ? null : parseDeepLinkT(search, meta.durationSec);
  /** One visit = one `(episode, search)` pair; a rerender is not a new visit. */
  const key = meta === undefined ? null : `${meta.id}:${search}`;
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (key === null || linkedT === null || source === null) return;
    if (appliedRef.current === key) return;
    appliedRef.current = key;
    try {
      source.seek(linkedT);
    } catch {
      // A host that refuses a seek is not worth crashing the page over; the
      // overlay simply stays where the playhead actually is.
    }
  }, [key, linkedT, source]);

  return { linkedT };
}

export default useDeepLink;
