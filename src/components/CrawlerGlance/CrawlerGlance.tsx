import type { EquippedItem, Glance, RankPoint } from '../../engine/selectors';
import { GLANCE_HISTORY_ROWS } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { HpSegments } from '../CrawlerDossier/HpSegments';
import { ManaSegments } from '../CrawlerDossier/ManaSegments';
import { RankSparkline } from '../CrawlerDossier/RankSparkline';
import styles from './CrawlerGlance.module.css';

export interface CrawlerGlanceProps {
  /** `crawlerGlance(crawlerDossier(...))` - recomputed every render (FR-202). */
  glance: Glance;
  /** Receives the button itself, so the dialog can return focus to it (FR-210). */
  onOpenRecord: (trigger: HTMLButtonElement) => void;
}

/** Two rows of chips at the rail's width; the rest are counted (research R4). */
const DEBUFF_CAP = 6;

/** The sheet's seven slots: more than that is accessories, and they are counted. */
const EQUIPPED_CAP = 7;

/**
 * A separator a screen reader can hear (UX review 0.7). The "·" is decorative
 * punctuation, so it is hidden and a comma is read in its place - otherwise the
 * two names run together as one word ("Harryplayed by Marcus").
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

/**
 * Movement since the previous rank point (T343, UX review 1.4). A lower rank
 * number is a better rank, so the delta is `previous - current`: positive means
 * the crawler climbed. The first point has nothing to compare against.
 */
function rankDeltaOf(points: readonly RankPoint[]): number | null {
  if (points.length < 2) return null;
  const delta = points[points.length - 2].rank - points[points.length - 1].rank;
  return delta === 0 ? null : delta;
}

/** `Torso · Patched Jacket` - one worn slot, one line (R2-FR-201). */
function EquippedRow({ row }: { row: EquippedItem }) {
  return (
    <li className={styles.equippedRow} data-testid="glance-equipped-row" data-slot={row.slot}>
      <span className={styles.equippedSlot}>{copy.gearSlotLabels[row.slot]}</span>
      <Separator />
      <span className={styles.equippedItem}>{row.item}</span>
    </li>
  );
}

/**
 * The rail's fixed-height crawler card (FR-200..FR-203, R2-FR-201): who they
 * are, how they are doing now, what they are wearing, the last thing they were
 * awarded, the last three moments, and the single control that opens the full
 * record.
 *
 * Revision 2 dropped the four ledger rows and the "-" placeholders the author
 * asked about: every section is now either bounded by the sheet (seven gear
 * slots, one achievement) or reserved in CSS (the sparkline's row, the three
 * history rows), so the card's height still does not move with the episode
 * (FR-201, R2-SC-201) and an empty section simply shows nothing.
 */
export function CrawlerGlance({ glance, onOpenRecord }: CrawlerGlanceProps) {
  const { rank } = glance;
  const debuffs = glance.debuffs.slice(0, DEBUFF_CAP);
  const hiddenDebuffs = glance.debuffs.length - debuffs.length;
  const equipped = glance.equipped.slice(0, EQUIPPED_CAP);
  const hiddenEquipped = glance.equipped.length - equipped.length;
  const history = glance.recentHistory.slice(0, GLANCE_HISTORY_ROWS);
  const achievement = glance.latestAchievement;
  const delta = rankDeltaOf(rank.points);

  return (
    <article className={styles.glance} data-testid="crawler-glance" data-crawler={glance.id}>
      <header className={styles.header} data-testid="glance-header">
        <img
          className={styles.portrait}
          src={glance.portrait}
          alt={glance.name}
          width={48}
          height={48}
        />
        <div className={styles.headerMeta}>
          <h3 className={styles.name} data-testid="glance-name">
            {glance.name}
          </h3>
          {/* The handle repeats the name (the sheets already carry the
              preferred name), so only the credit remains, when there is one. */}
          {glance.player.trim() !== '' && (
            <p className={styles.handle}>{copy.playedBy(glance.player)}</p>
          )}
          <p className={styles.classLine}>
            <span>{glance.class ?? copy.unclassed}</span>
            <Separator />
            <span>{copy.levelShort(glance.level)}</span>
          </p>
        </div>
      </header>

      {/* HP: the label rides inside `HpSegments` (T344), the numbers follow. */}
      <div className={styles.hpRow}>
        <HpSegments current={glance.hp.current} max={glance.hp.max} filled={glance.hp.filled} />
        <p className={styles.hpValue} data-testid="glance-hp">
          {copy.hpValue(glance.hp.current, glance.hp.max)}
        </p>
      </div>

      {/* Mana: the same row one line down (009), hidden for a crawler with no pool. */}
      {glance.mana.max > 0 ? (
        <div className={styles.manaRow}>
          <ManaSegments current={glance.mana.current} max={glance.mana.max} />
          <p className={styles.manaValue} data-testid="glance-mana">
            {copy.hpValue(glance.mana.current, glance.mana.max)}
          </p>
        </div>
      ) : null}

      {/*
        Two stacked rows: the numbers, then the chart on a row of its own.
        Beside the numbers the rail squeezed it to ~80 px (T313 visual review),
        so here it stretches across the whole row (T333's `stretch`). The row is
        reserved whether or not there is a series to draw - `RankSparkline`
        renders nothing when unranked - so an unranked crawler's card is exactly
        as tall as a ranked one (FR-201, SC-201). The label stays on both, so the
        row always says what the numbers are (UX review 1.4).
      */}
      <div className={styles.rankBlock} data-testid="glance-rank">
        <div className={styles.rankNumbers}>
          <span className={styles.rankLabel}>{copy.rankLabel}</span>
          {rank.current === null || rank.best === null ? (
            <span className={styles.unranked}>{copy.unranked}</span>
          ) : (
            <>
              <span className={styles.rankValue} data-testid="glance-rank-current">
                {copy.rankValue(rank.current)}
              </span>
              {delta === null ? null : (
                <span
                  className={styles.rankDelta}
                  data-testid="glance-rank-delta"
                  data-direction={delta > 0 ? 'up' : 'down'}
                >
                  {copy.rankDelta(delta)}
                </span>
              )}
              <span className={styles.rankBestLabel}>{copy.rankBest}</span>
              <span className={styles.rankBestValue} data-testid="glance-rank-best">
                {copy.rankValue(rank.best)}
              </span>
            </>
          )}
        </div>
        <div className={styles.rankSpark} data-testid="glance-rank-spark">
          <RankSparkline series={rank} stretch />
        </div>
      </div>

      <section className={styles.block} data-testid="glance-debuffs">
        <h4 className={styles.blockLabel}>{copy.dossierSections.debuffs}</h4>
        {glance.debuffs.length === 0 ? (
          <p className={styles.empty}>{copy.dossierEmpty.debuffs}</p>
        ) : (
          <ul className={styles.chips}>
            {debuffs.map((debuff) => (
              <li key={debuff} className={styles.chip}>
                {debuff}
              </li>
            ))}
            {hiddenDebuffs > 0 ? (
              <li className={styles.chipMore} data-testid="glance-debuffs-more">
                {copy.debuffsMore(hiddenDebuffs)}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* EQUIPPED: what they are wearing now, in the sheet's slot order. */}
      <section className={styles.block} data-testid="glance-equipped">
        <h4 className={styles.blockLabel}>{copy.dossierSections.equipped}</h4>
        {equipped.length === 0 ? (
          <p className={styles.empty}>{copy.dossierEmpty.equipped}</p>
        ) : (
          <ul className={styles.equipped}>
            {equipped.map((row, index) => (
              <EquippedRow key={`${row.slot}-${row.item}-${index}`} row={row} />
            ))}
            {hiddenEquipped > 0 ? (
              <li className={styles.equippedMore} data-testid="glance-equipped-more">
                {copy.equippedMore(hiddenEquipped)}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* LATEST ACHIEVEMENT: one award, the newest, with its time (R2 US1). */}
      <section className={styles.block} data-testid="glance-latest-achievement">
        <h4 className={styles.blockLabel}>{copy.dossierSections.latestAchievement}</h4>
        {achievement === undefined ? (
          <p className={styles.empty}>{copy.dossierEmpty.achievements}</p>
        ) : (
          <div className={styles.achievement}>
            <p className={styles.achievementHead}>
              <span className={styles.achievementTitle}>{achievement.title}</span>
              <span className={styles.achievementTime}>{formatTime(achievement.t)}</span>
            </p>
            {achievement.desc === undefined ? null : (
              <p className={styles.achievementDesc}>{achievement.desc}</p>
            )}
          </div>
        )}
      </section>

      {/*
        RECENT MOMENTS: up to three, and nothing at all when there are none -
        the "-" rows the author asked about are gone (revision 2). The list keeps
        its three-row `min-height` in CSS, so the card's height holds anyway.
      */}
      <section className={styles.block} data-testid="glance-history">
        <h4 className={styles.blockLabel}>{copy.dossierSections.recent}</h4>
        <ul className={styles.historyRows} data-testid="glance-history-list">
          {history.map((item) => (
            <li key={item.id} className={styles.historyRow} data-testid="glance-history-row">
              <span className={styles.historyTime}>{formatTime(item.t)}</span>
              <span className={styles.historyText}>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className={styles.openRecord}
        data-testid="open-record"
        aria-haspopup="dialog"
        aria-controls="crawler-record"
        onClick={(event) => onOpenRecord(event.currentTarget)}
      >
        {copy.openRecord}
      </button>
    </article>
  );
}

export default CrawlerGlance;
