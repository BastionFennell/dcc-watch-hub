/**
 * Starting an episode (010, T1026, FR-1011, US5).
 *
 * Number, title, video, floor, an optional duration, and the one decision that
 * is not obvious: where the party comes from. Copying episode N's *initial*
 * party restarts a run; copying its *final state* is how episode N + 1 begins
 * where N ended, and that one runs the viewer's reducer over the whole log
 * (`partySource.ts`), so what lands in the draft is exactly what the last
 * broadcast showed.
 *
 * A modal, by the same hook the viewer's full record uses: focus moves in,
 * Tab wraps, Escape closes, and focus goes back to whatever opened it.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShow } from '../../data/ShowContext';
import { parseYouTubeId } from '../../playback/youtubeId';
import { useModalDialog } from '../../hooks/useModalDialog';
import { orderedEpisodes } from '../../data/show';
import { studioCopy } from '../copy';
import type { DraftMeta, StudioDraft } from '../draft';
import { emptyInitialState, newDraft, withParty } from '../draft';
import { partyFromFinalState, partyFromInitial } from '../partySource';
import { fetchRawEpisode } from '../remote';
import { parseTimecode } from '../timecode';
import styles from './NewEpisodeDialog.module.css';

export type PartySource = 'empty' | 'initial' | 'final';

export interface NewEpisodeDialogProps {
  open: boolean;
  /** Episode numbers that already have a draft; the form refuses to reuse one. */
  takenIds: readonly number[];
  /** Prefills the number - "there is no draft for episode 7, create it?". */
  suggestedId?: number;
  onCreate(draft: StudioDraft): void;
  onClose(): void;
  returnFocusTo: HTMLElement | null;
}

const TITLE_ID = 'studio-new-episode-title';

export function NewEpisodeDialog({
  open,
  takenIds,
  suggestedId,
  onCreate,
  onClose,
  returnFocusTo,
}: NewEpisodeDialogProps) {
  const { show } = useShow();
  const episodes = show === null ? [] : orderedEpisodes(show);

  const [idText, setIdText] = useState('');
  const [title, setTitle] = useState('');
  const [video, setVideo] = useState('');
  const [floorText, setFloorText] = useState('1');
  const [durationText, setDurationText] = useState('');
  const [source, setSource] = useState<PartySource>('empty');
  const [sourceId, setSourceId] = useState('');
  const [party, setParty] = useState<unknown[]>([]);
  const [partyState, setPartyState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [attempted, setAttempted] = useState(false);

  const { dialogRef, onBackdropClick } = useModalDialog({ open, onClose, returnFocusTo });

  // Opening is the only time the form seeds itself; it closes by unmounting.
  useEffect(() => {
    if (!open) return;
    const next = suggestedId ?? (takenIds.length === 0 ? 1 : Math.max(...takenIds) + 1);
    setIdText(String(next));
    setTitle('');
    setVideo('');
    setFloorText('1');
    setDurationText('');
    setSource('empty');
    setSourceId('');
    setParty([]);
    setPartyState('idle');
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per opening
  }, [open]);

  /* The party preview: fetched as soon as a source episode is chosen. */
  useEffect(() => {
    if (!open || source === 'empty' || sourceId === '') {
      setParty([]);
      setPartyState('idle');
      return;
    }
    const meta = episodes.find((episode) => String(episode.id) === sourceId);
    if (meta === undefined) return;
    let live = true;
    setPartyState('loading');
    fetchRawEpisode(meta)
      .then((raw) => {
        if (!live) return;
        const next = source === 'initial' ? partyFromInitial(raw) : partyFromFinalState(raw);
        setParty(next);
        setPartyState('idle');
      })
      .catch(() => {
        if (!live) return;
        setParty([]);
        setPartyState('failed');
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `episodes` is derived from `show`
  }, [open, source, sourceId, show]);

  if (!open) return null;

  const id = /^\d+$/.test(idText.trim()) ? Number(idText.trim()) : Number.NaN;
  const idBad = !Number.isInteger(id) || id <= 0;
  const idTaken = !idBad && takenIds.includes(id);
  const videoId = video.trim() === '' ? null : parseYouTubeId(video);
  const videoBad = video.trim() !== '' && videoId === null;
  const titleBad = title.trim() === '';
  const floor = /^\d+$/.test(floorText.trim()) ? Number(floorText.trim()) : 1;
  const durationSec = durationText.trim() === '' ? 0 : (parseTimecode(durationText) ?? 0);
  const blocked = idBad || idTaken || titleBad || videoBad;

  function create(): void {
    setAttempted(true);
    if (blocked) return;
    const meta: DraftMeta = {
      id,
      title: title.trim(),
      youtubeId: videoId ?? '',
      floor,
      durationSec,
    };
    const base = emptyInitialState(floor);
    onCreate(newDraft(meta, party.length === 0 ? base : withParty(base, party)));
  }

  return createPortal(
    <div className={styles.backdrop} onClick={onBackdropClick} data-testid="new-episode-backdrop">
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        data-testid="new-episode-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            create();
          }
        }}
      >
        <h2 className={styles.title} id={TITLE_ID}>
          {studioCopy.dialog.newTitle}
        </h2>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>{studioCopy.dialog.number}</span>
            <input
              className={styles.input}
              data-testid="new-number"
              type="text"
              inputMode="numeric"
              value={idText}
              aria-invalid={attempted && (idBad || idTaken) ? true : undefined}
              onChange={(event) => setIdText(event.target.value)}
            />
            {attempted && idBad ? (
              <span className={styles.error}>{studioCopy.dialog.numberInvalid}</span>
            ) : idTaken ? (
              <span className={styles.error} data-testid="new-number-taken">
                {studioCopy.dialog.numberTaken(id)}
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{studioCopy.dialog.floor}</span>
            <input
              className={styles.input}
              data-testid="new-floor"
              type="text"
              inputMode="numeric"
              value={floorText}
              onChange={(event) => setFloorText(event.target.value)}
            />
          </label>

          <label className={`${styles.field} ${styles.wide}`}>
            <span className={styles.label}>{studioCopy.dialog.episodeTitle}</span>
            <input
              className={styles.input}
              data-testid="new-title"
              type="text"
              value={title}
              aria-invalid={attempted && titleBad ? true : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
            {attempted && titleBad ? (
              <span className={styles.error}>{studioCopy.dialog.titleRequired}</span>
            ) : null}
          </label>

          <label className={`${styles.field} ${styles.wide}`}>
            <span className={styles.label}>{studioCopy.dialog.youtube}</span>
            <input
              className={styles.input}
              data-testid="new-video"
              type="text"
              value={video}
              aria-invalid={videoBad ? true : undefined}
              onChange={(event) => setVideo(event.target.value)}
            />
            {videoBad ? (
              <span className={styles.error} data-testid="new-video-error">
                {studioCopy.dialog.youtubeInvalid}
              </span>
            ) : videoId === null ? null : (
              <span className={styles.help} data-testid="new-video-ok">
                {studioCopy.episode.youtubeOk(videoId)}
              </span>
            )}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{studioCopy.dialog.duration}</span>
            <input
              className={styles.input}
              data-testid="new-duration"
              type="text"
              inputMode="numeric"
              value={durationText}
              onChange={(event) => setDurationText(event.target.value)}
            />
            <span className={styles.help}>{studioCopy.dialog.durationHelp}</span>
          </label>
        </div>

        <fieldset className={styles.party}>
          <legend className={styles.label}>{studioCopy.dialog.partyTitle}</legend>
          {(
            [
              ['empty', studioCopy.dialog.partyEmpty],
              ['initial', studioCopy.dialog.partyInitial],
              ['final', studioCopy.dialog.partyFinal],
            ] as [PartySource, string][]
          ).map(([value, label]) => (
            <label key={value} className={styles.radio}>
              <input
                type="radio"
                name="party-source"
                value={value}
                data-testid={`party-source-${value}`}
                checked={source === value}
                onChange={() => setSource(value)}
              />
              {label}
            </label>
          ))}

          {source === 'empty' ? null : (
            <label className={styles.field}>
              <span className={styles.label}>{studioCopy.dialog.partyEpisode}</span>
              <select
                className={styles.input}
                data-testid="party-source-episode"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
              >
                <option value="">{studioCopy.fields.choose}</option>
                {episodes.map((episode) => (
                  <option key={episode.id} value={String(episode.id)}>
                    {`${episode.id}. ${episode.title}`}
                  </option>
                ))}
              </select>
              {episodes.length === 0 ? (
                <span className={styles.help}>{studioCopy.home.publishedEmpty}</span>
              ) : null}
            </label>
          )}

          <p className={styles.partyState} data-testid="party-state">
            {partyState === 'loading'
              ? studioCopy.dialog.partyLoading
              : partyState === 'failed'
                ? studioCopy.dialog.partyFailed
                : studioCopy.dialog.partyCount(party.length)}
          </p>
        </fieldset>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            data-testid="new-create"
            disabled={attempted && blocked}
            onClick={create}
          >
            {studioCopy.dialog.create}
          </button>
          <button
            type="button"
            className={styles.ghost}
            data-testid="new-cancel"
            onClick={onClose}
          >
            {studioCopy.dialog.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default NewEpisodeDialog;
