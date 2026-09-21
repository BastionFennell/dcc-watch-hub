/**
 * The editor's top bar (010, T1024, FR-1007 / FR-1009 / FR-1010).
 *
 * Left: the way back and what is being edited. Middle: whether the draft is
 * written down. Right: undo, redo, import, and the export menu - a plain
 * `<details>`, so it opens with Enter, closes with Escape, and needs no focus
 * trap of its own.
 *
 * Nothing here decides anything: the page owns the draft and `useStudioExport`
 * owns the files. This only says what is possible and reports what happened.
 */
import { Link } from 'react-router';
import { studioCopy } from '../copy';
import type { StudioDraft } from '../draft';
import type { ExportApi } from '../hooks/useStudioExport';
import type { SaveState } from '../hooks/useStudioDraft';
import styles from './StudioHeader.module.css';

export interface StudioHeaderProps {
  draft: StudioDraft;
  save: SaveState;
  /** False in a private window: the save state says so permanently. */
  storageOk: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onImport(): void;
  exporter: ExportApi;
}

function saveText(save: SaveState, storageOk: boolean): string {
  if (!storageOk) return studioCopy.header.saveError(studioCopy.header.unavailable);
  switch (save.status) {
    case 'saving':
      return studioCopy.header.saving;
    case 'error':
      return studioCopy.header.saveError(
        save.reason === 'quota' ? studioCopy.header.quota : studioCopy.header.unavailable,
      );
    default:
      return studioCopy.header.saved;
  }
}

export function StudioHeader({
  draft,
  save,
  storageOk,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImport,
  exporter,
}: StudioHeaderProps) {
  const bad = !storageOk || save.status === 'error';

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <Link className={styles.back} to="/studio" aria-label={studioCopy.header.backLabel}>
          {studioCopy.header.back}
        </Link>

        <h1 className={styles.title} data-testid="studio-title">
          <span className={styles.number}>{`EP ${draft.meta.id}`}</span>
          {draft.meta.title}
        </h1>

        <p
          className={styles.save}
          data-testid="save-state"
          data-tone={bad ? 'error' : save.status}
          role="status"
        >
          {saveText(save, storageOk)}
        </p>

        <div className={styles.tools}>
          <button
            type="button"
            className={styles.button}
            data-testid="undo"
            aria-label={studioCopy.header.undoLabel}
            disabled={!canUndo}
            onClick={onUndo}
          >
            {studioCopy.header.undo}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="redo"
            aria-label={studioCopy.header.redoLabel}
            disabled={!canRedo}
            onClick={onRedo}
          >
            {studioCopy.header.redo}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="import"
            aria-label={studioCopy.header.importLabel}
            onClick={onImport}
          >
            {studioCopy.header.import}
          </button>

          <details className={styles.menu} data-testid="export-menu">
            <summary className={styles.summary}>{studioCopy.header.exportMenu}</summary>
            <div className={styles.menuBody}>
              <button
                type="button"
                className={styles.menuItem}
                data-testid="export-download"
                onClick={exporter.download}
              >
                {studioCopy.header.download(exporter.fileName)}
              </button>
              {/* Chromium only: hidden entirely where the API is absent (FR-1009). */}
              {exporter.canPickFolder ? (
                <button
                  type="button"
                  className={styles.menuItem}
                  data-testid="export-folder"
                  onClick={() => void exporter.saveToFolder()}
                >
                  {exporter.folderName === null
                    ? studioCopy.header.pickFolder
                    : studioCopy.header.saveToFolder}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.menuItem}
                data-testid="export-copy-entry"
                onClick={() => void exporter.copyShowEntry()}
              >
                {studioCopy.header.copyShowEntry}
              </button>
              <button
                type="button"
                className={styles.menuItem}
                data-testid="export-download-entry"
                onClick={exporter.downloadShowEntry}
              >
                {studioCopy.header.downloadShowEntry}
              </button>
            </div>
          </details>
        </div>
      </div>

      {exporter.notice === null ? null : (
        <div className={styles.notice} data-testid="export-notice" role="status">
          <p className={styles.noticeText}>{exporter.notice}</p>
          {exporter.fallbackText === null ? null : (
            <textarea
              className={styles.fallback}
              data-testid="export-fallback"
              aria-label={studioCopy.header.copyShowEntry}
              readOnly
              rows={7}
              value={exporter.fallbackText}
              onFocus={(event) => event.target.select()}
            />
          )}
          <button
            type="button"
            className={styles.dismiss}
            data-testid="dismiss-notice"
            onClick={exporter.dismiss}
          >
            {studioCopy.notices.dismiss}
          </button>
        </div>
      )}
    </header>
  );
}

export default StudioHeader;
