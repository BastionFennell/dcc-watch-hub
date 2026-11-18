/**
 * One cast member's links (014 R4), as the same pills `SocialRow` draws.
 *
 * A sibling rather than a third `SocialRow` variant: that row reads a
 * `ShowLinks` object in a fixed platform order, while these are an authored,
 * ordered list that may repeat a kind and includes one the show itself does
 * not have (`links`, for a link hub or a personal site). Only the styles are
 * shared.
 *
 * `rel="noopener"` and no `me`: `me` would claim the show's site *is* this
 * person, and it is not. Nothing renders for an empty list - no row, no label.
 */
import type { CastLink } from '../../data/types';
import { siteCopy } from '../copy';
import { trackOutbound } from '../analytics';
import styles from './SocialRow.module.css';

export interface CastLinksProps {
  links: CastLink[];
  /** The list's accessible name, so five lists on one page are told apart. */
  label: string;
}

export function CastLinks({ links, label }: CastLinksProps) {
  if (links.length === 0) return null;

  return (
    <ul className={styles.row} aria-label={label}>
      {links.map(({ kind, url }, index) => (
        // Kinds may repeat and so may a URL in a careless edit: the position is the key.
        <li key={`${index}-${url}`}>
          <a
            className={styles.link}
            href={url}
            target="_blank"
            rel="noopener"
            onClick={() => trackOutbound(kind)}
          >
            {siteCopy.platform[kind]}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default CastLinks;
