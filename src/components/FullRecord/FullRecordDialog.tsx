import { createPortal } from 'react-dom';
import type { EpisodeMeta } from '../../data/types';
import type { Dossier } from '../../engine/selectors';
import { copy } from '../../copy';
import { useModalDialog } from '../../hooks/useModalDialog';
import { IconClose } from '../icons';
import {
  DossierAchievements,
  DossierHeader,
  DossierHistory,
  DossierList,
  DossierStats,
  DossierVitals,
} from '../CrawlerDossier/sections';
import styles from './FullRecordDialog.module.css';

export interface FullRecordDialogProps {
  /** `crawlerDossier(...)` at the playhead — recomputed every render (FR-212). */
  dossier: Dossier;
  meta: EpisodeMeta;
  open: boolean;
  onClose(): void;
  /** The "Open full record" button, focused again on close (FR-210). */
  returnFocusTo: HTMLElement | null;
}

const TITLE_ID = 'crawler-record-title';

/**
 * The full record (US2, FR-210..FR-214): the one overlay allowed to cover the
 * stage (constitution III, 1.2.0). It is the v2 dossier's own section
 * components re-laid in the official sheet's landscape arrangement — a top band
 * of identity, vitals and stats, then Hotlist + Skills | Inventory +
 * Achievements | History (research R5) — inside a modal dialog portaled to
 * `document.body`.
 *
 * It reads the `Dossier` it is handed and nothing else: no `TimeSource`, no
 * playback call, no state of its own. Opening it cannot pause the broadcast,
 * and every seek behind it flows straight through (FR-212).
 */
export function FullRecordDialog({
  dossier,
  meta,
  open,
  onClose,
  returnFocusTo,
}: FullRecordDialogProps) {
  const { dialogRef, onBackdropClick } = useModalDialog({ open, onClose, returnFocusTo });

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} data-testid="record-backdrop" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        id="crawler-record"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className={styles.dialog}
        data-testid="crawler-record"
        data-crawler={dossier.id}
      >
        {/*
          Deliberately not a <header>: inside `role="dialog"` it maps to a
          second banner landmark alongside the site header (axe landmark-unique
          / landmark-no-duplicate-banner). A plain box keeps the styles, the
          testids and the `aria-labelledby` target (T313).
        */}
        <div className={styles.header} data-testid="record-header">
          <div className={styles.heading}>
            <p className={styles.kicker}>{copy.recordKicker}</p>
            <h2 id={TITLE_ID} className={styles.title}>
              {copy.recordTitle(dossier.name)}
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={copy.panelClose}
            onClick={onClose}
            data-testid="record-close"
          >
            <IconClose className={styles.closeIcon} />
          </button>
        </div>

        {/*
          `tabIndex={0}`: the sheet scrolls internally (FR-212) and holds no
          controls of its own, so without a tab stop a keyboard could not scroll
          it at all (axe scrollable-region-focusable, WCAG 2.1.1 — T313). It
          joins the dialog's own focus cycle; no role and no label, so it stays
          a plain group to assistive tech.
        */}
        <div className={styles.body} data-testid="record-body" tabIndex={0}>
          <div className={styles.top}>
            {/*
              A <section> (unnamed, so still generic to assistive tech) purely
              to scope `DossierHeader`'s System-blue <header> band: unscoped it
              would be a banner landmark of its own inside the dialog (T313).
            */}
            <section className={styles.topCell}>
              <DossierHeader dossier={dossier} meta={meta} />
            </section>
            <div className={styles.topCell}>
              <DossierVitals dossier={dossier} />
            </div>
            {dossier.stats === undefined ? null : (
              <div className={styles.topCell}>
                <DossierStats stats={dossier.stats} />
              </div>
            )}
          </div>

          <div className={`${styles.column} ${styles.colA}`}>
            <DossierList kind="hotlist" items={dossier.hotlist} />
            <DossierList kind="skills" items={dossier.skills} />
          </div>
          <div className={`${styles.column} ${styles.colB}`}>
            <DossierList kind="inventory" items={dossier.inventory} />
            <DossierAchievements items={dossier.achievements} />
          </div>
          <div className={`${styles.column} ${styles.colC}`}>
            <DossierHistory items={dossier.history} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FullRecordDialog;
