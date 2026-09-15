import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { EpisodeMeta } from '../../data/types';
import type { TimeSource } from '../../playback/TimeSource';
import { parseDeepLinkT } from '../../playback/deepLink';
import { FakeStage } from './FakeStage';
import { YouTubeStage } from './YouTubeStage';
import styles from './VideoStage.module.css';

export interface VideoStageProps {
  meta: EpisodeMeta;
  /** The playhead, handed to the dev stage's scrubber. */
  t: number;
  /** Called once with the stage's `TimeSource`; the page holds it in state. */
  onSource: (source: TimeSource) => void;
  /**
   * Overlay slot, drawn above the player: `AchievementToast`, `MiniMapBadge`,
   * `NextEpisodeCard` (US3/US4). The caption is no longer one of them — since
   * T340 it lives in its own row under the stage.
   */
  children?: ReactNode;
}

/**
 * The 16:9 stage. It owns no time of its own: whichever host it mounts hands a
 * `TimeSource` up to the page, and the page hands `t` back down.
 */
export function VideoStage({ meta, t, onSource, children }: VideoStageProps) {
  const [searchParams] = useSearchParams();
  const { search } = useLocation();
  const fake = import.meta.env.DEV && searchParams.get('fake') === '1';
  /*
   * Since 004 the dev scrubber's starting point is the product's own `?t=`
   * (T403): one parser, one set of rules, so the fake stage and the real host
   * cannot disagree about what a link means.
   */
  const initialT = parseDeepLinkT(search, meta.durationSec) ?? 0;

  return (
    <div className={styles.stage} data-testid="video-stage" data-host={fake ? 'fake' : 'youtube'}>
      {fake ? (
        <FakeStage durationSec={meta.durationSec} t={t} onSource={onSource} initialT={initialT} />
      ) : (
        <YouTubeStage videoId={meta.youtubeId} title={meta.title} onSource={onSource} />
      )}
      {children}
    </div>
  );
}

export default VideoStage;
