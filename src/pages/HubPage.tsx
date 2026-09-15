import { useEffect } from 'react';
import { Link } from 'react-router';
import { useShow } from '../data/ShowContext';
import { episodesByFloor } from '../data/show';
import { IconPlay } from '../components/icons';
import { copy } from '../copy';
import styles from './HubPage.module.css';

/**
 * The broadcast archive (FR-053): every recap episode the System has cleared,
 * grouped by floor in the order show.json declares.
 */
export function HubPage() {
  const { show, loading } = useShow();

  useEffect(() => {
    document.title = copy.pageTitle(copy.archiveTitle);
  }, []);

  const groups = show ? episodesByFloor(show).filter((group) => group.episodes.length > 0) : [];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <p className={styles.kicker}>{copy.archiveKicker}</p>
        <h1 className={styles.title}>{copy.archiveTitle}</h1>
        <p className={styles.lead}>{copy.archiveLead}</p>
      </div>

      {show ? (
        <div className={styles.floors}>
          {groups.map((group) => (
            <section key={`${group.season}-${group.floor}`} className={styles.floor}>
              <h2 className={styles.floorLabel}>{group.label}</h2>
              <ul className={styles.cards}>
                {group.episodes.map((episode) => (
                  <li key={episode.id}>
                    <Link to={`/ep/${episode.id}`} className={styles.card}>
                      <span className={styles.cardId}>{copy.episodeShort(episode.id)}</span>
                      <span className={styles.cardTitle}>{episode.title}</span>
                      <span className={styles.cardPlay} aria-hidden="true">
                        <IconPlay />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className={styles.loading}>{loading ? copy.archiveLoading : copy.archiveUnavailable}</p>
      )}
    </div>
  );
}

export default HubPage;
