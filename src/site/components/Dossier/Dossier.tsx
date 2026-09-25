/**
 * "Where are they now?" - the crawler dossier (012).
 *
 * One card per aired episode, every one of them shut until the reader opens it.
 * The invariant the whole feature exists for (constitution VIII): **absence is
 * never a signal**. Every crawler has a row for every aired episode forever, a
 * crawler who is off camera gets a real card saying so, and a crawler who is
 * dead keeps getting cards - so counting rows, or noticing a feed go quiet,
 * tells a reader nothing at all.
 *
 * What the panel reports about a crawler comes only from the cards that reader
 * has opened (`deriveStrip`), never from the file. Someone three episodes
 * behind sees the world as it was three episodes ago, and someone who has
 * opened nothing sees three grey pills.
 *
 * `dossier === null` is the launch state, not a statement: a deploy with no
 * aired episode yet, or a file that has not landed. It says when the first
 * report is due and stops there.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CrawlerProfile, DossierFile } from '../../../data/types';
import { deriveStrip, headingFor } from '../../dossier/derive';
import {
  getLockedSnapshot,
  getReveals,
  hideAll,
  isRevealed,
  reveal,
  revealAll,
  saveReveals,
  subscribe,
} from '../../dossier/reveals';
import { siteCopy } from '../../copy';
import { DossierRow } from './DossierRow';
import { DossierStrip } from './DossierStrip';
import styles from './Dossier.module.css';

export interface DossierProps {
  profile: CrawlerProfile;
  /** `null` while there is none: the launch state, never a claim. */
  dossier: DossierFile | null;
}

const { dossier: copy } = siteCopy;

export function Dossier({ profile, dossier }: DossierProps) {
  /*
   * The server and the hydrating client both see `LOCKED`, so the prerendered
   * HTML and the first client render agree; this reader's own choices arrive
   * in the re-render straight after mount.
   */
  const state = useSyncExternalStore(subscribe, getReveals, getLockedSnapshot);

  /** The episode whose heading focus is owed to, once the swap has painted. */
  const [focusEpisode, setFocusEpisode] = useState<number | null>(null);
  const rows = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusEpisode === null) return;
    rows.current?.querySelector<HTMLElement>(`[data-episode="${focusEpisode}"] h3`)?.focus();
    setFocusEpisode(null);
  }, [focusEpisode]);

  const id = profile.id;
  const onReveal = useCallback(
    (episode: number) => {
      saveReveals(reveal(getReveals(), id, episode));
      setFocusEpisode(episode);
    },
    [id],
  );

  const heading = `dossier-${id}`;
  const cards = dossier?.updates ?? [];

  /* The launch state: a header, one line, and nothing that could be counted. */
  if (cards.length === 0) {
    return (
      <section className={styles.section} aria-labelledby={heading}>
        <Header id={heading} pronouns={profile.pronouns} />
        <p className={styles.launch}>{copy.launch}</p>
      </section>
    );
  }

  const revealedCards = cards.filter((card) => isRevealed(state, id, card.episode));
  const hiddenCount = cards.length - revealedCards.length;
  const anyOpen = revealedCards.length > 0;
  const highestAired = cards[cards.length - 1].episode;

  const onBulk = () => {
    const now = getReveals();
    saveReveals(anyOpen ? hideAll(now, id) : revealAll(now, id, highestAired));
  };

  return (
    <section className={styles.section} aria-labelledby={heading}>
      <Header id={heading} pronouns={profile.pronouns} />

      <div className={styles.panel}>
        <div className={styles.band}>
          <span className={styles.file}>{profile.characterName.toUpperCase()}</span>
          <span className={styles.range}>
            {copy.fileRange(cards[0].episode, highestAired)}
          </span>
        </div>

        <div className={styles.banner}>
          <span className={styles.warning}>{copy.bannerWarning}</span>
          <span className={styles.hint}>{copy.bannerHint}</span>
        </div>

        <DossierStrip values={deriveStrip(revealedCards)} />

        <div className={styles.rows} ref={rows}>
          {cards.map((card) => (
            <DossierRow
              key={card.episode}
              card={card}
              revealed={isRevealed(state, id, card.episode)}
              onReveal={onReveal}
              characterName={profile.characterName}
            />
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.count}>{copy.hidden(hiddenCount)}</span>
          <button type="button" className={styles.bulk} onClick={onBulk}>
            {anyOpen ? copy.hideAll : copy.revealAll}
          </button>
        </div>
      </div>
    </section>
  );
}

/** The heading block, identical in both states - the launch state has one too. */
function Header({ id, pronouns }: { id: string; pronouns?: string }) {
  return (
    <header className={styles.head}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h2 className={styles.heading} id={id}>
        {copy.heading(headingFor(pronouns))}
      </h2>
      <p className={styles.sub}>{copy.sub}</p>
    </header>
  );
}

export default Dossier;
