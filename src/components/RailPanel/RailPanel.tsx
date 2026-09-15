import type { ReactNode } from 'react';
import { IconClose } from '../icons';
import { copy } from '../../copy';
import styles from './RailPanel.module.css';

export interface RailPanelProps {
  /** Always the rail slot's one id — triggers point `aria-controls` at it. */
  id?: string;
  title: string;
  /** Mono caps line above the title ("CRAWLER DOSSIER"). */
  kicker?: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * The right rail's panel frame (contracts/panels.md). It replaces the feed in
 * the rail column — on desktop it never covers the stage, and at ≤ 900 px it is
 * a full-viewport overlay with the close control at the top (FR-102).
 *
 * Not a modal dialog: on desktop the page around it stays usable, so a labelled
 * `region` is the honest role (research R2).
 */
export function RailPanel({ id = 'rail-panel', title, kicker, onClose, children }: RailPanelProps) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      role="region"
      aria-labelledby={titleId}
      className={styles.panel}
      data-testid="rail-panel"
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          {kicker === undefined ? null : <p className={styles.kicker}>{kicker}</p>}
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={copy.panelClose}
          onClick={onClose}
          data-testid="panel-close"
        >
          <IconClose className={styles.closeIcon} />
        </button>
      </header>
      <div className={styles.body} data-testid="rail-panel-body">
        {children}
      </div>
    </section>
  );
}

export default RailPanel;
