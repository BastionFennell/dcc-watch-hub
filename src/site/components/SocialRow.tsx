/**
 * Every platform the show actually has (011 §3.5). A link that `show.json`
 * does not carry is not rendered at all - no greyed-out icon, no "coming
 * soon" - which is also what keeps the placeholder deploy honest.
 *
 * `rel="me noopener"`: `me` is the identity claim Bluesky and Mastodon verify
 * against, `noopener` is the safety rule every outbound link here follows.
 */
import type { ShowLinks } from '../../data/types';
import { siteCopy } from '../copy';
import { trackOutbound } from '../analytics';
import styles from './SocialRow.module.css';

export interface SocialRowProps {
  links: ShowLinks;
}

/** The order the row reads in, whichever of them exist. */
const PLATFORMS = ['youtube', 'discord', 'tiktok', 'bluesky', 'instagram'] as const;

export function SocialRow({ links }: SocialRowProps) {
  const present = PLATFORMS.map((key) => ({ key, href: links[key] })).filter(
    (entry): entry is { key: (typeof PLATFORMS)[number]; href: string } =>
      typeof entry.href === 'string' && entry.href !== '',
  );

  if (present.length === 0) return null;

  return (
    <ul className={styles.row} data-testid="social-row">
      {present.map(({ key, href }) => (
        <li key={key}>
          <a
            className={styles.link}
            href={href}
            target="_blank"
            rel="me noopener"
            onClick={() => trackOutbound(key)}
          >
            {siteCopy.platform[key]}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default SocialRow;
