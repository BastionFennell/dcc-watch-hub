import type { EventType } from '../../data/types';
import { KNOWN_EVENT_TYPES } from '../../data/types';
import type { LogCounts } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './EpisodeLog.module.css';

export interface LogFiltersProps {
  /** Elapsed counts over the *unfiltered* log, so a chip says what it would find. */
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
 * (005 FR-406). A chip with nothing elapsed behind it is dimmed but still
 * pressable: the set of chips must not reshuffle as the broadcast runs
 * (research R3).
 */
function Chip({ testId, label, count, pressed, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-testid={testId}
      data-empty={count === 0 ? 'true' : undefined}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipCount}>{count}</span>
    </button>
  );
}

/**
 * The log's two chip groups: every known event type, and every crawler in the
 * party (005 FR-402). Selection combines as type-any AND crawler-any, which is
 * `applyLogFilters`' job — this component only says what is pressed.
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

  return (
    <div className={styles.filters} data-testid="log-filters">
      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{copy.logFiltersTypes}</h3>
        <div className={styles.chips}>
          {KNOWN_EVENT_TYPES.map((kind) => (
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

      <div className={styles.group}>
        <h3 className={styles.groupTitle}>{copy.logFiltersCrawlers}</h3>
        <div className={styles.chips}>
          {party.map((crawler) => (
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
