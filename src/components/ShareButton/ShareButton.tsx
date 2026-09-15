import { copy } from '../../copy';
import { IconShare } from '../icons';
import styles from './ShareButton.module.css';

export interface ShareButtonProps {
  onClick: () => void;
  /** Accessible name; defaults to the caption row's "Share this moment". */
  label?: string;
  /** `sm` is the feed row's inline icon, `md` the caption row's. */
  size?: 'sm' | 'md';
  /** Which surface this is, for the page tests: `share-moment` / `share-row`. */
  testId?: string;
}

/**
 * The share control (004 US2, FR-302/303). An icon button with no visible
 * text: it sits beside a time that already says which moment it means, and in
 * the feed it must not steal width from the sentence it belongs to.
 *
 * Constitution III: it is an explicit control that does something real, so the
 * pointer cursor and the hover lift are honest.
 */
export function ShareButton({ onClick, label, size = 'md', testId }: ShareButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${size === 'sm' ? styles.sm : styles.md}`}
      aria-label={label ?? copy.shareMoment}
      data-testid={testId}
      onClick={(event) => {
        // A feed row is itself a seek button; the share icon is its sibling,
        // but the click must not reach any enclosing handler either (FR-303).
        event.stopPropagation();
        onClick();
      }}
    >
      <IconShare className={styles.icon} />
    </button>
  );
}

export default ShareButton;
