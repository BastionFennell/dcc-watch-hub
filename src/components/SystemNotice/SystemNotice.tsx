import type { ReactNode } from 'react';
import { copy } from '../../copy';
import styles from './SystemNotice.module.css';

export interface SystemNoticeProps {
  tone?: 'system' | 'error';
  /** Overrides the mono caps label; defaults to "SYSTEM". */
  tag?: string;
  children: ReactNode;
}

/** The blue System box. Used for messages, failures, and not-found copy. */
export function SystemNotice({ tone = 'system', tag, children }: SystemNoticeProps) {
  return (
    <div
      className={tone === 'error' ? `${styles.notice} ${styles.error}` : styles.notice}
      role={tone === 'error' ? 'alert' : undefined}
      data-tone={tone}
    >
      <span className={styles.tag}>{tag ?? copy.systemTag}</span>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export default SystemNotice;
