import { Link } from 'react-router';
import { initialOf } from '../../engine/initial';
import type { NpcRecordView } from '../../engine/selectors';
import { copy } from '../../copy';
import { FeedItemView } from '../EventFeed/FeedItem';
import styles from './NpcRecord.module.css';

export interface NpcRecordProps {
  /** `npcRecord(state, events, registry, id, party, t)` — recomputed every render. */
  record: NpcRecordView;
  /** Seeks the broadcast to a moment (US1 scenario 7). */
  onSeek(t: number): void;
  /** Copies a link to that moment; never seeks (004 FR-306). */
  onShare(t: number): void;
}

/**
 * A separator a screen reader can hear (UX review 0.7): the "·" is decorative
 * punctuation and a comma is read in its place.
 */
function Separator() {
  return (
    <>
      <span className={styles.dot} aria-hidden="true">
        {'·'}
      </span>
      <span className="sr-only">{copy.srSeparator}</span>
    </>
  );
}

/** The disc's stand-in when an entity has no portrait (spec Assumptions). */
/**
 * The entity record (FR-611, research R4): the glance card's vocabulary applied
 * to an entity — a kind-tinted header, the spoiler-free intro, its status, the
 * facts the System has released at or before the playhead, and every moment
 * about it so far.
 *
 * Nothing is derived here: `npcRecord` already filtered by the playhead, so a
 * seek in either direction simply hands this a different record (constitution I).
 */
export function NpcRecord({ record, onSeek, onShare }: NpcRecordProps) {
  const defeated = record.state.defeated;
  return (
    <article
      className={styles.record}
      data-testid="npc-record"
      data-npc={record.id}
      data-kind={record.kind}
      data-defeated={defeated ? 'true' : undefined}
    >
      <header className={styles.header} data-kind={record.kind}>
        {record.portrait === undefined ? (
          <span className={styles.disc} data-kind={record.kind} aria-hidden="true">
            {initialOf(record.name)}
          </span>
        ) : (
          <img
            className={styles.portrait}
            src={record.portrait}
            alt=""
            width={48}
            height={48}
          />
        )}
        <div className={styles.headerMeta}>
          <h3 className={styles.name} data-testid="npc-name">
            {record.name}
          </h3>
          <p className={styles.kindLine}>
            <span>{copy.kindLabels[record.kind]}</span>
            {record.floor === undefined ? null : (
              <>
                <Separator />
                <span>{copy.floorLabel(record.floor)}</span>
              </>
            )}
          </p>
        </div>
      </header>

      <p className={styles.intro} data-testid="npc-intro">
        {record.intro}
      </p>

      {/* STATUS appears only when this episode's log has defeated the entity: overlay state is
          per episode, so an "active" line could contradict an earlier episode's outcome. */}
      {defeated ? (
        <p className={styles.status} data-testid="npc-status" data-defeated="true">
          {copy.npcDefeated}
        </p>
      ) : null}

      <section className={styles.block} data-testid="npc-facts">
        <h4 className={styles.blockLabel}>{copy.npcFacts}</h4>
        {record.unlockedFacts.length === 0 ? (
          <p className={styles.empty} data-testid="npc-facts-empty">
            {copy.npcFactsEmpty}
          </p>
        ) : (
          <ul className={styles.facts}>
            {record.unlockedFacts.map((fact) => (
              <li
                key={fact.id}
                className={styles.fact}
                data-testid="npc-fact"
                data-fact={fact.id}
              >
                {fact.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.block} data-testid="npc-moments">
        <h4 className={styles.blockLabel}>{copy.npcMoments}</h4>
        <ul className={styles.moments}>
          {record.moments.map((item) => (
            <li key={item.id} className={styles.moment} data-testid="npc-moment">
              <FeedItemView item={item} onSeek={onSeek} onShare={onShare} />
            </li>
          ))}
        </ul>
      </section>

      {/*
        The one way out of the episode page (US1 scenario 6). A plain `Link`:
        the registry is show-wide, so unlike an episode link it carries no
        playback flags (T709).
      */}
      <Link
        className={styles.registryLink}
        to={`/registry#${record.id}`}
        data-testid="npc-registry-link"
      >
        {copy.npcOpenRegistry}
      </Link>
    </article>
  );
}

export default NpcRecord;
