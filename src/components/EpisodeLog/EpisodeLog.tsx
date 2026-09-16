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
  /**
   * The phone Log pane (006 FR-503): the log *is* the pane, so it is always
   * open, its toggle is not drawn, and `initialOpen`/the remembered preference
   * do not apply. The header keeps the title and the elapsed count.
   */
  embedded?: boolean;
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
 * Drop a selection whose chip no longer exists. A chip is only drawn while
 * something of its kind has elapsed, so a backward seek can retire one; leaving
 * it selected would filter the log down to nothing with no visible reason why.
 * Returns the same set when nothing was removed, so the sync below is a no-op
 * on every ordinary render.
 */
function prune<T>(selected: ReadonlySet<T>, elapsed: (value: T) => boolean): ReadonlySet<T> {
  if (selected.size === 0) return selected;
  const kept = [...selected].filter(elapsed);
  return kept.length === selected.size ? selected : new Set(kept);
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
  embedded = false,
}: EpisodeLogProps) {
  const [openPref, setOpen] = useState(initialOpen);
  // Embedded, the section has no closed state to be in: the tab already is the
  // open/closed control.
  const open = embedded || openPref;
  const [types, setTypes] = useState<ReadonlySet<EventType>>(() => new Set<EventType>());
  const [actors, setActors] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** Whether the list is still pinned to the newest row (FR-404). */
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const headingId = useId();
  const bodyId = useId();

  const counts = logCounts(items);
  // A backward seek can take the last event of a kind off the log; its chip
  // goes with it, and so does any selection standing on it (FR-402).
  const liveTypes = prune(types, (kind) => (counts.byType[kind] ?? 0) > 0);
  const liveActors = prune(actors, (id) => (counts.byActor[id] ?? 0) > 0);
  const filtered = applyLogFilters(items, { types: liveTypes, actors: liveActors });
  const filtering = liveTypes.size > 0 || liveActors.size > 0;
  const rows = filtered.length;

  useEffect(() => {
    if (liveTypes !== types) setTypes(liveTypes);
    if (liveActors !== actors) setActors(liveActors);
  }, [liveTypes, types, liveActors, actors]);

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

  // Opening (or mounting open) lands the viewer at the newest moment, paused or not.
  useEffect(() => {
    if (open) scrollToEnd(false);
  }, [open, scrollToEnd]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
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
      data-embedded={embedded ? 'true' : undefined}
      /* The playhead this log was derived at — the measurable half of FR-405. */
      data-t={Math.max(0, Math.floor(t))}
    >
      <div className={styles.bar}>
        <h2 className={styles.title} id={headingId}>
          {copy.logTitle}
        </h2>
        {embedded ? null : (
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
        )}
        <span className={styles.count} data-testid="log-count" aria-live="polite">
          {spokenCount}
        </span>
      </div>

      {open ? (
        <div className={styles.body} id={bodyId}>
          <LogFilters
            counts={counts}
            party={party}
            types={liveTypes}
            actors={liveActors}
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
