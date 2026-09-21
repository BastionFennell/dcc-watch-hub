import type { ReactNode } from 'react';
import type { FeedItem } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { FeedItemView } from './FeedItem';
import { SponsorSlot } from './SponsorSlot';
import styles from './EventFeed.module.css';

export interface EventFeedProps {
  /** Newest first, already capped at 8 by `feedItems` (FR-020). */
  items: FeedItem[];
  /** `activeSponsor(events, t)` - pinned above the list while its window holds. */
  sponsor: FeedItem | null;
  /** The playhead, for the synced header (FR-023). */
  t: number;
  /**
   * Seeks playback to a row's moment (T342). The page hands it the source.
   * Omitted where the feed is a record rather than a control - the Studio's
   * read-only preview (010) - which leaves every row an inert box, exactly as
   * `FeedItemView` and `SponsorSlot` already handle.
   */
  onSeek?: (t: number) => void;
  /** Shares a link to a row's moment (004 FR-303). Never seeks (FR-306). */
  onShare?: (t: number) => void;
  /** Loading / failure copy from the page, shown above the list. */
  notice?: ReactNode;
}

/**
 * The System's right-hand rail: header, pinned sponsor, events.
 *
 * Every row is a seek control (review 1.6, T342): each carries the moment it
 * happened, and clicking it moves the broadcast there. That makes the pointer
 * cursor and the hover ring honest affordances rather than a tease
 * (constitution III).
 */
export function EventFeed({ items, sponsor, t, onSeek, onShare, notice }: EventFeedProps) {
  /** Nothing has elapsed and nothing is wrong: the System says so (T335). */
  const standby = notice === null || notice === undefined;

  return (
    <section className={styles.feed} aria-label={copy.feedLabel}>
      <h2 className={styles.header}>{copy.feedHeader(formatTime(t))}</h2>
      {notice}
      {sponsor ? <SponsorSlot item={sponsor} pinned onSeek={onSeek} onShare={onShare} /> : null}
      {items.length === 0 && sponsor === null && standby ? (
        <p className={styles.standby} data-testid="feed-standby">
          {copy.feedStandby}
        </p>
      ) : null}
      <ul className={styles.items} data-testid="feed-items">
        {items.map((item) => (
          <li key={item.id} className={styles.row} data-testid="feed-item">
            <FeedItemView item={item} onSeek={onSeek} onShare={onShare} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default EventFeed;
