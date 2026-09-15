import type { EpisodeMeta } from '../../data/types';
import { stageCaption } from '../../engine/selectors';
import styles from './VideoStage.module.css';

export interface StageCaptionProps {
  meta: EpisodeMeta;
  t: number;
}

/** "Ep {n} · Floor {n} · {time}", bottom-left over the stage (FR-032). */
export function StageCaption({ meta, t }: StageCaptionProps) {
  return (
    <div className={styles.caption} data-testid="stage-caption">
      {stageCaption(meta, t)}
    </div>
  );
}

export default StageCaption;
