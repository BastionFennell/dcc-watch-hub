/**
 * One episode's row in the dossier (012), in one of its two states.
 *
 * **Locked** is the whole row as one button: the episode tag, the word LOCKED,
 * two placeholder bars and a REVEAL pill. Nothing in that markup is computed
 * from the card - not a class, not a data attribute, not the width of a bar -
 * because the constitution's "absence is never a signal" cuts both ways: a
 * reader who reads the HTML must learn no more than a reader who reads the
 * page. The bars are fixed widths, the label is the episode number and the
 * verb, and a death card is byte-identical to a card about merchandise.
 *
 * **Revealed** is an `<article>` in its place: the tag column in amber mono,
 * the title as an `h3` the parent moves focus to, the body, and up to three
 * mono chips. It fades in over 250 ms, and not at all under reduced motion.
 *
 * The swap is a replacement, not a disclosure: `aria-expanded` leaves with the
 * button, because there is no longer a control to be expanded.
 */
import type { KeyboardEvent } from 'react';
import type { DossierCard } from '../../../data/types';
import { siteCopy } from '../../copy';
import styles from './DossierRow.module.css';

export interface DossierRowProps {
  card: DossierCard;
  revealed: boolean;
  /** Called with the card's episode; the parent owns the store and the focus. */
  onReveal: (episode: number) => void;
  /** Names the revealed card for assistive tech. Never used while locked. */
  characterName: string;
}

const { dossier } = siteCopy;

export function DossierRow({ card, revealed, onReveal, characterName }: DossierRowProps) {
  const tag = dossier.episodeTag(card.episode);

  if (!revealed) {
    const fire = () => onReveal(card.episode);
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Space scrolls the page on a div; Enter is harmless but consistent.
      event.preventDefault();
      fire();
    };

    return (
      <div
        className={styles.locked}
        /* The episode, which every crawler's row carries alike. Nothing about
           the card behind it - the parent finds the heading through this. */
        data-episode={card.episode}
        data-testid="dossier-row"
        role="button"
        tabIndex={0}
        aria-expanded="false"
        aria-label={dossier.revealAria(card.episode)}
        onClick={fire}
        onKeyDown={onKeyDown}
      >
        <p className={styles.tag}>
          <span className={styles.episode}>{tag}</span>
          <span className={styles.state}>{dossier.locked}</span>
        </p>
        {/* The shape of a card nobody has opened. Two bars, same two widths on
            every row of every crawler, and no text to read out. */}
        <div className={styles.bars} aria-hidden="true">
          <span className={styles.bar} />
          <span className={`${styles.bar} ${styles.barShort}`} />
        </div>
        <span className={styles.pill}>{dossier.reveal}</span>
      </div>
    );
  }

  const chips = card.chips.slice(0, 3);

  return (
    <article
      className={`${styles.card} ${styles.enter}`}
      data-episode={card.episode}
      data-testid="dossier-row"
      aria-label={`${characterName}, ${tag}`}
    >
      <p className={styles.tag}>
        <span className={styles.episode}>{tag}</span>
        <span className={styles.kind}>
          {card.kind === 'quiet' ? dossier.quiet : dossier.update}
        </span>
      </p>
      <div className={styles.body}>
        {/* The parent focuses this after the swap, so the reader lands on what
            just arrived rather than back at the top of the panel. */}
        <h3 className={styles.title} tabIndex={-1}>
          {card.title}
        </h3>
        <p className={styles.text}>{card.body}</p>
        {chips.length === 0 ? null : (
          <ul className={styles.chips}>
            {chips.map((chip) => (
              <li key={chip} className={styles.chip}>
                {chip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default DossierRow;
