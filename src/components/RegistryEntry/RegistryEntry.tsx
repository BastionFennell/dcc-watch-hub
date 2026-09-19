import { Link } from 'react-router';
import { initialOf } from '../../engine/initial';
import type { RegistryEntry as RegistryEntryModel } from '../../engine/registry';
import { formatTime } from '../../engine/time';
import { IconChevronRight } from '../icons';
import { ShareButton } from '../ShareButton/ShareButton';
import { copy } from '../../copy';
import styles from './RegistryEntry.module.css';

export interface RegistryEntryProps {
  /** One row of `registryIndex(...).entries`. */
  entry: RegistryEntryModel;
  /** Episode id → the title show.json gives it, for the appearance rows. */
  episodeTitles: ReadonlyMap<number, string>;
  expanded: boolean;
  onToggle(id: string): void;
  /** True for the entry `/registry#<id>` named, so the landing is visible. */
  target?: boolean;
  /**
   * 007 R3: the episode this entry is being read *beside*. Appearances in it
   * become seek controls rather than links, because the broadcast they name is
   * already on screen (R3-FR-642). Omitted on the standalone page, where every
   * appearance is somewhere else.
   */
  currentEpisodeId?: number;
  /** Seeks the broadcast to an appearance in the current episode. */
  onSeek?: (t: number) => void;
  /** Copies a link to that moment; never seeks (004 FR-306). */
  onShare?: (t: number) => void;
}

/** The disc's stand-in when an entity has no portrait (spec Assumptions). */
/**
 * One glossary entry: the spoiler-free face of an entity, and a disclosure onto
 * everything the published archive has released about it (FR-620).
 *
 * The disclosure is a plain button + region rather than `<details>` because the
 * page owns which entries are open — the hash seeds one, and the button has to
 * agree with that state (research R5). Nothing here is playhead-aware: the
 * registry lists what the show published, not what this device has watched.
 */
export function RegistryEntry({
  entry,
  episodeTitles,
  expanded,
  onToggle,
  target,
  currentEpisodeId,
  onSeek,
  onShare,
}: RegistryEntryProps) {
  const { entity } = entry;
  const regionId = `registry-body-${entity.id}`;
  const defeated = entry.defeatedIn !== undefined;

  return (
    <article
      id={entity.id}
      className={styles.entry}
      data-testid="registry-entry"
      data-npc={entity.id}
      data-kind={entity.kind}
      data-expanded={expanded ? 'true' : 'false'}
      data-defeated={defeated ? 'true' : undefined}
      data-target={target ? '' : undefined}
    >
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => onToggle(entity.id)}
        >
          {/*
            Decorative: the name is the next thing in the button, so an `alt`
            would only make a screen reader say it twice (same rule as the strip).
          */}
          {entity.portrait === undefined ? (
            <span className={styles.disc} data-kind={entity.kind} aria-hidden="true">
              {initialOf(entity.name)}
            </span>
          ) : (
            <img
              className={styles.portrait}
              data-kind={entity.kind}
              src={entity.portrait}
              alt=""
              width={40}
              height={40}
            />
          )}
          <span className={styles.meta}>
            <span className={styles.name} data-defeated={defeated ? 'true' : undefined}>
              {entity.name}
            </span>
            <span className={styles.tags}>
              <span className={styles.kind}>{copy.kindLabels[entity.kind]}</span>
              {entity.floor === undefined ? null : (
                <>
                  <span className={styles.dot} aria-hidden="true">
                    {'·'}
                  </span>
                  <span className="sr-only">{copy.srSeparator}</span>
                  <span className={styles.floor}>{copy.floorLabel(entity.floor)}</span>
                </>
              )}
              {defeated ? <span className={styles.defeatedTag}>{copy.npcDefeated}</span> : null}
            </span>
          </span>
          <IconChevronRight className={styles.chevron} />
        </button>
      </h3>

      <p className={styles.intro}>{entity.intro}</p>

      <div id={regionId} className={styles.body} hidden={!expanded}>
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>{copy.npcFacts}</h4>
          {entry.facts.length === 0 ? (
            <p className={styles.empty}>{copy.npcFactsEmpty}</p>
          ) : (
            <ul className={styles.facts}>
              {entry.facts.map((fact) => (
                <li
                  key={fact.id}
                  className={styles.fact}
                  data-testid="registry-fact"
                  data-fact={fact.id}
                  data-episode={fact.episodeId}
                >
                  <span className={styles.factTag}>{copy.registryFactTag(fact.episodeId)}</span>
                  <span className={styles.factText}>{fact.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.block}>
          <h4 className={styles.blockTitle}>{copy.registryAppearances}</h4>
          <ul className={styles.appearances}>
            {entry.appearances.map((appearance) => {
              const here = appearance.episodeId === currentEpisodeId && onSeek !== undefined;
              const time = formatTime(appearance.t);
              const inner = (
                <>
                  <span className={styles.appearanceTitle}>
                    {episodeTitles.get(appearance.episodeId) ??
                      copy.episodeShort(appearance.episodeId)}
                  </span>
                  <span className={styles.appearanceTime}>{time}</span>
                  <span className={styles.appearanceAction}>
                    {copy.registryActions[appearance.action]}
                  </span>
                </>
              );
              return (
                <li
                  key={`${appearance.episodeId}-${appearance.t}-${appearance.action}`}
                  className={styles.appearanceItem}
                >
                  {/*
                    A moment in the episode already playing is a seek, not a
                    journey: the panel sits beside the stage, so following it
                    must not navigate away from the broadcast (R3-FR-642).
                    Everything else stays the link it always was.
                  */}
                  {here ? (
                    <span className={styles.appearanceRow}>
                      <button
                        type="button"
                        className={`${styles.appearance} ${styles.appearanceSeek}`}
                        data-testid="registry-appearance"
                        data-episode={appearance.episodeId}
                        data-current="true"
                        onClick={() => onSeek(appearance.t)}
                      >
                        {inner}
                      </button>
                      {onShare === undefined ? null : (
                        <ShareButton
                          size="sm"
                          label={copy.shareRow(time)}
                          testId="share-row"
                          onClick={() => onShare(appearance.t)}
                        />
                      )}
                    </span>
                  ) : (
                    <Link
                      className={styles.appearance}
                      data-testid="registry-appearance"
                      data-episode={appearance.episodeId}
                      to={`/ep/${appearance.episodeId}?t=${appearance.t}`}
                    >
                      {inner}
                    </Link>
                  )}
                  {appearance.note === undefined ? null : (
                    <span className={styles.appearanceNote}>{appearance.note}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {entry.defeatedIn === undefined ? null : (
          <p className={styles.defeatedLine} data-testid="registry-defeated">
            {copy.registryDefeatedIn(entry.defeatedIn)}
          </p>
        )}
      </div>
    </article>
  );
}

export default RegistryEntry;
