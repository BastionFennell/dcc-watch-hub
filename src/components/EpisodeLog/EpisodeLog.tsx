import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import type { EventType } from '../../data/types';
import type { FeedItem } from '../../engine/selectors';
import { applyLogFilters, logCounts } from '../../engine/selectors';
import { copy } from '../../copy';
import { useThrottledValue } from '../../hooks/useThrottledValue';
import { IconChevronRight } from '../icons';
import { FeedItemView } from '../EventFeed/FeedItem';
import { LogFilters } from './LogFilters';
import styles from './EpisodeLog.module.css';

/** How often the count may change its text — once a second (research R5). */
export const COUNT_THROTTLE_MS = 1_000;

/**
 * How close to the bottom still counts as "at the end". A row is ~28 px, so a
 * couple of pixels of rounding must not drop the viewer out of follow mode.
 */
export const FOLLOW_SLACK_PX = 24;

export interface EpisodeLogProps {
  /** `logItems(events, t, party)` — the whole elapsed log, oldest first. */
  items: FeedItem[];
  party: readonly { id: string; name: string }[];
  /** The playhead the page derived `items` at (005 FR-405). */
  t: number;
  /** While the broadcast plays the list follows the newest row (FR-404). */
  playing: boolean;
  onSeek: (t: number) => void;
  onShare: (t: number) => void;
  /** The remembered preference, read once by the page (FR-400). */
  initialOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** jsdom has no `matchMedia`, and neither does a very old browser. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * The broadcast log (005 US1/US2): the whole elapsed transcript under the party
 * rail, filterable by type and by crawler, every row a seek control.
 *
 * Nothing here is remembered except whether the viewer likes it open. The rows,
 * the counts and the chips are all derived from `items` on every render, so a
 * seek in either direction is correct with no extra work and a future event can
 * never appear (constitution I, FR-405). Filters are per visit (FR-402).
 *
 * Collapsed by default, it opens only from its own button and appends below the
 * grid, so it never covers or moves the stage (constitution III, FR-400).
 */
export function EpisodeLog({
  items,
  party,
  t,
  playing,
  onSeek,
  onShare,
  initialOpen = false,
  onOpenChange,
}: EpisodeLogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [types, setTypes] = useState<ReadonlySet<EventType>>(() => new Set<EventType>());
  const [actors, setActors] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** Whether the list is still pinned to the newest row (FR-404). */
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const headingId = useId();
  const bodyId = useId();

  const counts = logCounts(items);
  const filtered = applyLogFilters(items, { types, actors });
  const filtering = types.size > 0 || actors.size > 0;
  const rows = filtered.length;

  const countText = filtering
    ? copy.logCountFiltered(rows, items.length)
    : copy.logCount(items.length);
  // Polite live region: the text is the truth of the last second, not of every
  // tick (FR-406).
  const spokenCount = useThrottledValue(countText, COUNT_THROTTLE_MS);

  const scrollToEnd = useCallback((smooth: boolean) => {
    const list = listRef.current;
    if (!list || typeof list.scrollTo !== 'function') return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
  }, []);

  // New rows pull the list down while the broadcast plays, unless the viewer has
  // scrolled away to read something (research R2). A backward seek only shrinks
  // the list, which needs no scroll of its own.
  useEffect(() => {
    if (!open || !following || !playing) return;
    scrollToEnd(true);
  }, [rows, open, following, playing, scrollToEnd]);

  const onListScroll = useCallback((event: UIEvent<HTMLUListElement>) => {
    const list = event.currentTarget;
    setFollowing(list.scrollTop + list.clientHeight >= list.scrollHeight - FOLLOW_SLACK_PX);
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Opening lands the viewer at the newest moment, as the bar promised.
    if (next) setFollowing(true);
    onOpenChange?.(next);
  }

  function follow() {
    setFollowing(true);
    scrollToEnd(true);
  }

  return (
    <section
      className={styles.log}
      aria-labelledby={headingId}
      data-testid="episode-log"
      data-open={open ? 'true' : undefined}
      /* The playhead this log was derived at — the measurable half of FR-405. */
      data-t={Math.max(0, Math.floor(t))}
    >
      <div className={styles.bar}>
        <h2 className={styles.title} id={headingId}>
          {copy.logTitle}
        </h2>
        <button
          type="button"
          className={styles.toggle}
          data-testid="log-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggleOpen}
        >
          <IconChevronRight className={styles.chevron} />
          {open ? copy.logClose : copy.logOpen}
        </button>
        <span className={styles.count} data-testid="log-count" aria-live="polite">
          {spokenCount}
        </span>
      </div>

      {open ? (
        <div className={styles.body} id={bodyId}>
          <LogFilters
            counts={counts}
            party={party}
            types={types}
            actors={actors}
            onToggleType={(kind) => setTypes((current) => toggled(current, kind))}
            onToggleActor={(id) => setActors((current) => toggled(current, id))}
            onClear={() => {
              setTypes(new Set<EventType>());
              setActors(new Set<string>());
            }}
          />

          {rows === 0 ? (
            <p className={styles.empty} data-testid="log-empty">
              {items.length === 0 ? copy.feedStandby : copy.logNoMatch}
            </p>
          ) : (
            <ul
              className={styles.list}
              data-testid="log-list"
              role="list"
              ref={listRef}
              onScroll={onListScroll}
            >
              {filtered.map((item, index) => (
                <li
                  key={item.id}
                  className={styles.row}
                  data-testid="log-row"
                  data-latest={index === rows - 1 ? 'true' : undefined}
                >
                  <FeedItemView item={item} onSeek={onSeek} onShare={onShare} />
                </li>
              ))}
            </ul>
          )}

          {/* Only while it has something to restore (constitution III). */}
          {!following && rows > 0 ? (
            <button
              type="button"
              className={styles.follow}
              data-testid="log-follow"
              onClick={follow}
            >
              {copy.logFollow}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default EpisodeLog;
