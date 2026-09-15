import type { Glance, LedgerRow } from '../../engine/selectors';
import { GLANCE_HISTORY_ROWS } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { HpSegments } from '../CrawlerDossier/HpSegments';
import { RankSparkline } from '../CrawlerDossier/RankSparkline';
import styles from './CrawlerGlance.module.css';

export interface CrawlerGlanceProps {
  /** `crawlerGlance(crawlerDossier(...))` — recomputed every render (FR-202). */
  glance: Glance;
  /** Receives the button itself, so the dialog can return focus to it (FR-210). */
  onOpenRecord: (trigger: HTMLButtonElement) => void;
}

/** Two rows of chips at the rail's width; the rest are counted (research R4). */
const DEBUFF_CAP = 6;

type LedgerKind = 'hotlist' | 'skills' | 'inventory' | 'achievements';

const LEDGER_KINDS: readonly LedgerKind[] = ['hotlist', 'skills', 'inventory', 'achievements'];

/**
 * One ledger line: the count, then the newest entry on a single ellipsized line
 * (or the System's empty phrase). Static text by FR-203 — no hover affordances.
 */
function LedgerLine({ kind, row }: { kind: LedgerKind; row: LedgerRow }) {
  return (
    <div className={styles.ledgerRow} data-testid={`ledger-${kind}`}>
      <dt className={styles.ledgerLabel}>{copy.dossierSections[kind]}</dt>
      <dd className={styles.ledgerValue}>
        <span className={styles.count}>{copy.ledgerCount(row.count)}</span>
        {row.newest === undefined ? (
          <span className={styles.newestEmpty}>{copy.dossierEmpty[kind]}</span>
        ) : (
          <>
            <span className={styles.newest}>{copy.ledgerNewest(row.newest.text)}</span>
            {row.newest.t === undefined ? null : (
              <span className={styles.newestTime}>{formatTime(row.newest.t)}</span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * The rail's fixed-height crawler card (FR-200..FR-203): who they are, how they
 * are doing now, one line per list, the last three moments, and the single
 * control that opens the full record. Every row is single-line, and the history
 * block always holds exactly three rows, so the card's height is the same for a
 * crawler with forty achievements and one with none (FR-201).
 */
export function CrawlerGlance({ glance, onOpenRecord }: CrawlerGlanceProps) {
  const { rank } = glance;
  const debuffs = glance.debuffs.slice(0, DEBUFF_CAP);
  const hiddenDebuffs = glance.debuffs.length - debuffs.length;
  const history = glance.recentHistory.slice(0, GLANCE_HISTORY_ROWS);
  const placeholders = Array.from(
    { length: GLANCE_HISTORY_ROWS - history.length },
    (_, index) => index,
  );

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
          <p className={styles.handle}>
            {glance.handle}
            <span className={styles.dot}> · </span>
            {glance.player}
          </p>
          <p className={styles.classLine}>
            {glance.class ?? copy.unclassed}
            <span className={styles.dot}> · </span>
            {copy.levelShort(glance.level)}
          </p>
        </div>
      </header>

      <div className={styles.vitals}>
        <HpSegments current={glance.hp.current} max={glance.hp.max} filled={glance.hp.filled} />
        <p className={styles.hpValue} data-testid="glance-hp">
          {copy.hpValue(glance.hp.current, glance.hp.max)}
        </p>
      </div>

      {/*
        Two stacked rows: the numbers, then the chart on a row of its own. Beside
        the numbers the rail squeezed it to ~80 px (T313 visual review). The
        chart's row is reserved whether or not there is a series to draw —
        `RankSparkline` renders nothing when unranked — so an unranked crawler's
        card is exactly as tall as a ranked one (FR-201, SC-201).
      */}
      <div className={styles.rankBlock} data-testid="glance-rank">
        {rank.current === null || rank.best === null ? (
          <p className={styles.unranked}>{copy.unranked}</p>
        ) : (
          <div className={styles.rankNumbers}>
            <span className={styles.rankLabel}>{copy.rankCurrent}</span>
            <span className={styles.rankValue} data-testid="glance-rank-current">
              {copy.rankValue(rank.current)}
            </span>
            <span className={styles.rankLabel}>{copy.rankBest}</span>
            <span className={styles.rankValue} data-testid="glance-rank-best">
              {copy.rankValue(rank.best)}
            </span>
          </div>
        )}
        <div className={styles.rankSpark} data-testid="glance-rank-spark">
          <RankSparkline series={rank} />
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

      <dl className={styles.ledger} data-testid="glance-ledger">
        {LEDGER_KINDS.map((kind) => (
          <LedgerLine key={kind} kind={kind} row={glance.ledger[kind]} />
        ))}
      </dl>

      <section className={styles.block} data-testid="glance-history">
        <h4 className={styles.blockLabel}>{copy.dossierSections.history}</h4>
        <ul className={styles.history}>
          {history.map((item) => (
            <li key={item.id} className={styles.historyRow} data-testid="glance-history-row">
              <span className={styles.historyTime}>{formatTime(item.t)}</span>
              <span className={styles.historyText}>{item.text}</span>
            </li>
          ))}
          {placeholders.map((index) => (
            <li
              key={`placeholder-${index}`}
              className={styles.historyRow}
              data-testid="glance-history-row"
              data-placeholder="true"
            >
              <span className={styles.historyPlaceholder}>{copy.historyPlaceholder}</span>
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
