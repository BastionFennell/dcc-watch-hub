import type { ReactNode } from 'react';
import type { FeedItem } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { IconLoot, IconMap, IconRank } from '../icons';
import { ShareButton } from '../ShareButton/ShareButton';
import { SponsorSlot } from './SponsorSlot';
import styles from './EventFeed.module.css';

export interface FeedItemViewProps {
  item: FeedItem;
  /**
   * Seeks the broadcast to this moment (T342). Omitted where the row is a
   * record rather than a control (the dossier's HISTORY), which keeps the
   * pointer cursor honest (constitution III).
   */
  onSeek?: (t: number) => void;
  /**
   * Shares a link to this moment (004 FR-303). Omitted alongside `onSeek`
   * wherever the row is inert.
   */
  onShare?: (t: number) => void;
}

/** Category label color per T021 / wireframe. */
const LABEL_COLOR: Record<string, string> = {
  loot: 'var(--label-loot)',
  rank: 'var(--label-rank)',
  map_reveal: 'var(--label-map)',
  achievement: 'var(--amber-fg)',
  level_up: 'var(--marker-levelup)',
  note: 'var(--text-3)',
};

function iconFor(kind: string): ReactNode {
  switch (kind) {
    case 'loot':
      return <IconLoot className={styles.icon} />;
    case 'rank':
      return <IconRank className={styles.icon} />;
    case 'map_reveal':
      return <IconMap className={styles.icon} />;
    default:
      return null;
  }
}

/**
 * One elapsed event. Which box it gets is decided by the event type alone, so a
 * seek in either direction cannot leave a stale style behind. With `onSeek` the
 * whole row is a button that jumps the broadcast to the moment it names (T342).
 */
export function FeedItemView({ item, onSeek, onShare }: FeedItemViewProps) {
  if (item.kind === 'sponsor') {
    return <SponsorSlot item={item} onSeek={onSeek} onShare={onShare} />;
  }

  const time = formatTime(item.t);
  const system = item.kind === 'system_message';
  const body = system ? (
    <>
      <span className={styles.systemTag}>{copy.systemLabel}</span>
      <span className={styles.text}>{item.text}</span>
    </>
  ) : (
    <>
      <span className={styles.label} style={{ color: LABEL_COLOR[item.kind] ?? 'var(--text-2)' }}>
        {iconFor(item.kind)}
        {item.label}
      </span>
      <span className={styles.dot} aria-hidden="true">
        {' · '}
      </span>
      <span className={styles.text}>{item.text}</span>
    </>
  );

  const box = `${styles.box} ${system ? styles.system : styles.item}`;
  const inner = (
    <>
      <span className={styles.time} data-testid="feed-time">
        {time}
      </span>
      <span className={system ? styles.systemBody : styles.itemBody}>{body}</span>
    </>
  );

  if (onSeek === undefined) {
    return (
      <div
        className={box}
        data-kind={item.kind}
        data-note={item.kind === 'note' || undefined}
      >
        {inner}
      </div>
    );
  }

  const seek = (
    <button
      type="button"
      className={`${box} ${styles.seek}`}
      data-kind={item.kind}
      data-note={item.kind === 'note' || undefined}
      aria-label={copy.feedSeek(time, item.text)}
      onClick={() => onSeek(item.t)}
    >
      {inner}
    </button>
  );

  if (onShare === undefined) return seek;

  // Siblings, never nested: a button inside a button is invalid HTML and the
  // inner one would never receive a click (FR-303).
  return (
    <div className={styles.rowInner}>
      {seek}
      <ShareButton
        size="sm"
        label={copy.shareRow(time)}
        testId="share-row"
        onClick={() => onShare(item.t)}
      />
    </div>
  );
}

export default FeedItemView;
