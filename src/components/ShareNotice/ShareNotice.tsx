import { useEffect, useRef } from 'react';
import { copy } from '../../copy';
import type { ShareStatus } from '../../share/useShare';
import styles from './ShareNotice.module.css';

export interface ShareNoticeProps {
  status: ShareStatus;
  /** The link the share produced; only rendered when it must be copied by hand. */
  url: string | null;
  onDismiss(): void;
}

const MESSAGE: Record<Exclude<ShareStatus, 'idle'>, string> = {
  copied: copy.shareCopied,
  shared: copy.shareShared,
  shown: copy.shareShown,
};

/**
 * The System's confirmation under the caption row (004 US2, FR-302/304).
 *
 * The live region is always in the document - an `aria-live` container that
 * appears at the same moment as its text is announced unreliably - and the box
 * inside it comes and goes. Empty, the container has no box model at all, so
 * the stage above it never moves (no CLS).
 *
 * When neither the share sheet nor the clipboard worked, the notice carries the
 * link itself in a read-only field, selected on arrival so one keystroke copies
 * it, and it stands until dismissed rather than timing out under the viewer.
 */
export function ShareNotice({ status, url, onDismiss }: ShareNoticeProps) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const showUrl = status === 'shown' && url !== null;

  useEffect(() => {
    if (!showUrl) return;
    fieldRef.current?.select();
  }, [showUrl, url]);

  return (
    <div
      className={styles.live}
      role="status"
      aria-live="polite"
      data-testid="share-notice"
      data-status={status}
    >
      {status === 'idle' ? null : (
        <div className={styles.box}>
          <span className={styles.tag}>{copy.systemTag}</span>
          <p className={styles.message}>{MESSAGE[status]}</p>
          {showUrl ? (
            <div className={styles.fallback}>
              <input
                ref={fieldRef}
                className={styles.field}
                type="text"
                readOnly
                value={url}
                aria-label={copy.shareUrlLabel}
                data-testid="share-url"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={styles.dismiss}
                onClick={onDismiss}
                data-testid="share-dismiss"
              >
                {copy.shareDismiss}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ShareNotice;
