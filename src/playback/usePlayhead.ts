import { useEffect, useState } from 'react';
import type { TimeSource } from './TimeSource';

export interface Playhead {
  t: number;
  playing: boolean;
  ended: boolean;
}

/**
 * The single bridge between a `TimeSource` and React. Components receive `t` as
 * a prop; none of them may hold a concrete source (constitution II).
 */
export function usePlayhead(source: TimeSource | null): Playhead {
  const [state, setState] = useState<Playhead>(() => ({
    t: source?.getTime() ?? 0,
    playing: false,
    ended: false,
  }));

  useEffect(() => {
    if (!source) {
      setState({ t: 0, playing: false, ended: false });
      return;
    }
    setState({ t: source.getTime(), playing: false, ended: false });

    const offTick = source.onTick((t) => {
      setState((prev) => (prev.t === t ? prev : { ...prev, t }));
    });
    const offPlay = source.onPlay(() => {
      setState((prev) => ({ ...prev, playing: true, ended: false }));
    });
    const offPause = source.onPause(() => {
      setState((prev) => ({ ...prev, playing: false }));
    });
    const offEnded = source.onEnded(() => {
      setState((prev) => ({ ...prev, playing: false, ended: true }));
    });

    return () => {
      offTick();
      offPlay();
      offPause();
      offEnded();
    };
  }, [source]);

  return state;
}
