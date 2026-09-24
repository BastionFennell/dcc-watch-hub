/**
 * The Events tab (010, T1023, FR-1006).
 *
 * One row per draft event: the time, a type chip coloured by group, and the
 * sentence the viewer's feed will say - the same `feedItems` call the form's
 * preview makes, so the list reads exactly as the broadcast will.
 *
 * Three filters (group chips, crawler, free text) narrow what is shown and
 * nothing else: they never touch the draft, so the export is unaffected by
 * whatever the author is looking at. The row the playhead is on - the last
 * event at or before `t` - is marked "now", and the selected row scrolls
 * itself into view when the selection comes from the timeline or the issues
 * list rather than from a click here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { studioCopy } from '../copy';
import type { DraftEvent, StudioDraft } from '../draft';
import type { FieldGroup } from '../eventForms';
import { eventTypeLabel, FIELD_GROUPS, GROUP_LABELS } from '../eventForms';
import type { FeedLineContext } from '../feedLine';
import { feedSentence } from '../feedLine';
import { actorOptions } from '../options';
import { formatTimecode } from '../timecode';
import { GROUP_COLORS, groupOf } from '../groups';
import styles from './EventList.module.css';

export interface EventListProps {
  draft: StudioDraft;
  feed: FeedLineContext;
  /** The playhead: which row is "now", and what Retime and Duplicate mean. */
  t: number;
  selectedUid?: string;
  /** Uids `issuesFor` flagged; the row shows a dot. */
  flagged: ReadonlySet<string>;
  onSelect(uid: string): void;
  onRetime(uid: string): void;
  onDuplicate(uid: string): void;
  onDelete(uid: string): void;
}

/** The last event at or before the playhead - the one the viewer just heard. */
function nowUid(events: readonly DraftEvent[], t: number): string | undefined {
  let found: string | undefined;
  for (const entry of events) {
    if (entry.event.t <= t) found = entry.uid;
    else break;
  }
  return found;
}

export function EventList({
  draft,
  feed,
  t,
  selectedUid,
  flagged,
  onSelect,
  onRetime,
  onDuplicate,
  onDelete,
}: EventListProps) {
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [actor, setActor] = useState('');
  const [query, setQuery] = useState('');
  const selectedRef = useRef<HTMLLIElement>(null);

  const actors = useMemo(() => actorOptions(draft), [draft]);
  const sentences = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of draft.events) map.set(entry.uid, feedSentence(entry.event, feed));
    return map;
  }, [draft.events, feed]);

  const now = nowUid(draft.events, t);
  const needle = query.trim().toLowerCase();

  const rows = draft.events.filter((entry) => {
    if (groups.length > 0 && !groups.includes(groupOf(entry.event.type))) return false;
    if (actor !== '' && entry.event.actor !== actor) return false;
    if (needle !== '') {
      const haystack = `${formatTimecode(entry.event.t)} ${entry.event.type} ${
        sentences.get(entry.uid) ?? ''
      }`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  // Only when the selection changes: scrolling on every playhead tick would
  // fight the author's own scrolling.
  useEffect(() => {
    // jsdom (and an ancient browser) has no scrollIntoView; the list still works.
    const row = selectedRef.current;
    if (row !== null && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedUid]);

  const filtering = groups.length > 0 || actor !== '' || needle !== '';
  const playhead = formatTimecode(t);

  return (
    <div className={styles.wrap} data-testid="event-list">
      <div className={styles.filters}>
        <div
          className={styles.chips}
          role="group"
          aria-label={studioCopy.list.filterGroupLabel}
        >
          {FIELD_GROUPS.map((group) => {
            const on = groups.includes(group);
            return (
              <button
                key={group}
                type="button"
                className={styles.chip}
                data-testid={`filter-${group}`}
                data-on={on ? 'true' : undefined}
                aria-pressed={on}
                onClick={() =>
                  setGroups((was) =>
                    was.includes(group) ? was.filter((item) => item !== group) : [...was, group],
                  )
                }
              >
                <span
                  className={styles.swatch}
                  style={{ background: GROUP_COLORS[group] }}
                  aria-hidden="true"
                />
                {GROUP_LABELS[group]}
              </button>
            );
          })}
        </div>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>{studioCopy.list.filterActorLabel}</span>
          <select
            className={styles.select}
            data-testid="filter-actor"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          >
            <option value="">{studioCopy.list.filterActorAll}</option>
            {actors.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>{studioCopy.list.searchLabel}</span>
          <input
            className={styles.search}
            type="search"
            data-testid="filter-search"
            placeholder={studioCopy.list.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <p className={styles.count} data-testid="event-count">
          {studioCopy.list.count(rows.length)}
        </p>
      </div>

      {draft.events.length === 0 ? (
        <p className={styles.empty} data-testid="event-list-empty">
          {studioCopy.list.empty}
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.empty} data-testid="event-list-filtered">
          {studioCopy.list.emptyFiltered}{' '}
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setGroups([]);
              setActor('');
              setQuery('');
            }}
          >
            {studioCopy.list.clearFilters}
          </button>
        </p>
      ) : (
        <ul className={styles.list} aria-label={studioCopy.list.title}>
          {rows.map((entry) => {
            const selected = entry.uid === selectedUid;
            const sentence = sentences.get(entry.uid) ?? eventTypeLabel(entry.event.type);
            const time = formatTimecode(entry.event.t);
            return (
              <li
                key={entry.uid}
                ref={selected ? selectedRef : undefined}
                className={styles.row}
                data-testid="event-row"
                data-selected={selected ? 'true' : undefined}
                data-now={entry.uid === now ? 'true' : undefined}
              >
                <button
                  type="button"
                  className={styles.main}
                  data-testid="event-row-open"
                  aria-label={studioCopy.list.rowLabel(time, sentence)}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(entry.uid)}
                >
                  <span className={styles.time}>{time}</span>
                  <span
                    className={styles.type}
                    style={{ borderColor: GROUP_COLORS[groupOf(entry.event.type)] }}
                  >
                    {eventTypeLabel(entry.event.type)}
                  </span>
                  {/* The row is one dense line, so the full sentence is a title too. */}
                  <span className={styles.sentence} title={sentence}>
                    {sentence}
                  </span>
                  {flagged.has(entry.uid) ? (
                    <span
                      className={styles.issue}
                      data-testid="event-row-issue"
                      title={studioCopy.list.issue}
                    >
                      <span className="sr-only">{studioCopy.list.issue}</span>
                    </span>
                  ) : null}
                  {entry.uid === now ? (
                    <span className={styles.now} data-testid="event-row-now">
                      <span className="sr-only">{`${studioCopy.list.nowLabel}: `}</span>
                      {studioCopy.list.now}
                    </span>
                  ) : null}
                </button>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.action}
                    data-testid="event-row-retime"
                    aria-label={studioCopy.list.retimeLabel(playhead)}
                    onClick={() => onRetime(entry.uid)}
                  >
                    {studioCopy.list.retime}
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    data-testid="event-row-duplicate"
                    aria-label={studioCopy.list.duplicateLabel(playhead)}
                    onClick={() => onDuplicate(entry.uid)}
                  >
                    {studioCopy.list.duplicate}
                  </button>
                  <button
                    type="button"
                    className={styles.action}
                    data-testid="event-row-delete"
                    aria-label={studioCopy.list.removeLabel}
                    onClick={() => onDelete(entry.uid)}
                  >
                    {studioCopy.list.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtering && draft.events.length > 0 && rows.length > 0 ? (
        <p className={styles.filterNote}>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setGroups([]);
              setActor('');
              setQuery('');
            }}
          >
            {studioCopy.list.clearFilters}
          </button>
        </p>
      ) : null}
    </div>
  );
}

export default EventList;
