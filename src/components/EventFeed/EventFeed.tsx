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
  /** `activeSponsor(events, t)` — pinned above the list while its window holds. */
  sponsor: FeedItem | null;
  /** The playhead, for the synced header (FR-023). */
  t: number;
  /** Loading / failure copy from the page, shown above the list. */
  notice?: ReactNode;
}

/** The System's right-hand rail: header, pinned sponsor, events, footer. */
export function EventFeed({ items, sponsor, t, notice }: EventFeedProps) {
  return (
    <section className={styles.feed} aria-label={copy.feedLabel}>
      <h2 className={styles.header}>{copy.feedHeader(formatTime(t))}</h2>
      {notice}
      {sponsor ? <SponsorSlot item={sponsor} pinned /> : null}
      <ul className={styles.items} data-testid="feed-items">
        {items.map((item) => (
          <li key={item.id} className={styles.row} data-testid="feed-item">
            <FeedItemView item={item} />
          </li>
        ))}
      </ul>
      <p className={styles.footer}>{copy.feedFooter}</p>
    </section>
  );
}

export default EventFeed;
