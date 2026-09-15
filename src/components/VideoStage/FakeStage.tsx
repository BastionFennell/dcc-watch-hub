/* eslint-disable react-refresh/only-export-components -- the DEV-only test registry lives beside its component (tasks.md T024). */
import { useEffect, useRef, useState } from 'react';
import { FakeTimeSource } from '../../playback/FakeTimeSource';
import type { TimeSource } from '../../playback/TimeSource';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import styles from './VideoStage.module.css';

/**
 * DEV-only registry of every `FakeTimeSource` this stage has created, newest
 * last. `EpisodePage.test.tsx` drives the page through it; production builds
 * never reach this module because `VideoStage` guards on `import.meta.env.DEV`.
 */
export const __fakeSources: FakeTimeSource[] = [];

export interface FakeStageProps {
  durationSec: number;
  t: number;
  onSource: (source: TimeSource) => void;
}

/**
 * The dev scrubber (research R14): a black 16:9 box with a range input and a
 * play/pause button driving a `FakeTimeSource` at 1×. Not a product feature —
 * it exists so the whole page can be driven without a network.
 */
export function FakeStage({ durationSec, t, onSource }: FakeStageProps) {
  const sourceRef = useRef<FakeTimeSource | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const source = new FakeTimeSource(0, durationSec);
    sourceRef.current = source;
    if (import.meta.env.DEV) __fakeSources.push(source);
    const offPlay = source.onPlay(() => setPlaying(true));
    const offPause = source.onPause(() => setPlaying(false));
    const offEnded = source.onEnded(() => setPlaying(false));
    onSource(source);
    return () => {
      offPlay();
      offPause();
      offEnded();
      sourceRef.current = null;
      source.destroy();
    };
  }, [durationSec, onSource]);

  return (
    <div className={styles.fake} data-testid="fake-stage">
      <span className={styles.fakeLabel}>{copy.fakeStageLabel}</span>
      <div className={styles.fakeControls}>
        <button
          type="button"
          className={styles.fakeButton}
          onClick={() => {
            const source = sourceRef.current;
            if (!source) return;
            if (playing) source.pause();
            else source.play();
          }}
        >
          {playing ? copy.fakeStagePause : copy.fakeStagePlay}
        </button>
        <input
          className={styles.fakeRange}
          type="range"
          min={0}
          max={durationSec}
          step={1}
          value={Math.min(t, durationSec)}
          aria-label={copy.fakeStageScrub}
          onChange={(event) => sourceRef.current?.seek(Number(event.target.value))}
        />
        <span className={styles.fakeTime}>{formatTime(t)}</span>
      </div>
    </div>
  );
}

export default FakeStage;
