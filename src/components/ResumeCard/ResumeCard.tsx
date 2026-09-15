import { useEffect, useId, useRef } from 'react';
import { copy } from '../../copy';
import { formatTime } from '../../engine/time';
import styles from './ResumeCard.module.css';

export interface ResumeCardProps {
  /** The saved playhead being offered, in seconds. */
  t: number;
  onRejoin(): void;
  onStartOver(): void;
}

/**
 * The resume offer (US3, FR-131): a System-styled card centered over the stage
 * asking whether to rejoin at the saved time or start from the top. It is a
 * dialog in the ARIA sense but not a modal one — it dismisses on either choice
 * and never traps focus, because the page behind it is a broadcast, not a form.
 *
 * Escape answers "start over", the conservative choice: nothing is seeked and
 * the saved position is discarded. The listener is on `window` (bubble phase)
 * so it also works after the viewer has clicked elsewhere on the page, and it
 * stops propagation so no later `window` listener answers the same keypress.
 */
export function ResumeCard({ t, onRejoin, onStartOver }: ResumeCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const rejoinRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    rejoinRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The card owns this Escape. Registered in the capture phase so it runs
      // before `usePanel`'s bubble-phase listener: one keypress answers the
      // card and nothing else.
      event.stopPropagation();
      onStartOver();
    };
    // Capture phase on `document` runs before the panel hook's bubble-phase listener
    // (also on `document`), so one Escape cannot both start over and close a panel.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onStartOver]);

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="resume-card"
      >
        <span className={styles.kicker}>{copy.resumeKicker}</span>
        <p className={styles.title} id={titleId}>
          {copy.resumeTitle(formatTime(t))}
        </p>
        <p className={styles.body} id={bodyId}>
          {copy.resumeBody}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onRejoin} ref={rejoinRef}>
            {copy.resumeRejoin}
          </button>
          <button type="button" className={styles.secondary} onClick={onStartOver}>
            {copy.resumeStartOver}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResumeCard;
