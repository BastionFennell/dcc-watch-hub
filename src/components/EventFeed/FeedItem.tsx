import type { ReactNode } from 'react';
import type { FeedItem } from '../../engine/selectors';
import { copy } from '../../copy';
import { IconLoot, IconMap, IconRank } from '../icons';
import { SponsorSlot } from './SponsorSlot';
import styles from './EventFeed.module.css';

export interface FeedItemViewProps {
  item: FeedItem;
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
 * seek in either direction cannot leave a stale style behind.
 */
export function FeedItemView({ item }: FeedItemViewProps) {
  if (item.kind === 'sponsor') {
    return <SponsorSlot item={item} />;
  }

  if (item.kind === 'system_message') {
    return (
      <div className={styles.system} data-kind="system_message">
        <span className={styles.systemTag}>{copy.systemLabel}</span>
        <span className={styles.text}>{item.text}</span>
      </div>
    );
  }

  return (
    <div className={styles.item} data-kind={item.kind} data-note={item.kind === 'note' || undefined}>
      <span className={styles.label} style={{ color: LABEL_COLOR[item.kind] ?? 'var(--text-2)' }}>
        {iconFor(item.kind)}
        {item.label}
      </span>
      <span className={styles.dot}> · </span>
      <span className={styles.text}>{item.text}</span>
    </div>
  );
}

export default FeedItemView;
