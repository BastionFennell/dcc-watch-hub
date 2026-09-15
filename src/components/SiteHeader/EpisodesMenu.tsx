import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { Show } from '../../data/types';
import { episodesByFloor } from '../../data/show';
import { useEpisodePath } from '../../hooks/useEpisodePath';
import { IconMenu } from '../icons';
import { copy } from '../../copy';
import styles from './SiteHeader.module.css';

export interface EpisodesMenuProps {
  show: Show;
  /** Marks the open episode with `aria-current="page"`. */
  currentId?: number;
  /** Extra rows under the episode lists (the phone menu's show links). */
  children?: ReactNode;
}

/**
 * The "Episodes" dropdown: a plain `<details>` so it works without JS state,
 * keyboard handling, or a popover library. It closes itself whenever the route
 * changes — what "closes on navigation" means for a `<Link>` inside `<details>`.
 *
 * At phone widths the summary keeps its label for screen readers and shows the
 * `IconMenu` glyph instead (FR-052); the same panel then also carries the show
 * links the header hides.
 */
export function EpisodesMenu({ show, currentId, children }: EpisodesMenuProps) {
  const episodePath = useEpisodePath();
  const ref = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  const groups = episodesByFloor(show).filter((group) => group.episodes.length > 0);

  return (
    <details className={styles.menu} ref={ref}>
      <summary className={styles.summary}>
        <span className={styles.summaryText}>{copy.episodes}</span>
        <IconMenu className={styles.summaryIcon} />
      </summary>
      <div className={styles.panel}>
        {groups.map((group) => (
          <section key={`${group.season}-${group.floor}`} className={styles.group}>
            <h2 className={styles.groupLabel}>{group.label}</h2>
            <ul>
              {group.episodes.map((episode) => (
                <li key={episode.id}>
                  <Link
                    to={episodePath(episode.id)}
                    className={styles.item}
                    aria-current={episode.id === currentId ? 'page' : undefined}
                  >
                    <span className={styles.itemId}>{copy.episodeShort(episode.id)}</span>
                    <span className={styles.itemTitle}>{episode.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {children}
      </div>
    </details>
  );
}

export default EpisodesMenu;
