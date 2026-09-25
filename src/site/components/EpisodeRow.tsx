/**
 * One episode, everywhere an episode is listed (011 §3.2): the still, the
 * title, its floor and running time, the spoiler-safe summary, the gated
 * button, and - while the System feed is still shut - how long the wait is.
 */
import type { Ref } from 'react';
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
  /** A fragment target for this row, so `/watch#ep-3` lands on it (011 R3). */
  anchorId?: string;
  /** The newest episode in the archive: marked, and jumped to (011 R3). */
  latest?: boolean;
  /** Handed to the archive so its jump control can scroll and focus this row. */
  rowRef?: Ref<HTMLElement>;
}

export function EpisodeRow({
  episode,
  now,
  links,
  anchorId,
  latest = false,
  rowRef,
}: EpisodeRowProps) {
  const locked = !hubLive(episode, now);

  return (
    <article
      className={styles.row}
      data-testid={`episode-row-${episode.id}`}
      {...(anchorId === undefined ? {} : { id: anchorId })}
      ref={rowRef}
      /* A scroll target needs somewhere to put the outline it gets on focus. */
      {...(latest ? { tabIndex: -1 } : {})}
    >
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
          {latest ? <span className={styles.latest}>{siteCopy.latestChip}</span> : null}
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
