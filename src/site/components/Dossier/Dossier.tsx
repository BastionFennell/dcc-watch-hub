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
 * The reveals are plain React state for this page visit and nothing else
 * (author's decision, 2026-09-25): no storage, no key, nothing to carry between
 * visits. A reload, or a walk to another crawler, starts fully locked - which
 * also means the prerendered HTML and the first client render can never
 * disagree, because both of them are the locked panel.
 *
 * `dossier === null` is the launch state, not a statement: a deploy with no
 * aired episode yet, or a file that has not landed. It says when the first
 * report is due and stops there.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrawlerProfile, DossierFile } from '../../../data/types';
import { deriveStrip, headingFor } from '../../dossier/derive';
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
  const id = profile.id;

  /** The episodes this reader has opened, here, now. Empty on every mount. */
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());

  /*
   * Walking from one crawler to the next keeps this component mounted, and
   * nobody's reveals are anybody else's: re-lock the panel the moment the file
   * on the desk changes. (Adjusting state during render, as React documents it:
   * the re-render happens before anything is painted.)
   */
  const [openFor, setOpenFor] = useState(id);
  if (openFor !== id) {
    setOpenFor(id);
    setRevealed(new Set());
  }

  /** The episode whose heading focus is owed to, once the swap has painted. */
  const [focusEpisode, setFocusEpisode] = useState<number | null>(null);
  const rows = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusEpisode === null) return;
    rows.current?.querySelector<HTMLElement>(`[data-episode="${focusEpisode}"] h3`)?.focus();
    setFocusEpisode(null);
  }, [focusEpisode]);

  const onReveal = useCallback((episode: number) => {
    setRevealed((open) => (open.has(episode) ? open : new Set(open).add(episode)));
    setFocusEpisode(episode);
  }, []);

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

  const revealedCards = cards.filter((card) => revealed.has(card.episode));
  const hiddenCount = cards.length - revealedCards.length;
  const anyOpen = revealedCards.length > 0;
  const highestAired = cards[cards.length - 1].episode;

  /** One control, both ways: everything on this page, or nothing on it. */
  const onBulk = () => {
    setRevealed(anyOpen ? new Set() : new Set(cards.map((card) => card.episode)));
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

        <p className={styles.banner}>{copy.bannerWarning}</p>

        <DossierStrip values={deriveStrip(revealedCards)} />

        <div className={styles.rows} ref={rows}>
          {cards.map((card) => (
            <DossierRow
              key={card.episode}
              card={card}
              revealed={revealed.has(card.episode)}
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
    </header>
  );
}

export default Dossier;
