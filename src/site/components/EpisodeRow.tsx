/**
 * One episode, everywhere an episode is listed (011 §3.2): the still, the
 * title, its floor and running time, the spoiler-safe summary, the gated
 * button, and - while the System feed is still shut - how long the wait is.
 */
import type { EpisodeMeta, ShowLinks } from '../../data/types';
import { countdown, hubLive, msUntilHubLive } from '../gate';
import { asset, episodeThumb, formatDuration } from '../media';
import { siteCopy } from '../copy';
import { trackCta } from '../analytics';
import { GatedCta } from './GatedCta';
import styles from './EpisodeRow.module.css';

export interface EpisodeRowProps {
  episode: EpisodeMeta;
  now: number;
  links: ShowLinks;
}

export function EpisodeRow({ episode, now, links }: EpisodeRowProps) {
  const locked = !hubLive(episode, now);

  return (
    <article className={styles.row} data-testid={`episode-row-${episode.id}`}>
      <img
        className={styles.thumb}
        src={asset(episodeThumb(episode))}
        alt=""
        /* Every list of episodes is below the fold by the second row, and the
           first costs nothing to defer either (011 §7). */
        loading="lazy"
      />
      <div className={styles.body}>
        <p className={styles.meta}>
          <span>{siteCopy.episodeLabel(episode.id)}</span>
          <span className={styles.dot}>·</span>
          <span>{siteCopy.floorLabel(episode.floor)}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.duration}>{formatDuration(episode.durationSec)}</span>
        </p>
        <h3 className={styles.title}>{episode.title}</h3>
        {episode.summary === undefined || episode.summary === '' ? null : (
          <p className={styles.summary}>{episode.summary}</p>
        )}
        <div className={styles.actions}>
          <GatedCta
            episode={episode}
            now={now}
            links={links}
            /* hub_open or outbound, depending which way the gate is pointing. */
            onTrack={(cta) => trackCta(cta, episode.id)}
          />
          {locked ? (
            <p className={styles.chip} data-testid={`countdown-${episode.id}`}>
              {siteCopy.countdownChip(countdown(msUntilHubLive(episode, now)))}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default EpisodeRow;
