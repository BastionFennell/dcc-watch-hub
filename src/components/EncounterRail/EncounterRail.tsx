import type { Encounter } from '../../engine/selectors';
import { initialOf } from '../../engine/initial';
import { copy } from '../../copy';
import styles from './EncounterRail.module.css';

/** `'row'` is the desktop strip under the party rail; `'grid'` the phone tab. */
export type EncounterLayout = 'row' | 'grid';

export interface EncounterRailProps {
  /** Straight from `encounteredNpcs(state, registry)` — newest first (FR-610). */
  encounters: Encounter[];
  /** The entity whose record is the open panel, if any (drives `aria-expanded`). */
  activeId: string | null;
  /** Click or keyboard activation on a chip; the element is the focus target. */
  onActivate(id: string, element: HTMLElement): void;
  /**
   * `'row'` (default) scrolls sideways under the party rail; `'grid'` is the
   * phone NPCs pane — two columns, no sideways scroll (research R3).
   */
  layout?: EncounterLayout;
  /**
   * Opens the Registry panel beside the broadcast (R3-FR-643). The element is
   * the focus target, exactly as a chip's is. Omitted where there is no panel to
   * open, in which case the strip carries no control beside its title.
   */
  onBrowse?(element: HTMLElement): void;
  /** True while that panel is the open one, for the trigger's `aria-expanded`. */
  browsing?: boolean;
}

/** The disc's stand-in when an entity has no portrait (spec Assumptions). */
/**
 * One chip: who the party has met, and the trigger for that entity's record.
 * Mirrors `CrawlerFrame`'s semantics exactly — a real `<button>` carrying
 * `aria-expanded`/`aria-controls` and the `data-panel-trigger` the focus return
 * reads (contracts/panels.md, research R3).
 */
function EncounterChip({
  encounter,
  expanded,
  onActivate,
}: {
  encounter: Encounter;
  expanded: boolean;
  onActivate(element: HTMLElement): void;
}) {
  const defeated = encounter.state.defeated;
  return (
    <li className={styles.chipItem}>
      <button
        type="button"
        className={styles.chip}
        data-testid="encounter-chip"
        data-npc={encounter.id}
        data-kind={encounter.kind}
        data-defeated={defeated ? 'true' : undefined}
        data-panel-trigger={`npc:${encounter.id}`}
        aria-expanded={expanded}
        aria-controls="rail-panel"
        onClick={(event) => onActivate(event.currentTarget)}
      >
        {/*
          The portrait is decorative: the name is right beside it, so an `alt`
          would only make a screen reader say it twice. Same for the initial.
        */}
        {encounter.portrait === undefined ? (
          <span className={styles.disc} data-kind={encounter.kind} aria-hidden="true">
            {initialOf(encounter.name)}
          </span>
        ) : (
          <img
            className={styles.portrait}
            data-kind={encounter.kind}
            src={encounter.portrait}
            alt=""
            width={32}
            height={32}
          />
        )}
        <span className={styles.meta}>
          <span className={styles.name} data-defeated={defeated ? 'true' : undefined}>
            {encounter.name}
          </span>
          <span className={styles.tags}>
            <span className={styles.kind} data-kind={encounter.kind}>
              {copy.kindLabels[encounter.kind]}
            </span>
            {defeated ? <span className={styles.defeated}>{copy.npcDefeated}</span> : null}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The Encountered strip (FR-610, research R3): every entity the party has met at
 * or before the playhead, newest first, each a trigger for its record.
 *
 * Nothing here is derived from events — `encounteredNpcs` already did that — so
 * a seek in either direction simply hands this a different list (constitution I).
 */
export function EncounterRail({
  encounters,
  activeId,
  onActivate,
  layout = 'row',
  onBrowse,
  browsing = false,
}: EncounterRailProps) {
  const titleId = `encounter-rail-title-${layout}`;
  return (
    <section
      className={styles.rail}
      data-testid="encounter-rail"
      data-layout={layout}
      aria-labelledby={titleId}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {copy.encounterTitle}
        </h2>
        {/*
          Beside the title, not among the chips: it is about the episode, not
          about any one entity. Since revision 3 it is a panel trigger rather
          than a link — the Registry opens in the rail and the broadcast keeps
          playing (R3 scenario 1). The way out to the full page lives in that
          panel's footer.
        */}
        {onBrowse === undefined ? null : (
          <button
            type="button"
            className={styles.browse}
            data-testid="encounter-browse"
            data-panel-trigger="registry"
            aria-expanded={browsing}
            aria-controls="rail-panel"
            onClick={(event) => onBrowse(event.currentTarget)}
          >
            {copy.registryBrowse}
          </button>
        )}
      </div>
      {encounters.length === 0 ? (
        <p className={styles.empty} data-testid="encounter-empty">
          {copy.encounterEmpty}
        </p>
      ) : (
        <ul className={styles.chips} data-testid="encounter-chips">
          {encounters.map((encounter) => (
            <EncounterChip
              key={encounter.id}
              encounter={encounter}
              expanded={encounter.id === activeId}
              onActivate={(element) => onActivate(encounter.id, element)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default EncounterRail;
