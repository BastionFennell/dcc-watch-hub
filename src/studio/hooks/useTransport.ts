/**
 * Playback control for the Studio (010, T1021, FR-1001).
 *
 * The viewer only ever reads time; the editor has to drive the host. That is
 * the `Transport` extension on `TimeSource`, and this is the React side of it:
 * paused, rate and duration as state, refreshed from the source's own events
 * rather than polled (constitution II - nothing here knows what the host is).
 *
 * A source without the extension is not an error: `available` is false and the
 * bar hides its buttons, because some hosts simply cannot be driven.
 */
import { useCallback, useEffect, useState } from 'react';
import type { TimeSource } from '../../playback/TimeSource';
import { hasTransport } from '../../playback/TimeSource';

/** FR-1001: the four speeds the bar offers. */
export const RATES = [0.5, 1, 1.5, 2] as const;

export interface TransportApi {
  /** False when the source cannot be driven (or there is no source yet). */
  available: boolean;
  paused: boolean;
  rate: number;
  /** Seconds, or `null` until the host knows. */
  duration: number | null;
  play(): void;
  pause(): void;
  toggle(): void;
  setRate(rate: number): void;
  /** Seek relative to wherever the source is *now*, not to a stale render's `t`. */
  seekBy(delta: number): void;
  seekTo(t: number): void;
}

export function useTransport(source: TimeSource | null): TransportApi {
  const available = hasTransport(source);
  const [paused, setPaused] = useState(true);
  const [rate, setRateState] = useState(1);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!hasTransport(source)) {
      setPaused(true);
      setRateState(1);
      setDuration(null);
      return;
    }
    const sync = () => {
      setPaused(source.isPaused());
      setRateState(source.getRate());
      // A host learns its duration late (the player finishes loading), so this
      // is read on every tick rather than once.
      setDuration(source.getDuration());
    };
    sync();
    const offTick = source.onTick(sync);
    const offPlay = source.onPlay(sync);
    const offPause = source.onPause(sync);
    const offEnded = source.onEnded(sync);
    return () => {
      offTick();
      offPlay();
      offPause();
      offEnded();
    };
  }, [source]);

  const play = useCallback(() => {
    if (hasTransport(source)) source.play();
  }, [source]);

  const pause = useCallback(() => {
    if (hasTransport(source)) source.pause();
  }, [source]);

  const toggle = useCallback(() => {
    if (!hasTransport(source)) return;
    if (source.isPaused()) source.play();
    else source.pause();
  }, [source]);

  const setRate = useCallback(
    (next: number) => {
      if (!hasTransport(source)) return;
      source.setRate(next);
      setRateState(source.getRate());
    },
    [source],
  );

  const seekTo = useCallback(
    (t: number) => {
      if (source === null) return;
      const bounded = Math.max(0, t);
      const max = hasTransport(source) ? source.getDuration() : null;
      source.seek(max === null ? bounded : Math.min(bounded, max));
    },
    [source],
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (source === null) return;
      seekTo(source.getTime() + delta);
    },
    [source, seekTo],
  );

  return { available, paused, rate, duration, play, pause, toggle, setRate, seekBy, seekTo };
}

export default useTransport;
