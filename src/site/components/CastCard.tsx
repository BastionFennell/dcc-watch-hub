/**
 * One person on the show (014): headshot, name, role, pronouns, then their bio
 * and links when they have any.
 *
 * **Empty renders nothing**, as on the crawler page: a member whose bio is not
 * written yet gets no paragraph, no "coming soon" and no empty link row - the
 * card is simply shorter. The name is always text, never only in the picture,
 * so a photo that fails to load leaves the card readable.
 *
 * The role line says which character a player plays and nothing else: no
 * floor, no level, no status (constitution VIII). It links to the crawler's
 * page when the roster has that crawler; while the roster is still loading it
 * is left out rather than drawn broken. Someone who plays no crawler carries
 * an authored role instead, as plain text.
 *
 * `<article id>` is the `/cast#<id>` anchor; its `scroll-margin-top` keeps the
 * card clear of the sticky header on arrival.
 */
import { Link } from 'react-router';
import type { CastMember, CrawlerProfile } from '../../data/types';
import { siteCopy } from '../copy';
import { asset } from '../media';
import { CastLinks } from './CastLinks';
import styles from './CastCard.module.css';

export interface CastCardProps {
  member: CastMember;
  /** The crawler this member plays, when they play one and the roster has it. */
  profile?: CrawlerProfile;
  /** Only the first card's photo is above the fold, so only it skips lazy loading. */
  eager?: boolean;
}

export function CastCard({ member, profile, eager = false }: CastCardProps) {
  const role =
    member.crawlerId !== undefined && profile !== undefined ? (
      <Link className={styles.roleLink} to={`/crawlers/${profile.id}`}>
        {siteCopy.castPlays(profile.characterName)}
      </Link>
    ) : (
      member.role
    );
  const hasBio = member.bio.length > 0;
  const hasLinks = member.links.length > 0;

  return (
    <article className={styles.card} id={member.id}>
      <img
        className={styles.photo}
        src={asset(member.photo.card)}
        alt={member.name}
        width={480}
        height={480}
        loading={eager ? 'eager' : 'lazy'}
      />

      <div className={styles.head}>
        <h2 className={styles.name}>{member.name}</h2>
        {role === undefined ? null : <p className={styles.role}>{role}</p>}
        {member.pronouns === undefined ? null : (
          <p className={styles.pronouns}>{member.pronouns}</p>
        )}
      </div>

      {hasBio || hasLinks ? (
        <div className={styles.body}>
          {member.bio.map((paragraph, index) => (
            <p key={index} className={styles.bio}>
              {paragraph}
            </p>
          ))}
          {hasLinks ? (
            <CastLinks links={member.links} label={siteCopy.castLinksLabel(member.name)} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default CastCard;
