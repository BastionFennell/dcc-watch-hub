import type { ReactNode, Ref } from 'react';
import type { CrawlerStats, EpisodeMeta, SkillEntry } from '../../data/types';
import type { Dossier, DossierAchievement, FeedItem, RankPoint } from '../../engine/selectors';
import { GEAR_SLOT_ORDER, hotbarSlots } from '../../engine/selectors';
import type { GearState } from '../../engine/state';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { FeedItemView } from '../EventFeed/FeedItem';
import { HpSegments } from './HpSegments';
import { RankSparkline } from './RankSparkline';
import styles from './CrawlerDossier.module.css';

/*
 * The crawler sheet, cut into the sections both views need (T306). `CrawlerDossier`
 * stacks them for the rail-width record; `FullRecordDialog` lays the same
 * components out in the official sheet's landscape columns (research R5).
 *
 * Every section is a pure function of the `Dossier` it is handed, so a backward
 * seek simply removes what the crawler has not earned yet (constitution I), and
 * every list item carries `data-item` / `data-name` with its label in its own
 * `<span>` so a later per-item explanation can attach without restructuring
 * (FR-214 - no tooltip today).
 */

const STAT_KEYS = ['str', 'int', 'con', 'dex', 'cha'] as const;

/**
 * A section heading the record's list views can focus on entry
 * (contracts/dialog.md Revision 2). `tabIndex={-1}` only when a ref asks for
 * it, so the stacked dossier keeps exactly the tab order it had.
 */
export interface SectionHeadingProps {
  headingRef?: Ref<HTMLHeadingElement>;
}

function Section({
  name,
  title,
  headingRef,
  children,
}: { name: string; title: string; children: ReactNode } & SectionHeadingProps) {
  return (
    <section className={styles.section} data-testid={`dossier-${name}`}>
      <h3
        className={styles.sectionBar}
        ref={headingRef}
        tabIndex={headingRef === undefined ? undefined : -1}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The "View all (N)" control under a capped tile grid or history list
 * (R2-FR-222). It is rendered only when the section is actually cut short, so
 * the sheet never offers a view that would show the same rows again.
 */
function ViewAll({
  kind,
  count,
  onViewAll,
  viewAllRef,
}: {
  kind: string;
  count: number;
  onViewAll: () => void;
  viewAllRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={viewAllRef}
      className={styles.viewAll}
      onClick={onViewAll}
      aria-controls="crawler-record-body"
      data-testid={`view-all-${kind}`}
    >
      {copy.viewAll(count)}
    </button>
  );
}

function Empty({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>;
}

/**
 * One definition row of the identity grid. `field` is a styling hook only: the
 * crawler number is a long digit group that must never be split across lines
 * (T330 visual review - it was rendering as "10,491,2 / 01").
 */
function Row({ label, value, field }: { label: string; value: ReactNode; field?: string }) {
  return (
    <div className={styles.row} data-field={field}>
      <dt className={styles.rowLabel}>{label}</dt>
      <dd className={styles.rowValue}>{value}</dd>
    </div>
  );
}

export interface DossierHeaderProps {
  dossier: Dossier;
  meta: EpisodeMeta;
}

/** The System-blue band plus the sheet's identity grid (FR-113). */
export function DossierHeader({ dossier, meta }: DossierHeaderProps) {
  return (
    <div className={styles.identityBlock} data-episode={meta.id}>
      <header className={styles.band}>
        <img
          className={styles.portrait}
          src={dossier.portrait}
          alt={dossier.name}
          width={56}
          height={56}
        />
        <div className={styles.bandMeta}>
          <h3 className={styles.name} data-testid="dossier-name">
            {dossier.name}
          </h3>
          {/*
            A real separator, not a CSS-only one (UX review 0.7): the dot is
            decorative and hidden, and the comma beside it is what an accessible
            name reads, so this is "Harry, played by Marcus" and never
            "Harryplayed by Marcus" (T338).
          */}
          <p className={styles.handle}>
            {dossier.handle}
            {/* 008: the real sheets name no player, so the credit only appears
                when the data actually carries one. */}
            {dossier.player.trim() !== '' && (
              <>
                <span className={styles.dot} aria-hidden="true">
                  {'·'}
                </span>
                <span className="sr-only">{copy.srSeparator}</span>
                {copy.playedBy(dossier.player)}
              </>
            )}
          </p>
        </div>
      </header>

      <dl className={styles.grid} data-testid="dossier-identity">
        {dossier.race === undefined ? null : (
          <Row label={copy.sheetLabels.race} value={dossier.race} />
        )}
        {dossier.pronouns === undefined ? null : (
          <Row label={copy.sheetLabels.pronouns} value={dossier.pronouns} />
        )}
        {dossier.crawlerNumber === undefined ? null : (
          <Row
            label={copy.sheetLabels.crawlerNumber}
            value={String(dossier.crawlerNumber)}
            field="crawlerNumber"
          />
        )}
        <Row label={copy.sheetLabels.level} value={copy.levelShort(dossier.level)} />
        <Row label={copy.sheetLabels.class} value={dossier.class ?? copy.unclassed} />
        <Row label={copy.sheetLabels.floor} value={copy.floorLabel(dossier.floor)} />
      </dl>
    </div>
  );
}

export interface DossierVitalsProps {
  dossier: Dossier;
}

/**
 * Movement since the previous elapsed rank point (T343, UX review 1.4).
 * `previous - current`, so a positive number means the rank number fell, which
 * is an improvement. Null with fewer than two points: there is nothing to
 * compare against yet, and the sheet simply shows the current rank.
 */
function rankDelta(points: readonly RankPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 2].rank - points[points.length - 1].rank;
}

/** VITALS + DEBUFFS: how the crawler is doing right now (FR-110). */
export function DossierVitals({ dossier }: DossierVitalsProps) {
  const { rank } = dossier;
  const delta = rankDelta(rank.points);
  return (
    <>
      <Section name="vitals" title={copy.dossierSections.vitals}>
        <div className={styles.vitals}>
          <HpSegments
            current={dossier.hp.current}
            max={dossier.hp.max}
            filled={dossier.hp.filled}
          />
          <p className={styles.hpValue} data-testid="dossier-hp">
            {copy.hpValue(dossier.hp.current, dossier.hp.max)}
          </p>
          <div className={styles.rankBlock} data-testid="dossier-rank">
            {rank.current === null || rank.best === null ? (
              <p className={styles.unranked}>{copy.unranked}</p>
            ) : (
              <>
                <div className={styles.rankNumbers}>
                  {/* The numbers were unlabeled (UX review 1.4): say what they are. */}
                  <span className={styles.rankTitle}>{copy.rankLabel}</span>
                  <span className={styles.rankLabel}>{copy.rankCurrent}</span>
                  <span className={styles.rankValue} data-testid="rank-current">
                    {copy.rankValue(rank.current)}
                  </span>
                  <span className={styles.rankLabel}>{copy.rankBest}</span>
                  <span className={styles.rankValue} data-testid="rank-best">
                    {copy.rankValue(rank.best)}
                  </span>
                  {delta === null ? null : (
                    <span
                      className={styles.rankDelta}
                      data-testid="rank-delta"
                      data-direction={delta > 0 ? 'up' : 'down'}
                    >
                      {copy.rankDelta(delta)}
                    </span>
                  )}
                </div>
                <RankSparkline series={rank} />
              </>
            )}
          </div>
        </div>
      </Section>

      <Section name="debuffs" title={copy.dossierSections.debuffs}>
        {dossier.debuffs.length === 0 ? (
          <Empty>{copy.dossierEmpty.debuffs}</Empty>
        ) : (
          <ul className={styles.chips}>
            {dossier.debuffs.map((debuff) => (
              <li key={debuff} className={styles.chip} data-item="debuff" data-name={debuff}>
                {debuff}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export interface DossierStatsProps {
  /** Absent in the data → the sheet has no stat block at all (FR-110). */
  stats?: CrawlerStats;
}

export function DossierStats({ stats }: DossierStatsProps) {
  if (stats === undefined) return null;
  return (
    <Section name="stats" title={copy.dossierSections.stats}>
      <ul className={styles.stats}>
        {STAT_KEYS.map((key) => (
          <li key={key} className={styles.stat} data-item="stat" data-name={key}>
            <span className={styles.statLabel}>{copy.statLabels[key]}</span>
            <span className={styles.statValue}>{stats[key]}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export type DossierListProps = (
  | { kind: 'hotlist'; items: readonly string[] }
  | { kind: 'inventory'; items: readonly string[] }
  | { kind: 'skills'; items: readonly SkillEntry[] }
) &
  SectionHeadingProps;

/** HOTLIST / SKILLS / INVENTORY - the three plain-name lists. */
export function DossierList(props: DossierListProps) {
  const { kind, headingRef } = props;
  if (props.items.length === 0) {
    return (
      <Section name={kind} title={copy.dossierSections[kind]} headingRef={headingRef}>
        <Empty>{copy.dossierEmpty[kind]}</Empty>
      </Section>
    );
  }

  return (
    <Section name={kind} title={copy.dossierSections[kind]} headingRef={headingRef}>
      <ul className={styles.list}>
        {props.kind === 'skills'
          ? props.items.map((skill) => (
              <li
                key={skill.name}
                className={styles.listItem}
                data-item="skill"
                data-name={skill.name}
              >
                <span className={styles.itemLabel}>{skill.name}</span>
                {skill.rank === undefined ? null : (
                  <span className={styles.itemMeta}>{copy.skillRank(skill.rank)}</span>
                )}
              </li>
            ))
          : props.items.map((entry) => (
              <li key={entry} className={styles.listItem} data-item={kind} data-name={entry}>
                <span className={styles.itemLabel}>{entry}</span>
              </li>
            ))}
      </ul>
    </Section>
  );
}

export interface DossierAchievementsProps extends SectionHeadingProps {
  items: readonly DossierAchievement[];
}

export function DossierAchievements({ items, headingRef }: DossierAchievementsProps) {
  return (
    <Section
      name="achievements"
      title={copy.dossierSections.achievements}
      headingRef={headingRef}
    >
      {items.length === 0 ? (
        <Empty>{copy.dossierEmpty.achievements}</Empty>
      ) : (
        <ul className={styles.list}>
          {items.map((achievement) => (
            <li
              key={`${achievement.t}-${achievement.title}`}
              className={styles.achievement}
              data-item="achievement"
              data-name={achievement.title}
            >
              <span className={styles.itemLabel}>{achievement.title}</span>
              <span className={styles.itemMeta}>{formatTime(achievement.t)}</span>
              {achievement.desc === undefined ? null : (
                <span className={styles.itemDesc}>{achievement.desc}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export interface DossierHistoryProps extends SectionHeadingProps {
  items: readonly FeedItem[];
  /** The record's sheet shows the latest eight and offers the rest (R2-FR-222). */
  max?: number;
  onViewAll?: () => void;
  viewAllRef?: Ref<HTMLButtonElement>;
}

/** This crawler's elapsed moments, newest first (FR-111). */
export function DossierHistory({
  items,
  max,
  onViewAll,
  viewAllRef,
  headingRef,
}: DossierHistoryProps) {
  const shown = max === undefined ? items : items.slice(0, max);
  const cut = shown.length < items.length && onViewAll !== undefined;

  return (
    <Section name="history" title={copy.dossierSections.history} headingRef={headingRef}>
      {items.length === 0 ? (
        <Empty>{copy.dossierEmpty.history}</Empty>
      ) : (
        <ul className={styles.history} data-testid="dossier-history-items">
          {shown.map((item) => (
            <li
              key={item.id}
              className={styles.historyRow}
              data-testid="dossier-history-item"
              data-item="history"
              data-name={item.text}
            >
              <FeedItemView item={item} />
            </li>
          ))}
        </ul>
      )}
      {cut ? (
        <ViewAll
          kind="history"
          count={items.length}
          onViewAll={onViewAll}
          viewAllRef={viewAllRef}
        />
      ) : null}
    </Section>
  );
}

/* --- 003 revision 2: the record's MMO-shaped sections (research R8) --- */

export interface DossierHotbarProps extends SectionHeadingProps {
  hotlist: readonly string[];
}

/**
 * HOTLIST as an MMO hotbar (R2-FR-221): ten fixed square slots, entries filling
 * them in order, empty ones drawn dim, and a `+N` marker when the crawler is
 * tracking more than the bar can hold. The slot count never changes with the
 * playhead, so the sheet does not reflow as the hotlist grows.
 */
export function DossierHotbar({ hotlist, headingRef }: DossierHotbarProps) {
  const { slots, overflow } = hotbarSlots(hotlist);
  return (
    <Section name="hotlist" title={copy.dossierSections.hotlist} headingRef={headingRef}>
      <ul className={styles.hotbar} data-overflow={overflow === 0 ? undefined : 'true'}>
        {slots.map((entry, index) => (
          <li
            key={index}
            className={styles.hotbarSlot}
            data-testid="hotbar-slot"
            data-filled={entry === null ? undefined : 'true'}
            data-item={entry === null ? undefined : 'hotlist'}
            data-name={entry ?? undefined}
            /*
             * The visible name is clamped to two lines, so the slot states its
             * own name instead of leaving a reader with a truncated line and a
             * bare digit (T330). No `title`: a native tooltip on a slot that
             * does nothing is exactly what constitution III forbids.
             */
            aria-label={
              entry === null
                ? copy.hotbarSlotEmptyAria(index + 1)
                : copy.hotbarSlotAria(index + 1, entry)
            }
          >
            <span className={styles.hotbarNumber}>{copy.hotbarSlot(index + 1)}</span>
            {entry === null ? null : <span className={styles.itemLabel}>{entry}</span>}
          </li>
        ))}
        {overflow === 0 ? null : (
          <li className={styles.hotbarOverflow} data-testid="hotbar-overflow">
            {copy.hotbarOverflow(overflow)}
          </li>
        )}
      </ul>
    </Section>
  );
}

export interface DossierGearProps extends SectionHeadingProps {
  gear: GearState;
}

/**
 * GEAR: every slot on the official sheet, in sheet order, with what is worn in
 * it or "-" (R2 US2 scenario 3). Accessories are one row holding the whole
 * list, because the sheet has one accessory line.
 */
export function DossierGear({ gear, headingRef }: DossierGearProps) {
  return (
    <Section name="gear" title={copy.dossierSections.gear} headingRef={headingRef}>
      <dl className={styles.gearRows}>
        {GEAR_SLOT_ORDER.map((slot) => {
          const worn =
            slot === 'accessory'
              ? gear.accessories.length === 0
                ? null
                : gear.accessories.join(', ')
              : gear[slot];
          const label =
            slot === 'accessory' ? copy.gearAccessoriesLabel : copy.gearSlotLabels[slot];
          return (
            <div
              key={slot}
              className={styles.gearRow}
              data-testid="gear-row"
              data-item="gear"
              data-slot={slot}
              data-name={worn ?? undefined}
              data-filled={worn === null ? undefined : 'true'}
            >
              <dt className={styles.rowLabel}>{label}</dt>
              <dd className={styles.gearValue}>
                <span className={styles.itemLabel}>{worn ?? copy.dossierEmpty.gearSlot}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

export type DossierTilesKind = 'skills' | 'inventory' | 'achievements';

export type DossierTilesProps = (
  | { kind: 'skills'; items: readonly SkillEntry[] }
  | { kind: 'inventory'; items: readonly string[] }
  | { kind: 'achievements'; items: readonly DossierAchievement[] }
) & {
  /** Tiles shown before "View all" takes over (R2 US2 scenario 4). */
  max?: number;
  onViewAll?: () => void;
  viewAllRef?: Ref<HTMLButtonElement>;
} & SectionHeadingProps;

/** One tile: the name, then rank or time as a mono caps footer (research R8). */
function Tile({
  item,
  name,
  footer,
}: {
  item: string;
  name: string;
  footer?: string;
}) {
  return (
    <li className={styles.tile} data-testid="tile" data-item={item} data-name={name}>
      <span className={styles.itemLabel}>{name}</span>
      {footer === undefined ? null : <span className={styles.tileFooter}>{footer}</span>}
    </li>
  );
}

/**
 * SKILLS / INVENTORY / ACHIEVEMENTS as a bag-style tile grid, capped at `max`
 * with a "View all (N)" control for the rest (R2-FR-222). The cap is a display
 * rule only: the list view behind the button renders the same elapsed items.
 */
export function DossierTiles(props: DossierTilesProps) {
  const { kind, max = 8, onViewAll, viewAllRef, headingRef } = props;
  const total = props.items.length;
  const cut = total > max && onViewAll !== undefined;

  return (
    <Section name={kind} title={copy.dossierSections[kind]} headingRef={headingRef}>
      {total === 0 ? (
        <Empty>{copy.dossierEmpty[kind]}</Empty>
      ) : (
        <ul className={styles.tiles}>
          {props.kind === 'skills'
            ? props.items
                .slice(0, max)
                .map((skill) => (
                  <Tile
                    key={skill.name}
                    item="skill"
                    name={skill.name}
                    footer={skill.rank === undefined ? undefined : copy.skillRank(skill.rank)}
                  />
                ))
            : props.kind === 'achievements'
              ? props.items
                  .slice(0, max)
                  .map((achievement) => (
                    <Tile
                      key={`${achievement.t}-${achievement.title}`}
                      item="achievement"
                      name={achievement.title}
                      footer={formatTime(achievement.t)}
                    />
                  ))
              : props.items
                  .slice(0, max)
                  .map((entry) => <Tile key={entry} item="inventory" name={entry} />)}
        </ul>
      )}
      {cut ? (
        <ViewAll kind={kind} count={total} onViewAll={onViewAll} viewAllRef={viewAllRef} />
      ) : null}
    </Section>
  );
}
