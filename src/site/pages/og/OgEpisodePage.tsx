/**
 * `/_og/episode/:id` - the episode share image (011 §4): the episode number and
 * floor in the System's blue, the title at size, the summary, and the show mark
 * in the corner where every frame carries it.
 */
import { useParams } from 'react-router';
import { useShow } from '../../../data/ShowContext';
import { findEpisode } from '../../../data/show';
import { asset } from '../../media';
import { siteCopy } from '../../copy';
import { OgFrame } from './OgFrame';
import styles from './og.module.css';

export function OgEpisodePage() {
  const { id = '' } = useParams();
  const { show } = useShow();
  const episode =
    show === null || !/^\d+$/.test(id) ? undefined : findEpisode(show, Number(id));

  if (episode === undefined) return null;

  return (
    <OgFrame>
      <div className={styles.episode}>
        <p className={styles.kicker}>
          <span>{siteCopy.episodeLabel(episode.id)}</span>
          <span className={styles.kickerDot}>·</span>
          <span>{siteCopy.floorLabel(episode.floor)}</span>
        </p>
        <h1 className={styles.episodeTitle}>{episode.title}</h1>
        {episode.summary === undefined || episode.summary === '' ? null : (
          <p className={styles.episodeSummary}>{episode.summary}</p>
        )}
        <div className={`${styles.mark} ${styles.markCorner}`}>
          <img src={asset('/img/dcc-mark.svg')} alt="" width={40} height={40} loading="eager" />
          <span>{siteCopy.siteName}</span>
        </div>
      </div>
    </OgFrame>
  );
}

export default OgEpisodePage;
