import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EpisodeMeta } from '../../data/types';
import type { Dossier } from '../../engine/selectors';
import { copy } from '../../copy';
import { useModalDialog } from '../../hooks/useModalDialog';
import { IconClose } from '../icons';
import {
  DossierAchievements,
  DossierGear,
  DossierHeader,
  DossierHistory,
  DossierHotbar,
  DossierList,
  DossierStats,
  DossierTiles,
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
const BODY_ID = 'crawler-record-body';

/** The sheet, or one category opened in full (contracts/dialog.md Revision 2). */
export type RecordView = 'sheet' | 'skills' | 'inventory' | 'achievements' | 'history';

/** Tiles and history rows shown on the sheet before "View all" takes over. */
const SHEET_MAX = 8;

/**
 * The full record (US2, FR-210..FR-214, R2-FR-221..224): the one overlay allowed
 * to cover the stage (constitution III, 1.2.0). Revision 2 lays it out the way
 * the author asked — the crawler's full-figure art down the left at the sheet's
 * height, identity / vitals / stats beside it, then an MMO hotbar, the gear
 * sheet, and bag-style tile grids that cap at eight and hand the rest to a list
 * view (research R8/R9).
 *
 * `view` is the dialog's only state: which category is open in full. It resets
 * to the sheet whenever the record closes (R2-FR-223), so reopening a crawler
 * never lands mid-navigation. Everything else it draws is a pure function of
 * the `Dossier` it is handed: no `TimeSource`, no playback call, so a seek
 * behind it — in any view — flows straight through (FR-212).
 */
export function FullRecordDialog({
  dossier,
  meta,
  open,
  onClose,
  returnFocusTo,
}: FullRecordDialogProps) {
  const [view, setView] = useState<RecordView>('sheet');
  // The list heading takes focus on entry; the "View all" that opened the view
  // takes it back on return (contracts/dialog.md Revision 2).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewAllRefs = useRef<Partial<Record<RecordView, HTMLButtonElement | null>>>({});
  const returnToRef = useRef<RecordView | null>(null);

  // Escape steps out of a list view first and closes only from the sheet.
  const onEscape = useCallback(() => {
    if (view === 'sheet') return false;
    returnToRef.current = view;
    setView('sheet');
    return true;
  }, [view]);

  const { dialogRef, onBackdropClick } = useModalDialog({
    open,
    onClose,
    returnFocusTo,
    onEscape,
  });

  useEffect(() => {
    if (!open) {
      setView('sheet');
      returnToRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (view !== 'sheet') {
      headingRef.current?.focus();
      return;
    }
    // Back on the sheet: only steal focus if we came from a list view, so the
    // hook's own "focus the close control on open" is never overridden.
    const from = returnToRef.current;
    returnToRef.current = null;
    if (from !== null) viewAllRefs.current[from]?.focus();
  }, [open, view]);

  const openView = useCallback((next: RecordView) => {
    returnToRef.current = null;
    setView(next);
  }, []);

  const back = useCallback(() => {
    setView((current) => {
      if (current !== 'sheet') returnToRef.current = current;
      return 'sheet';
    });
  }, []);

  if (!open) return null;

  const viewAllRef = (key: RecordView) => (node: HTMLButtonElement | null) => {
    viewAllRefs.current[key] = node;
  };

  const title =
    view === 'sheet'
      ? copy.recordTitle(dossier.name)
      : copy.recordListTitle(dossier.name, copy.dossierSections[view]);

  /*
   * The backdrop is opaque from the first frame and never animates (UX review
   * 0.6, T337): only `.enter` on the box fades and lifts, so the glance card is
   * never briefly visible through the dimming. `.anchorTop` pins the sheet to a
   * fixed offset (T332), so a seek that shortens the record cannot re-centre it
   * under the reader's eyes.
   */
  return createPortal(
    <div
      className={`${styles.backdrop} ${styles.anchorTop}`}
      data-testid="record-backdrop"
      onClick={onBackdropClick}
    >
      <div
        ref={dialogRef}
        id="crawler-record"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className={`${styles.dialog} ${styles.enter}`}
        data-testid="crawler-record"
        data-crawler={dossier.id}
        data-view={view}
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
              {title}
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
          `tabIndex={0}`: the sheet scrolls internally (FR-212), so without a tab
          stop a keyboard could not scroll a record longer than the viewport
          (axe scrollable-region-focusable, WCAG 2.1.1 — T313). It joins the
          dialog's own focus cycle; no role and no label, so it stays a plain
          group to assistive tech.
        */}
        <div id={BODY_ID} className={styles.body} data-testid="record-body" tabIndex={0}>
          {view === 'sheet' ? (
            <div className={styles.sheet}>
              {/*
                The art column spans the whole sheet (research R9a): `contain`
                with `object-position: top center`, so a tall figure uses the
                column's height and a wide stance its width. No `art` in the
                data → the bust, centered in the same column.
              */}
              <div className={styles.artColumn} data-testid="record-art">
                <img
                  className={dossier.art === undefined ? styles.artBust : styles.artFigure}
                  src={dossier.art ?? dossier.portrait}
                  alt={copy.artAlt(dossier.name)}
                  data-testid="record-art-image"
                  data-fallback={dossier.art === undefined ? 'bust' : undefined}
                />
              </div>

              <div className={styles.main}>
                <div className={styles.top}>
                  {/*
                    A <section> (unnamed, so still generic to assistive tech)
                    purely to scope `DossierHeader`'s System-blue <header> band:
                    unscoped it would be a banner landmark inside the dialog.
                  */}
                  <section className={styles.topCell}>
                    <DossierHeader dossier={dossier} meta={meta} />
                  </section>
                  <div className={styles.topCell}>
                    <DossierVitals dossier={dossier} />
                  </div>
                  {dossier.stats === undefined ? null : (
                    <div className={`${styles.topCell} ${styles.statsCell}`}>
                      <DossierStats stats={dossier.stats} />
                    </div>
                  )}
                </div>

                <div className={styles.sections}>
                  <DossierHotbar hotlist={dossier.hotlist} />
                  <DossierGear gear={dossier.gear} />
                  <DossierTiles
                    kind="skills"
                    items={dossier.skills}
                    max={SHEET_MAX}
                    onViewAll={() => openView('skills')}
                    viewAllRef={viewAllRef('skills')}
                  />
                  <DossierTiles
                    kind="inventory"
                    items={dossier.inventory}
                    max={SHEET_MAX}
                    onViewAll={() => openView('inventory')}
                    viewAllRef={viewAllRef('inventory')}
                  />
                  <DossierTiles
                    kind="achievements"
                    items={dossier.achievements}
                    max={SHEET_MAX}
                    onViewAll={() => openView('achievements')}
                    viewAllRef={viewAllRef('achievements')}
                  />
                  <DossierHistory
                    items={dossier.history}
                    max={SHEET_MAX}
                    onViewAll={() => openView('history')}
                    viewAllRef={viewAllRef('history')}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.listView}>
              <button
                type="button"
                className={styles.back}
                onClick={back}
                aria-controls={BODY_ID}
                data-testid="record-back"
              >
                {copy.backToRecord}
              </button>
              {/*
                The same section components the stacked dossier uses, with the
                full elapsed list: the cap was only ever a sheet display rule.
              */}
              {view === 'skills' ? (
                <DossierList kind="skills" items={dossier.skills} headingRef={headingRef} />
              ) : null}
              {view === 'inventory' ? (
                <DossierList kind="inventory" items={dossier.inventory} headingRef={headingRef} />
              ) : null}
              {view === 'achievements' ? (
                <DossierAchievements items={dossier.achievements} headingRef={headingRef} />
              ) : null}
              {view === 'history' ? (
                <DossierHistory items={dossier.history} headingRef={headingRef} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FullRecordDialog;
