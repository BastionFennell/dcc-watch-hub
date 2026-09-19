import type { EntityKind, EpisodeMeta } from '../../data/types';
import { ENTITY_KINDS } from '../../data/types';
import type { RegistryScope } from '../../engine/registry';
import { scopeParam } from '../../engine/registry';
import { copy } from '../../copy';
import styles from './RegistryToolbar.module.css';

export interface RegistryToolbarProps {
  /** Every published episode in broadcast order - the select's options. */
  episodes: readonly EpisodeMeta[];
  scope: RegistryScope;
  /** The raw option value (`all`, `through-N`, `ep-N`); the caller parses it. */
  onScopeChange(value: string): void;
  query: string;
  onQueryChange(value: string): void;
  kinds: ReadonlySet<EntityKind>;
  onToggleKind(kind: EntityKind): void;
  /** How many entities of each kind the current scope holds; zero hides a chip. */
  counts: ReadonlyMap<EntityKind, number>;
  /** The rail panel's narrow column: the controls stack instead of sitting in a row. */
  compact?: boolean;
}

/**
 * Scope, search and kind chips - the Registry's three controls, in the order
 * they narrow each other (R2-FR-633, R3-FR-641).
 *
 * One component for the page and the panel: the testids and the copy are the
 * same in both, and only the layout differs, so a viewer who has used one knows
 * the other. Every piece of state lives with the caller - the page keeps its
 * scope in the URL, the panel keeps its own (R3-FR-641).
 */
export function RegistryToolbar({
  episodes,
  scope,
  onScopeChange,
  query,
  onQueryChange,
  kinds,
  onToggleKind,
  counts,
  compact,
}: RegistryToolbarProps) {
  return (
    <div
      className={compact ? `${styles.toolbar} ${styles.compact}` : styles.toolbar}
      data-testid="registry-toolbar"
    >
      {/*
        The first control, before the search: it decides what there is to
        search. A plain labelled `<select>` - keyboard-first, and the platform's
        own picker on a phone (R2-FR-633).
      */}
      <select
        className={styles.scope}
        data-testid="registry-scope"
        aria-label={copy.registryScope}
        value={scopeParam(scope) ?? 'all'}
        onChange={(event) => onScopeChange(event.target.value)}
      >
        <option value="all">{copy.registryScopeAll}</option>
        <optgroup label={copy.registryScopeGroupThrough}>
          {episodes.map((meta) => (
            <option key={`through-${meta.id}`} value={`through-${meta.id}`}>
              {copy.registryScopeThrough(meta.title)}
            </option>
          ))}
        </optgroup>
        <optgroup label={copy.registryScopeGroupOnly}>
          {episodes.map((meta) => (
            <option key={`ep-${meta.id}`} value={`ep-${meta.id}`}>
              {copy.registryScopeOnly(meta.title)}
            </option>
          ))}
        </optgroup>
      </select>
      <input
        type="search"
        className={styles.search}
        data-testid="registry-search"
        aria-label={copy.registrySearch}
        placeholder={copy.registrySearch}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div className={styles.chips} role="group" aria-label={copy.registryKinds}>
        {ENTITY_KINDS.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind) => (
          <button
            key={kind}
            type="button"
            className={styles.chip}
            data-testid={`registry-chip-${kind}`}
            aria-pressed={kinds.has(kind)}
            onClick={() => onToggleKind(kind)}
          >
            <span className={styles.chipLabel}>{copy.kindLabels[kind]}</span>
            <span className={styles.chipCount}>{counts.get(kind) ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default RegistryToolbar;
