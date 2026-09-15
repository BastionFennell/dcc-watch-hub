/**
 * Resume-where-you-left-off (US3, FR-130..FR-133, contracts/resume-storage.md).
 *
 * The hook owns three jobs and nothing else:
 *  1. Offer — on mount (and on episode change) load the saved record and offer
 *     it when it is far enough from both ends to be worth rejoining.
 *  2. Save — while playing, at most once every 5 s; immediately on pause, on
 *     `pagehide`, on `visibilitychange` → hidden, on episode change and on
 *     unmount. Never while the viewer still owes us an answer.
 *  3. Clear — when playback ends or the playhead reaches the last 30 s.
 *
 * Constitution I: only the playhead is persisted. Nothing here reads, writes,
 * or derives overlay state; on rejoin the overlay is recomputed from the
 * restored playhead like any other seek.
 *
 * Every store call is wrapped again here: the store already swallows its own
 * exceptions, but an injected store (tests, a future backend) may not, and a
 * storage failure must never reach playback.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EpisodeMeta } from '../data/types';
import type { TimeSource } from './TimeSource';
import type { Playhead } from './usePlayhead';
import type { ResumeStore } from './resume';
import { resumeStore } from './resume';

/** A record is only worth offering once the viewer is this far in. */
export const RESUME_MIN_OFFER_SEC = 30;
/** ...and not inside the closing stretch, which counts as finished. */
export const RESUME_TAIL_SEC = 30;
/** Throttle for saves while playing. */
export const RESUME_SAVE_INTERVAL_MS = 5_000;
/** An unanswered offer expires once the broadcast has run this far on its own. */
export const RESUME_OFFER_GRACE_SEC = 5;
/** The first second is indistinguishable from "never started". */
export const RESUME_MIN_SAVE_SEC = 1;

export interface ResumeOffer {
  /** Saved playhead, in seconds. */
  t: number;
}

export interface ResumeApi {
  /** The unanswered offer, or null when there is nothing to ask. */
  pending: ResumeOffer | null;
  /** Seek to the saved time (queued if the source has not arrived yet). */
  rejoin(): void;
  /** Discard the saved position and stay at the top. */
  startOver(): void;
}

/** Everything the listeners and the cleanup need, kept fresh in a ref. */
interface LatestPlayback {
  /** null while the page has no episode (loading, 404): nothing is saved then. */
  episodeId: number | null;
  durationSec: number;
  t: number;
  playing: boolean;
  ended: boolean;
}

/** True while the playhead is inside the stretch that counts as "finished". */
function inTail(t: number, durationSec: number): boolean {
  return durationSec > 0 && t >= durationSec - RESUME_TAIL_SEC;
}

/**
 * `meta` is optional so a page can call the hook above its own `meta` guard,
 * the way `usePanel(meta?.id)` already does; with no episode the hook offers
 * nothing and stores nothing.
 */
export function useResume(
  meta: EpisodeMeta | undefined,
  source: TimeSource | null,
  playhead: Playhead,
  store: ResumeStore = resumeStore,
): ResumeApi {
  const [pending, setPending] = useState<ResumeOffer | null>(null);
  const episodeId = meta?.id ?? null;
  const durationSec = meta?.durationSec ?? 0;

  const storeRef = useRef<ResumeStore>(store);
  const latestRef = useRef<LatestPlayback>({
    episodeId,
    durationSec,
    t: playhead.t,
    playing: playhead.playing,
    ended: playhead.ended,
  });
  /** Mirrors `pending` synchronously — effects and callbacks cannot wait for a render. */
  const offerRef = useRef<ResumeOffer | null>(null);
  /** Wall-clock stamp of the last write, for the 5 s throttle. */
  const lastSaveAtRef = useRef(0);
  /** True once this episode has been cleared; reset when the playhead leaves the tail. */
  const clearedRef = useRef(false);
  /** `playhead.playing` at the previous run, to catch the transition to paused. */
  const wasPlayingRef = useRef(false);
  /**
   * False until the playhead is known to belong to this episode. On an episode
   * change React re-renders with the new `meta` one commit before the new
   * source's playhead resets, and that stale time must not be saved under the
   * new id — nor count as "the viewer played past the offer". The first
   * episode needs no such proof (and the dev scrubber may open at `?t=`).
   */
  const armedRef = useRef(false);
  const seenEpisodeRef = useRef(false);
  /** A rejoin answered before the source existed. */
  const queuedSeekRef = useRef<number | null>(null);

  /* ------------------------------------------------------------ store calls */

  const safeSave = useCallback((episodeId: number, t: number) => {
    try {
      storeRef.current.save(episodeId, t);
    } catch {
      // Storage failures are silent (FR-133).
    }
  }, []);

  const safeClear = useCallback((episodeId: number) => {
    try {
      storeRef.current.clear(episodeId);
    } catch {
      // As above.
    }
  }, []);

  /**
   * Write the latest known playhead for the episode it belongs to. Used by the
   * `pagehide` / `visibilitychange` listeners, the episode change and unmount.
   */
  const flushLatest = useCallback(() => {
    const latest = latestRef.current;
    if (latest.episodeId === null) return;
    if (offerRef.current !== null) return; // the viewer has not chosen yet
    if (latest.ended) return;
    if (inTail(latest.t, latest.durationSec)) return;
    if (latest.t < RESUME_MIN_SAVE_SEC) return;
    safeSave(latest.episodeId, latest.t);
    lastSaveAtRef.current = Date.now();
  }, [safeSave]);

  /** Answer the offer: it is gone either way. */
  const resolveOffer = useCallback(() => {
    offerRef.current = null;
    setPending(null);
  }, []);

  /* -------------------------------------------------------------- ref sync */
  // Declared first so its setup runs after the episode effect's cleanup: on an
  // episode change the cleanup still sees the previous episode's playhead.
  useEffect(() => {
    storeRef.current = store;
    latestRef.current = {
      episodeId,
      durationSec,
      t: playhead.t,
      playing: playhead.playing,
      ended: playhead.ended,
    };
  });

  /* ------------------------------------------------- load the saved record */

  useEffect(() => {
    clearedRef.current = false;
    wasPlayingRef.current = false;
    armedRef.current = !seenEpisodeRef.current;
    if (episodeId !== null) seenEpisodeRef.current = true;
    lastSaveAtRef.current = 0;
    queuedSeekRef.current = null;

    let saved: number | null = null;
    try {
      saved = episodeId === null ? null : (storeRef.current.load(episodeId)?.t ?? null);
    } catch {
      saved = null;
    }

    offerRef.current =
      saved !== null &&
      saved >= RESUME_MIN_OFFER_SEC &&
      saved <= durationSec &&
      saved <= durationSec - RESUME_TAIL_SEC
        ? { t: saved }
        : null;
    setPending(offerRef.current);

    // Episode change or unmount: the previous episode's position is written
    // from the ref, which this render's sync effect has not touched yet.
    return flushLatest;
  }, [episodeId, durationSec, flushLatest]);

  /* ------------------------------------------------- save / clear on ticks */

  useEffect(() => {
    if (episodeId === null) return;
    const { t, playing, ended } = playhead;

    if (!armedRef.current) {
      // A fresh source always starts at the top, so the first run at or below
      // the grace window is the one that proves the playhead is this episode's.
      if (t <= RESUME_OFFER_GRACE_SEC) armedRef.current = true;
      wasPlayingRef.current = playing;
      return;
    }

    if (ended || inTail(t, durationSec)) {
      // Finished: the saved position is worthless and must not come back.
      if (!clearedRef.current) {
        safeClear(episodeId);
        clearedRef.current = true;
      }
    } else {
      clearedRef.current = false;

      if (offerRef.current !== null) {
        // An unanswered offer blocks every write; the broadcast running past
        // the grace window is itself an answer ("just play").
        if (t >= RESUME_OFFER_GRACE_SEC) resolveOffer();
      } else if (t >= RESUME_MIN_SAVE_SEC) {
        const now = Date.now();
        if (playing) {
          if (now - lastSaveAtRef.current >= RESUME_SAVE_INTERVAL_MS) {
            safeSave(episodeId, t);
            lastSaveAtRef.current = now;
          }
        } else if (wasPlayingRef.current) {
          safeSave(episodeId, t);
          lastSaveAtRef.current = now;
        }
      }
    }

    wasPlayingRef.current = playing;
  }, [episodeId, durationSec, playhead, safeSave, safeClear, resolveOffer]);

  /* ------------------------------------------- a rejoin that outran the source */

  useEffect(() => {
    if (!source) return;
    const queued = queuedSeekRef.current;
    if (queued === null) return;
    queuedSeekRef.current = null;
    try {
      source.seek(queued);
    } catch {
      // A host that refuses a seek is not worth crashing the page over.
    }
  }, [source]);

  /* ----------------------------------------------------- page-level saves */

  useEffect(() => {
    const onPageHide = () => flushLatest();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushLatest();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [flushLatest]);

  /* ------------------------------------------------------------------ api */

  const rejoin = useCallback(() => {
    const offer = offerRef.current;
    resolveOffer();
    if (offer === null) return;
    if (source) {
      try {
        source.seek(offer.t);
      } catch {
        // See above.
      }
    } else {
      queuedSeekRef.current = offer.t;
    }
  }, [source, resolveOffer]);

  const startOver = useCallback(() => {
    resolveOffer();
    queuedSeekRef.current = null;
    if (episodeId !== null) safeClear(episodeId);
  }, [episodeId, resolveOffer, safeClear]);

  return { pending, rejoin, startOver };
}

export default useResume;
