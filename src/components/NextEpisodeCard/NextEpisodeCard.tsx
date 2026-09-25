import { Link } from 'react-router';
import type { EpisodeMeta } from '../../data/types';
import { copy } from '../../copy';
import { useEpisodePath } from '../../hooks/useEpisodePath';
import styles from './NextEpisodeCard.module.css';

export interface NextEpisodeCardProps {
  /** The next recap episode; omitted on the final episode. */
  next?: EpisodeMeta;
}

/**
 * The ended-state overlay (FR-033): a System-styled card over the stage offering
 * the next recap episode, or the archive when the run is over. Wired into the
 * stage by tasks.md T030.
 */
export function NextEpisodeCard({ next }: NextEpisodeCardProps) {
  const episodePath = useEpisodePath();
  return (
    <div className={styles.backdrop}>
      <div className={styles.card} role="group" aria-label={copy.systemLabel}>
        <span className={styles.tag}>{copy.systemTag}</span>
        {next ? (
          <>
            <p className={styles.title}>{next.title}</p>
            <p className={styles.meta}>
              {copy.episodeShort(next.id)} · {copy.floorLabel(next.floor)}
            </p>
            <Link to={episodePath(next.id)} className={styles.action}>
              {copy.nextEpisodeCard}
            </Link>
          </>
        ) : (
          <>
            <p className={styles.title}>{copy.archiveTitle}</p>
            <Link to="/watch" className={styles.action}>
              {copy.returnToArchive}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default NextEpisodeCard;
