import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { EpisodeMeta } from '../../data/types';
import type { TimeSource } from '../../playback/TimeSource';
import { parseDeepLinkT } from '../../playback/deepLink';
import { FakeStage } from './FakeStage';
import { YouTubeStage } from './YouTubeStage';
import { copy } from '../../copy';
import styles from './VideoStage.module.css';

export interface VideoStageProps {
  meta: EpisodeMeta;
  /** The playhead, handed to the dev stage's scrubber. */
  t: number;
  /** Called once with the stage's `TimeSource`; the page holds it in state. */
  onSource: (source: TimeSource) => void;
  /**
   * Phone only (006 FR-500): dock the *same* player as a compact frame pinned
   * under the header. Nothing is re-parented or remounted - the slot keeps its
   * height and CSS moves the stage box, so the host never reloads.
   */
  mini?: boolean;
  /** The mini frame's way back to the full stage (FR-501). */
  onExitMini?: () => void;
  /**
   * Phone only (FR-501/FR-503): the minimap badge duplicates the Map tab, so
   * the page does not render it. VideoStage itself owns no overlay - the badge
   * arrives through `children` - so this only surfaces the decision as
   * `data-hide-badge` on the root, for CSS and for tests; the *suppression*
   * happens where the badge is created (`EpisodePage`, T608).
   */
  hideBadge?: boolean;
  /**
   * Overlay slot, drawn above the player: `AchievementToast`, `MiniMapBadge`,
   * `NextEpisodeCard` (US3/US4). The caption is no longer one of them - since
   * T340 it lives in its own row under the stage.
   */
  children?: ReactNode;
}

/**
 * The 16:9 stage. It owns no time of its own: whichever host it mounts hands a
 * `TimeSource` up to the page, and the page hands `t` back down.
 *
 * The root is the *slot*: a placeholder holds the 16:9 box open and the stage
 * fills it absolutely, so when `mini` detaches the stage to a fixed frame the
 * slot's height does not change and the document below it cannot jump (FR-500).
 */
export function VideoStage({
  meta,
  t,
  onSource,
  mini = false,
  onExitMini,
  hideBadge = false,
  children,
}: VideoStageProps) {
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
    <div
      className={styles.slot}
      data-testid="stage-slot"
      data-mini={mini ? 'true' : undefined}
      data-hide-badge={hideBadge ? 'true' : undefined}
    >
      <div className={styles.placeholder} data-testid="stage-placeholder" aria-hidden="true" />
      <div className={styles.stage} data-testid="video-stage" data-host={fake ? 'fake' : 'youtube'}>
        {fake ? (
          <FakeStage durationSec={meta.durationSec} t={t} onSource={onSource} initialT={initialT} />
        ) : (
          <YouTubeStage videoId={meta.youtubeId} title={meta.title} onSource={onSource} />
        )}
        {children}
        {/*
          Taps on the player itself belong to the host, so the way back to the
          full stage is a bar of our own under the video (research R1).
        */}
        {mini ? (
          <button
            type="button"
            className={styles.miniReturn}
            data-testid="mini-return"
            onClick={onExitMini}
          >
            {copy.miniReturn}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default VideoStage;
