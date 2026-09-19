import type { EventType } from '../../data/types';
import { KNOWN_EVENT_TYPES } from '../../data/types';
import type { LogCounts } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './EpisodeLog.module.css';

export interface LogFiltersProps {
  /**
   * Elapsed counts over the *unfiltered* log, so a chip says what it would
   * find - and so a kind with nothing elapsed has no chip at all.
   */
  counts: LogCounts;
  party: readonly { id: string; name: string }[];
  types: ReadonlySet<EventType>;
  actors: ReadonlySet<string>;
  onToggleType: (kind: EventType) => void;
  onToggleActor: (id: string) => void;
  onClear: () => void;
}

interface ChipProps {
  testId: string;
  label: string;
  count: number;
  pressed: boolean;
  onToggle: () => void;
}

/**
 * One filter chip. A toggle button, so the keyboard gets the state for free
 * (005 FR-406). Every chip drawn has something behind it: a chip whose count is
 * zero is not rendered at all, so the viewer is never offered a filter that
 * would empty the log.
 */
function Chip({ testId, label, count, pressed, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipCount}>{count}</span>
    </button>
  );
}

/**
 * The log's two chip groups: the event types and the crawlers the log actually
 * holds (005 FR-402). A kind with nothing elapsed has no chip - the chips are a
 * reading of the log so far, not a catalogue of what an episode might contain,
 * and they arrive as the broadcast produces them. Selection combines as
 * type-any AND crawler-any, which is `applyLogFilters`' job; this component
 * only says what is pressed.
 */
export function LogFilters({
  counts,
  party,
  types,
  actors,
  onToggleType,
  onToggleActor,
  onClear,
}: LogFiltersProps) {
  const filtering = types.size > 0 || actors.size > 0;
  const elapsedTypes = KNOWN_EVENT_TYPES.filter((kind) => (counts.byType[kind] ?? 0) > 0);
  const elapsedParty = party.filter((crawler) => (counts.byActor[crawler.id] ?? 0) > 0);

  // Nothing has elapsed: the standby line is the whole of the open log.
  if (elapsedTypes.length === 0 && elapsedParty.length === 0) return null;

  return (
    <div className={styles.filters} data-testid="log-filters">
      {elapsedTypes.length > 0 ? (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>{copy.logFiltersTypes}</h3>
          <div className={styles.chips}>
            {elapsedTypes.map((kind) => (
              <Chip
                key={kind}
                testId={`log-chip-type-${kind}`}
                label={copy.labels[kind]}
                count={counts.byType[kind] ?? 0}
                pressed={types.has(kind)}
                onToggle={() => onToggleType(kind)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {elapsedParty.length > 0 ? (
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>{copy.logFiltersCrawlers}</h3>
          <div className={styles.chips}>
            {elapsedParty.map((crawler) => (
              <Chip
                key={crawler.id}
                testId={`log-chip-actor-${crawler.id}`}
                label={crawler.name}
                count={counts.byActor[crawler.id] ?? 0}
                pressed={actors.has(crawler.id)}
                onToggle={() => onToggleActor(crawler.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/*
        Always present, so pressing the first chip never reflows the filter
        block; disabled while there is nothing to clear, so it never claims to
        do something it would not (constitution III).
      */}
      <button
        type="button"
        className={styles.clear}
        data-testid="log-clear"
        disabled={!filtering}
        onClick={onClear}
      >
        {copy.logClear}
      </button>
    </div>
  );
}

export default LogFilters;
