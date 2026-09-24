/**
 * The roster card, its page hero, and its share preview - one component, so a
 * card, the hero it links to and the picture Discord unfurls are recognizably
 * the same object (011 §4).
 *
 * The three renders differ by `data-variant` on one root element and share
 * every token, class and piece of layout logic below it.
 */
import { Link } from 'react-router';
import type { CrawlerProfile, CrawlerStatus } from '../../data/types';
import { asset } from '../media';
import { siteCopy } from '../copy';
import { StatusLine } from './StatusLine';
import styles from './RosterCard.module.css';

export type RosterCardVariant = 'card' | 'hero' | 'og';

export interface RosterCardProps {
  profile: CrawlerProfile;
  /** The live line's numbers; absent means the crawler has no episode yet. */
  status?: CrawlerStatus;
  variant: RosterCardVariant;
  /** The OG frame's one-line hook, to the right of the name. */
  hook?: string;
  /** Overrides the card's link target. Ignored by the other two variants. */
  href?: string;
}

/** The authored status, as a pill. Hidden on a card for the common case. */
function StatusPill({ profile }: { profile: CrawlerProfile }) {
  return (
    <span className={styles.statusPill} data-status={profile.status}>
      {siteCopy.statusLabel[profile.status]}
    </span>
  );
}

export function RosterCard({ profile, status, variant, hook, href }: RosterCardProps) {
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
          <p className={styles.pills}>
            {status === undefined ? null : (
              <span className={styles.levelPill}>{siteCopy.levelPill(status.level)}</span>
            )}
            <StatusPill profile={profile} />
          </p>
          {status === undefined ? null : <StatusLine status={status} />}
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
        /* Roster cards sit below the fold on every page that uses them. */
        loading="lazy"
      />
      <span className={styles.cardText}>
        <span className={styles.cardName}>{profile.name}</span>
        <span className={styles.cardCharacter}>{profile.characterName}</span>
        <span className={styles.pills}>
          {status === undefined ? null : (
            <span className={styles.levelPill}>{siteCopy.levelPill(status.level)}</span>
          )}
          {/* "Alive" is the default state and says nothing a card has room for;
              the hero carries it for everyone (011 §4). */}
          {profile.status === 'alive' ? null : <StatusPill profile={profile} />}
        </span>
      </span>
    </Link>
  );
}

export default RosterCard;
