import { useEffect, useRef } from 'react';
import type { TimeSource } from '../../playback/TimeSource';
import { YouTubeTimeSource } from '../../playback/YouTubeTimeSource';
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
 */
export function YouTubeStage({ videoId, title, onSource }: YouTubeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const source = new YouTubeTimeSource(container, videoId);
    onSource(source);
    return () => source.destroy();
  }, [videoId, onSource]);

  return (
    <div
      className={styles.player}
      ref={containerRef}
      data-testid="youtube-stage"
      role="group"
      aria-label={title}
    />
  );
}

export default YouTubeStage;
