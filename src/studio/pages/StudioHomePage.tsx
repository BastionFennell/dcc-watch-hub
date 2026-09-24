/**
 * `/studio` - the drafts list (010, T1025, FR-1000).
 *
 * Four ways in, and no fifth: a draft this browser already holds, a brand new
 * episode, a file the author exported earlier, and a published episode pulled
 * back out of the archive. All four end the same way - a draft in
 * `localStorage` and a jump to the editor - so the editor itself only ever has
 * one thing to load.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useShow } from '../../data/ShowContext';
import { orderedEpisodes } from '../../data/show';
import type { EpisodeMeta } from '../../data/types';
import { studioCopy } from '../copy';
import type { StudioDraft } from '../draft';
import { draftFromEpisode } from '../draft';
import { openJsonFile } from '../files';
import { fromEpisodeJson } from '../importer';
import { fetchRawEpisode } from '../remote';
import type { DraftSummary } from '../storage';
import { deleteDraft, listDrafts, loadDraft, saveDraft, storageAvailable } from '../storage';
import { NewEpisodeDialog } from '../components/NewEpisodeDialog';
import styles from './StudioHomePage.module.css';

function when(iso: string): string {
  if (iso === '') return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function StudioHomePage() {
  const navigate = useNavigate();
  const { show } = useShow();
  const [drafts, setDrafts] = useState<DraftSummary[]>(() => listDrafts());
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const newTrigger = useRef<HTMLButtonElement>(null);
  const storageOk = storageAvailable();

  useEffect(() => {
    document.title = 'Studio - Dungeon Crawl Cast';
  }, []);

  const refresh = useCallback(() => setDrafts(listDrafts()), []);

  /** Every entry point ends here: write the draft down, then open it. */
  const start = useCallback(
    (draft: StudioDraft) => {
      const result = saveDraft(draft);
      if (!result.ok) {
        setNotice(
          result.reason === 'quota' ? studioCopy.header.quota : studioCopy.header.unavailable,
        );
        return;
      }
      refresh();
      void navigate(`/studio/ep/${draft.meta.id}`);
    },
    [navigate, refresh],
  );

  async function openFile(): Promise<void> {
    try {
      const file = await openJsonFile();
      if (file === null) return;
      const { draft, warnings } = fromEpisodeJson(file.text);
      if (draft.meta.id === 0) {
        setNotice(studioCopy.notices.importFailed('the file has no episodeId.'));
        return;
      }
      if (
        loadDraft(draft.meta.id) !== null &&
        !window.confirm(studioCopy.home.publishedReplace(draft.meta.id))
      ) {
        return;
      }
      if (warnings.length > 0) setNotice(warnings.join(' '));
      start(draft);
    } catch (cause) {
      setNotice(
        studioCopy.notices.importFailed(cause instanceof Error ? cause.message : String(cause)),
      );
    }
  }

  async function openPublished(meta: EpisodeMeta): Promise<void> {
    if (loadDraft(meta.id) !== null && !window.confirm(studioCopy.home.publishedReplace(meta.id))) {
      return;
    }
    setBusy(true);
    try {
      const raw = await fetchRawEpisode(meta);
      // The show row is the better meta: it carries the title, the video and
      // the duration the episode file itself does not.
      start(
        draftFromEpisode(
          {
            id: meta.id,
            title: meta.title,
            youtubeId: meta.youtubeId,
            floor: meta.floor,
            durationSec: meta.durationSec,
          },
          raw,
        ),
      );
    } catch (cause) {
      setNotice(
        studioCopy.notices.importFailed(cause instanceof Error ? cause.message : String(cause)),
      );
    } finally {
      setBusy(false);
    }
  }

  const episodes = show === null ? [] : orderedEpisodes(show);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{studioCopy.home.title}</h1>
        <p className={styles.subtitle}>{studioCopy.home.subtitle}</p>
      </header>

      {storageOk ? null : (
        <p className={styles.warn} data-testid="storage-off">
          {studioCopy.home.storageOff}
        </p>
      )}
      {notice === null ? null : (
        <p className={styles.warn} data-testid="home-notice" role="status">
          {notice}
        </p>
      )}

      <section className={styles.block}>
        <h2 className={styles.heading}>{studioCopy.home.draftsTitle}</h2>
        {drafts.length === 0 ? (
          <p className={styles.empty} data-testid="drafts-empty">
            {studioCopy.home.draftsEmpty}
          </p>
        ) : (
          <ul className={styles.list} data-testid="drafts-list">
            {drafts.map((draft) => (
              <li key={draft.id} className={styles.row} data-testid="draft-row">
                <Link
                  className={styles.main}
                  to={`/studio/ep/${draft.id}`}
                  aria-label={studioCopy.home.openLabel(draft.title)}
                >
                  <span className={styles.number}>{`EP ${draft.id}`}</span>
                  <span className={styles.name}>{draft.title}</span>
                  <span className={styles.meta}>
                    {studioCopy.home.draftMeta(draft.events, when(draft.updatedAt))}
                  </span>
                </Link>
                <button
                  type="button"
                  className={styles.ghost}
                  data-testid="delete-draft"
                  aria-label={studioCopy.home.deleteLabel(draft.title)}
                  onClick={() => {
                    if (!window.confirm(studioCopy.home.deleteConfirm(draft.title))) return;
                    deleteDraft(draft.id);
                    refresh();
                  }}
                >
                  {studioCopy.home.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>{studioCopy.home.startTitle}</h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            data-testid="new-episode"
            ref={newTrigger}
            onClick={() => setDialog(true)}
          >
            {studioCopy.home.newEpisode}
          </button>
          <button
            type="button"
            className={styles.ghost}
            data-testid="open-file"
            onClick={() => void openFile()}
          >
            {studioCopy.home.openFile}
          </button>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.heading}>{studioCopy.home.publishedTitle}</h2>
        <p className={styles.help}>{studioCopy.home.publishedHelp}</p>
        {show === null ? (
          <p className={styles.empty}>{studioCopy.home.publishedLoading}</p>
        ) : episodes.length === 0 ? (
          <p className={styles.empty}>{studioCopy.home.publishedEmpty}</p>
        ) : (
          <ul className={styles.published} data-testid="published-list">
            {episodes.map((episode) => (
              <li key={episode.id}>
                <button
                  type="button"
                  className={styles.ghost}
                  data-testid="open-published"
                  disabled={busy}
                  onClick={() => void openPublished(episode)}
                >
                  {`${episode.id}. ${episode.title}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewEpisodeDialog
        open={dialog}
        takenIds={drafts.map((draft) => draft.id)}
        onCreate={(draft) => {
          setDialog(false);
          start(draft);
        }}
        onClose={() => setDialog(false)}
        returnFocusTo={newTrigger.current}
      />
    </div>
  );
}

export default StudioHomePage;
