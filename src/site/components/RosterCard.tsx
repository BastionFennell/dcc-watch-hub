/**
 * The roster card, its page hero, and its share preview - one component, so a
 * card, the hero it links to and the picture Discord unfurls are recognizably
 * the same object (011 §4).
 *
 * The three renders differ by `data-variant` on one root element and share
 * every token, class and piece of layout logic below it.
 */
import { Link } from 'react-router';
import type { CrawlerProfile } from '../../data/types';
import { asset } from '../media';
import { siteCopy } from '../copy';
import styles from './RosterCard.module.css';

export type RosterCardVariant = 'card' | 'hero' | 'og';

export interface RosterCardProps {
  profile: CrawlerProfile;
  variant: RosterCardVariant;
  /** The OG frame's one-line hook, to the right of the name. */
  hook?: string;
  /** Overrides the card's link target. Ignored by the other two variants. */
  href?: string;
}

/*
 * 012: no status pill on any of the three renders, and no live line under the
 * hero. A crawler's condition is not a property of the roster - it lives in the
 * dossier, inside the per-episode cards a reader has chosen to reveal. A pill
 * here would answer the question before anyone asked it, for every crawler, on
 * a page a stranger can arrive at from a search result.
 */
export function RosterCard({ profile, variant, hook, href }: RosterCardProps) {
  const bust = asset(profile.art.bust);
  const full = asset(profile.art.full ?? profile.art.bust);

  if (variant === 'og') {
    return (
      <div className={styles.root} data-variant="og">
        <img className={styles.ogArt} src={full} alt="" width={420} height={520} loading="eager" />
        <div className={styles.ogText}>
          <p className={styles.ogName}>{profile.name}</p>
          <p className={styles.ogCharacter}>{profile.characterName}</p>
          <p className={styles.ogHandle}>{profile.handle}</p>
          {hook === undefined || hook === '' ? null : <p className={styles.ogHook}>{hook}</p>}
        </div>
        <div className={styles.ogMark}>
          <img
            src={asset('/img/dcc-mark.svg')}
            alt=""
            width={32}
            height={32}
            loading="eager"
          />
          <span>{siteCopy.siteName}</span>
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className={styles.root} data-variant="hero">
        <img
          className={styles.heroArt}
          src={full}
          alt={profile.characterName}
          /* Above the fold on its own page, so it is never deferred (T1124). */
          loading="eager"
        />
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{profile.name}</p>
          <h1 className={styles.heroName}>{profile.characterName}</h1>
          <p className={styles.handle}>{profile.handle}</p>
        </div>
      </div>
    );
  }

  return (
    <Link className={styles.root} data-variant="card" to={href ?? `/crawlers/${profile.id}`}>
      <img
        className={styles.cardArt}
        src={bust}
        alt=""
        /* Roster cards sit below the fold on every page that uses them, and a
           browser that fetches them anyway must not take bandwidth from the
           hero, which is the page's Largest Contentful Paint. */
        loading="lazy"
        fetchPriority="low"
        width={192}
        height={192}
      />
      <span className={styles.cardText}>
        <span className={styles.cardName}>{profile.name}</span>
        <span className={styles.cardCharacter}>{profile.characterName}</span>
        {/* No level pill (author, 2026-09-25) and no status pill (012): the
            card is a name and a face, and everything else is behind a click. */}
      </span>
    </Link>
  );
}

export default RosterCard;
