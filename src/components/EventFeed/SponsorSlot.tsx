import type { FeedItem } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './EventFeed.module.css';

export interface SponsorSlotProps {
  item: FeedItem;
  /** The active sponsor is pinned above the feed while its duration holds. */
  pinned?: boolean;
}

/** The purple sponsor slot. "Sponsored", never "ad" (constitution III). */
export function SponsorSlot({ item, pinned = false }: SponsorSlotProps) {
  return (
    <div
      className={styles.sponsor}
      data-testid={pinned ? 'active-sponsor' : 'sponsor'}
      data-pinned={pinned ? 'true' : undefined}
    >
      <span className={styles.sponsorTag}>{copy.sponsoredTag}</span>
      <span className={styles.text}>{item.text}</span>
    </div>
  );
}

export default SponsorSlot;
