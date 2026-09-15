import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { EpisodeMeta } from '../../data/types';
import type { TimeSource } from '../../playback/TimeSource';
import { FakeStage } from './FakeStage';
import { StageCaption } from './StageCaption';
import { YouTubeStage } from './YouTubeStage';
import styles from './VideoStage.module.css';

export interface VideoStageProps {
  meta: EpisodeMeta;
  /** The playhead, for the caption. */
  t: number;
  /** Called once with the stage's `TimeSource`; the page holds it in state. */
  onSource: (source: TimeSource) => void;
  /**
   * Overlay slot, drawn above the player and below the caption:
   * `AchievementToast`, `MiniMapBadge`, `NextEpisodeCard` (US3/US4).
   */
  children?: ReactNode;
}

/**
 * The 16:9 stage. It owns no time of its own: whichever host it mounts hands a
 * `TimeSource` up to the page, and the page hands `t` back down.
 */
export function VideoStage({ meta, t, onSource, children }: VideoStageProps) {
  const [searchParams] = useSearchParams();
  const fake = import.meta.env.DEV && searchParams.get('fake') === '1';

  return (
    <div className={styles.stage} data-testid="video-stage">
      {fake ? (
        <FakeStage durationSec={meta.durationSec} t={t} onSource={onSource} />
      ) : (
        <YouTubeStage videoId={meta.youtubeId} title={meta.title} onSource={onSource} />
      )}
      {children}
      <StageCaption meta={meta} t={t} />
    </div>
  );
}

export default VideoStage;
