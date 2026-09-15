import { useEffect, useRef, useState } from 'react';
import type { TimeSource } from '../../playback/TimeSource';
import { YouTubeTimeSource } from '../../playback/YouTubeTimeSource';
import { SystemNotice } from '../SystemNotice/SystemNotice';
import { copy } from '../../copy';
import styles from './VideoStage.module.css';

export interface YouTubeStageProps {
  videoId: string;
  title: string;
  /** Handed straight up to the page; the page owns the source from here. */
  onSource: (source: TimeSource) => void;
}

/**
 * Mounts the host player and hands its `TimeSource` upward. This is the only
 * component that knows a video host exists, and even it only knows the adapter
 * (constitution II).
 *
 * A video the host refuses to play shows the host's own error inside the
 * iframe; only a failure to reach the host API at all (blocked script, offline)
 * is surfaced here, because otherwise the stage would stay silently black.
 */
export function YouTubeStage({ videoId, title, onSource }: YouTubeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hostError, setHostError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setHostError(false);
    const source = new YouTubeTimeSource(container, videoId, {
      onError: (error) => {
        if (/iframe_api|player API/i.test(error.message)) setHostError(true);
      },
    });
    onSource(source);
    return () => source.destroy();
  }, [videoId, onSource]);

  return (
    <>
      <div
        className={styles.player}
        ref={containerRef}
        data-testid="youtube-stage"
        role="group"
        aria-label={title}
      />
      {hostError ? (
        <div className={styles.hostError} data-testid="host-error">
          <SystemNotice tone="error">{copy.broadcastUnavailable}</SystemNotice>
        </div>
      ) : null}
    </>
  );
}

export default YouTubeStage;
