import type { Toast } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './AchievementToast.module.css';

export interface AchievementToastProps {
  /** `activeToast(events, t, party)` - null whenever no window contains `t`. */
  toast: Toast | null;
}

/**
 * The achievement toast (FR-030): a System blue box top-left over the stage.
 * There is no timer and no exit animation - the toast is on screen exactly while
 * `activeToast` returns it, so the 6 s window and the FIFO queue survive a seek
 * in either direction (research R5).
 */
export function AchievementToast({ toast }: AchievementToastProps) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast ? (
        <div key={toast.id} className={styles.toast} data-testid="achievement-toast">
          <span className={styles.tagRow}>
            <span className={styles.tag}>{copy.newAchievementTag}</span>
            {toast.actorName ? <span className={styles.actor}>{toast.actorName}</span> : null}
          </span>
          <p className={styles.body}>
            <span className={styles.title}>{toast.title}</span>
            {toast.desc ? <span className={styles.desc}> - {toast.desc}</span> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default AchievementToast;
