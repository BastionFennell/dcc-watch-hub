/**
 * The one callout that announces something (011 §6, constitution VIII): a
 * System-blue hairline, the mono "SYSTEM" kicker, a title, the text, and an
 * optional footer line.
 *
 * It is used in exactly two places - a crawler's entry achievement and the
 * newcomer strip on the home page. Keeping it rare is what keeps it meaningful,
 * so nothing else on the front door may borrow this style.
 */
import type { ReactNode } from 'react';
import { copy } from '../../copy';
import styles from './SystemBox.module.css';

export interface SystemBoxProps {
  title: string;
  children: ReactNode;
  /** The line under the rule, e.g. "Reward: Golden Monster Box → Liquid Latex". */
  footer?: ReactNode;
}

export function SystemBox({ title, children, footer }: SystemBoxProps) {
  return (
    <div className={styles.box} data-testid="system-box">
      {/* The System's own tag, shared with the hub's notices (src/copy.ts). */}
      <span className={styles.kicker}>{copy.systemTag}</span>
      <p className={styles.title}>{title}</p>
      <div className={styles.body}>{children}</div>
      {footer === undefined ? null : <p className={styles.footer}>{footer}</p>}
    </div>
  );
}

export default SystemBox;
