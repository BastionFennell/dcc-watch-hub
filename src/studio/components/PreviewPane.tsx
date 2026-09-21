/**
 * What the viewer would show, from the draft (010, T1017, US3).
 *
 * Not a mock-up: the draft is normalized by `normalizeEpisode`, reduced by the
 * viewer's own `reduceTo`, and handed to the viewer's own `PartyRail` and
 * `EventFeed`. If the preview is wrong, the episode is wrong (constitution VII,
 * "same truth").
 *
 * Read-only: the components take no `onSeek` and no `onShare`, so every row is
 * an inert box rather than a control that promises a panel the Studio has not
 * got (constitution III, honest affordances).
 */
import { useId, useMemo, useState } from 'react';
import { EventFeed } from '../../components/EventFeed/EventFeed';
import { PartyRail } from '../../components/PartyRail/PartyRail';
import { reduceTo } from '../../engine/reducer';
import { activeSponsor, feedItems, partyFrames } from '../../engine/selectors';
import { spellIndex } from '../../engine/spells';
import { studioCopy } from '../copy';
import type { StudioDraft } from '../draft';
import type { StudioRegistries } from '../options';
import { episodeAt } from '../options';
import { formatTimecode } from '../timecode';
import styles from './PreviewPane.module.css';

export interface PreviewPaneProps {
  draft: StudioDraft;
  registries?: StudioRegistries;
  /** The playhead. Everything below is a pure function of the draft and this. */
  t: number;
}

/** A crawler frame is a dossier trigger in the viewer; here it opens nothing. */
function noop(): void {
  /* read-only preview */
}

export function PreviewPane({ draft, registries, t }: PreviewPaneProps) {
  const domId = useId();
  const [open, setOpen] = useState(true);

  /*
   * Normalizing the whole draft is the expensive step, so it is memoized on the
   * draft's identity - the history reducer replaces the object on every change,
   * which makes identity an exact "has anything changed?".
   */
  const episode = useMemo(() => episodeAt(draft), [draft]);
  const state = useMemo(() => (episode === null ? null : reduceTo(episode, t)), [episode, t]);
  const spells = useMemo(() => spellIndex(registries?.spells ?? null), [registries?.spells]);

  const party = state === null ? [] : state.party.map(({ id, name }) => ({ id, name }));
  const frames = state === null || episode === null ? [] : partyFrames(state, episode.events, t);
  const items =
    episode === null ? [] : feedItems(episode.events, t, 8, party, registries?.npcs ?? null, spells);
  const sponsor = episode === null ? null : activeSponsor(episode.events, t, party);

  return (
    <section className={styles.pane} data-testid="preview-pane" aria-label={studioCopy.preview.title}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          data-testid="preview-toggle"
          aria-expanded={open}
          aria-controls={`${domId}-body`}
          aria-label={open ? studioCopy.preview.collapse : studioCopy.preview.expand}
          onClick={() => setOpen((was) => !was)}
        >
          {studioCopy.preview.title}
        </button>
        <span className={styles.at}>{studioCopy.preview.at(formatTimecode(t))}</span>
      </div>
      <div className={styles.body} id={`${domId}-body`} hidden={!open}>
        {episode === null ? (
          <p className={styles.notice} data-testid="preview-unavailable">
            {studioCopy.preview.unavailable}
          </p>
        ) : (
          <>
            <div className={styles.rail} data-testid="preview-rail">
              <PartyRail frames={frames} activeId={null} onActivate={noop} />
            </div>
            <div className={styles.feed} data-testid="preview-feed">
              <EventFeed items={items} sponsor={sponsor} t={t} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default PreviewPane;
