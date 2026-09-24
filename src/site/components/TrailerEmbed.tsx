/**
 * Click-to-play video for the front door (011 §6, constitution VIII: "no
 * autoplay, no cookie banner").
 *
 * Until the viewer asks, this is a poster and a play button - no iframe, no
 * third-party request, nothing that could start making noise at someone on a
 * train. The click is what mounts the player, and only that mount carries
 * `autoplay=1`, because by then the viewer has already said yes.
 *
 * The nocookie host is deliberate: it is what lets the site ship without a
 * consent banner. This is a plain embed URL, not the IFrame player API, which
 * constitution II reserves for `src/playback/`.
 */
import { useState } from 'react';
import { youtubeThumb } from '../media';
import { siteCopy } from '../copy';
import styles from './TrailerEmbed.module.css';

export interface TrailerEmbedProps {
  youtubeId: string;
  /** The accessible name of the play button, and the iframe's title. */
  title: string;
}

export function TrailerEmbed({ youtubeId, title }: TrailerEmbedProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={styles.frame} data-testid="trailer">
        <iframe
          className={styles.iframe}
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={styles.frame} data-testid="trailer">
      <button
        type="button"
        className={styles.poster}
        onClick={() => setPlaying(true)}
        aria-label={siteCopy.playLabel(title)}
      >
        <img
          className={styles.posterImage}
          src={youtubeThumb(youtubeId)}
          alt=""
          /* The hero's own image: it is the first thing on the page, and on a
             phone it is the Largest Contentful Paint, so it is fetched eagerly
             and ahead of everything else the parser finds. */
          loading="eager"
        />
        <span className={styles.play} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" focusable="false">
            <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />
          </svg>
        </span>
      </button>
    </div>
  );
}

export default TrailerEmbed;
