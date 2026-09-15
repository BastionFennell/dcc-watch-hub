import type { FeedItem } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import styles from './EventFeed.module.css';

export interface SponsorSlotProps {
  item: FeedItem;
  /** The active sponsor is pinned above the feed while its duration holds. */
  pinned?: boolean;
  /** Seeks the broadcast back to the break (T342); omitted where rows are inert. */
  onSeek?: (t: number) => void;
}

/** The purple sponsor slot. "Sponsored", never "ad" (constitution III). */
export function SponsorSlot({ item, pinned = false, onSeek }: SponsorSlotProps) {
  const time = formatTime(item.t);
  const testid = pinned ? 'active-sponsor' : 'sponsor';
  const inner = (
    <>
      <span className={styles.time} data-testid="feed-time">
        {time}
      </span>
      <span className={styles.sponsorBody}>
        <span className={styles.sponsorTag}>{copy.sponsoredTag}</span>
        <span className={styles.text}>{item.text}</span>
      </span>
    </>
  );

  if (onSeek === undefined) {
    return (
      <div
        className={`${styles.box} ${styles.sponsor}`}
        data-testid={testid}
        data-pinned={pinned ? 'true' : undefined}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.box} ${styles.sponsor} ${styles.seek}`}
      data-testid={testid}
      data-pinned={pinned ? 'true' : undefined}
      aria-label={copy.feedSeek(time, item.text)}
      onClick={() => onSeek(item.t)}
    >
      {inner}
    </button>
  );
}

export default SponsorSlot;
