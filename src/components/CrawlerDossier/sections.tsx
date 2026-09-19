import type { ReactNode, Ref } from 'react';
import type { CrawlerStats, EpisodeMeta, InventoryEntry, SkillEntry } from '../../data/types';
import type { Dossier, DossierAchievement, FeedItem, RankPoint } from '../../engine/selectors';
import { GEAR_SLOT_ORDER, hotbarSlots } from '../../engine/selectors';
import type { HotlistView, SpellView } from '../../engine/spells';
import type { GearState } from '../../engine/state';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { FeedItemView } from '../EventFeed/FeedItem';
import { Tooltip } from '../Tooltip/Tooltip';
import tip from '../Tooltip/Tooltip.module.css';
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

/* --- 008 revision 2: short names on the sheet, the full text on demand --- */

/**
 * The body of an entry's tooltip: the entry's own name as a bold first line
 * (the key or tile clamps it, so the tooltip is where it is read in full), the
 * sheet's text, and the sheet's numbers as a mono footer where there are any.
 * `undefined` when the entry explains nothing - `Tooltip` then renders its
 * trigger's contents bare, with no button and no affordance (R2 scope).
 */
function tooltipBody(name: string, desc?: string, meta?: string): ReactNode | undefined {
  if (desc === undefined) return undefined;
  return (
    <>
      <span className={tip.title}>{name}</span>
      {desc}
      {meta === undefined ? null : <span className={tip.meta}>{meta}</span>}
    </>
  );
}

/* --- 008 revision 4: the book's own fields, wherever a spell is explained --- */

/**
 * One registry-backed spell as the book prints it, minus the headline: the type
 * line, then Mana / Range / Duration, the labelled lines, the description, Base
 * Damage, and the UPGRADES block. The tooltip puts the name above this; the
 * spells list view puts the row's own label above it, so the two surfaces show
 * exactly the same fields (spec R4).
 */
function spellDetails(view: SpellView): ReactNode[] {
  const lines: ReactNode[] = [];
  const tags = copy.spellTags(view.tags);
  if (tags !== undefined) {
    lines.push(
      <span key="tags" className={tip.tags}>
        {tags}
      </span>,
    );
  }

  // Mana, Range and Duration read as one line, in the book's order.
  const numbers: string[] = [];
  if (view.mana !== undefined) numbers.push(copy.spellMana(view.mana));
  if (view.range !== undefined) numbers.push(copy.spellRange(view.range));
  if (view.duration !== undefined) numbers.push(copy.spellDuration(view.duration));
  if (numbers.length > 0) {
    lines.push(
      <span key="numbers" className={tip.line}>
        {numbers.join(' · ')}
      </span>,
    );
  }

  if (view.limitations !== undefined) {
    lines.push(
      <span key="limitations" className={tip.line}>
        {copy.spellLimitations(view.limitations)}
      </span>,
    );
  }
  if (view.cooldown !== undefined) {
    lines.push(
      <span key="cooldown" className={tip.line}>
        {copy.spellCooldown(view.cooldown)}
      </span>,
    );
  }
  if (view.description !== '') {
    lines.push(
      <span key="description" className={tip.line}>
        {view.description}
      </span>,
    );
  }
  if (view.baseDamage !== undefined) {
    lines.push(
      <span key="baseDamage" className={tip.line}>
        {copy.spellBaseDamage(view.baseDamage)}
      </span>,
    );
  }
  if (view.upgrades.length > 0) {
    lines.push(
      <span key="upgrades" className={tip.blockHead}>
        {copy.spellUpgrades}
      </span>,
      ...view.upgrades.map((upgrade, index) => (
        <span key={`upgrade-${index}`} className={tip.line}>
          {copy.spellUpgrade(upgrade.rank, upgrade.text)}
        </span>
      )),
    );
  }
  return lines;
}

/**
 * A spell's tooltip. A resolved entry gets the book's fields; one the registry
 * does not carry keeps the plain body revision 2 gave it - its own text and the
 * sheet's numbers - so homebrew and half-filled sheets are unchanged.
 */
function spellTooltipBody(view: SpellView): ReactNode | undefined {
  if (view.id === undefined) {
    return tooltipBody(
      view.name,
      view.description === '' ? undefined : view.description,
      copy.spellMeta(view.rank, view.mana),
    );
  }
  return (
    <>
      <span className={tip.title}>{view.name}</span>
      {spellDetails(view)}
    </>
  );
}

/** The corner box on a key or tile that holds more than one of a thing. */
function Qty({ qty, testId }: { qty: number | undefined; testId: string }) {
  if (qty === undefined || qty <= 1) return null;
  return (
    <span className={styles.qtyBox} data-testid={testId}>
      {copy.qty(qty)}
    </span>
  );
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
          {/* The handle repeats the name, so only the credit remains, when
              there is one. */}
          {dossier.player.trim() !== '' && (
            <p className={styles.handle}>{copy.playedBy(dossier.player)}</p>
          )}
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

export type DossierListKind = 'hotlist' | 'inventory' | 'skills' | 'spells';

export type DossierListProps = (
  | { kind: 'hotlist'; items: readonly HotlistView[] }
  | { kind: 'inventory'; items: readonly InventoryEntry[] }
  | { kind: 'skills'; items: readonly SkillEntry[] }
  | { kind: 'spells'; items: readonly SpellView[] }
) &
  SectionHeadingProps;

/** What one row of a list view says, whichever section it came from. */
interface ListRow {
  name: string;
  /** Rank, mana cost, or a quantity - whatever the section's meta column is. */
  meta?: string;
  /** A node since 008 revision 4: a registry spell prints the book's fields. */
  desc?: ReactNode;
}

/** `data-item` per section: the singular noun the record has always used. */
const LIST_ITEM_NAME: Record<DossierListKind, string> = {
  hotlist: 'hotlist',
  inventory: 'inventory',
  skills: 'skill',
  spells: 'spell',
};

function listRows(props: DossierListProps): ListRow[] {
  switch (props.kind) {
    case 'skills':
      return props.items.map((skill) => ({
        name: skill.name,
        ...(skill.rank === undefined ? {} : { meta: copy.skillRank(skill.rank) }),
        ...(skill.desc === undefined ? {} : { desc: skill.desc }),
      }));
    case 'spells':
      return props.items.map((spell) => {
        const meta = copy.spellMeta(spell.rank, spell.mana);
        // A resolved spell shows everything the tooltip shows; an unresolved one
        // still shows only whatever text the sheet wrote for it.
        const details = spell.id === undefined ? null : spellDetails(spell);
        const desc =
          details === null
            ? spell.description === ''
              ? undefined
              : spell.description
            : details.length === 0
              ? undefined
              : details;
        return {
          name: spell.name,
          ...(meta === undefined ? {} : { meta }),
          ...(desc === undefined ? {} : { desc }),
        };
      });
    default:
      return props.items.map((entry) => ({
        name: entry.name,
        ...(entry.qty === undefined || entry.qty <= 1 ? {} : { meta: copy.qty(entry.qty) }),
        ...(entry.desc === undefined ? {} : { desc: entry.desc }),
      }));
  }
}

/**
 * HOTLIST / SKILLS / SPELLS / INVENTORY as plain rows - the stacked dossier, and
 * the record's "View all" views. Since 008 revision 2 a row also carries what
 * the sheet wrote about the entry, beneath the name: a list view has the room
 * the tiles do not, so nothing there hides behind a tooltip.
 */
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
        {listRows(props).map((row) => (
          <li
            key={row.name}
            className={styles.listItem}
            data-item={LIST_ITEM_NAME[kind]}
            data-name={row.name}
          >
            <span className={styles.itemLabel}>{row.name}</span>
            {row.meta === undefined ? null : <span className={styles.itemMeta}>{row.meta}</span>}
            {row.desc === undefined ? null : (
              <span className={styles.itemDesc}>{row.desc}</span>
            )}
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
  hotlist: readonly HotlistView[];
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
        {slots.map((entry, index) => {
          /*
           * The visible name is clamped to two lines, so the key states its own
           * name instead of leaving a reader with a truncated line and a bare
           * digit (T330), and says how many it holds when it holds a stack.
           */
          const label =
            entry === null
              ? copy.hotbarSlotEmptyAria(index + 1)
              : entry.qty === undefined || entry.qty <= 1
                ? copy.hotbarSlotAria(index + 1, entry.name)
                : copy.hotbarSlotQtyAria(index + 1, entry.name, entry.qty);
          /*
           * The key explains itself only when the sheet gave it something to
           * say; without a description it stays the inert key it always was.
           * A mark pointing at the spell registry (008 R4) shows the book's
           * fields instead of a bare paragraph.
           */
          const body =
            entry === null
              ? undefined
              : entry.spell === undefined
                ? tooltipBody(entry.name, entry.desc)
                : spellTooltipBody(entry.spell);
          return (
            <li
              key={index}
              className={styles.hotbarSlot}
              data-testid="hotbar-slot"
              data-filled={entry === null ? undefined : 'true'}
              data-item={entry === null ? undefined : 'hotlist'}
              data-name={entry?.name ?? undefined}
              aria-label={body === undefined ? label : undefined}
            >
              <span className={styles.hotbarNumber}>{copy.hotbarSlot(index + 1)}</span>
              <Qty qty={entry?.qty} testId="hotbar-qty" />
              {entry === null ? null : (
                <Tooltip content={body} className={styles.hotbarTrigger} label={label}>
                  <span className={styles.itemLabel}>{entry.name}</span>
                </Tooltip>
              )}
            </li>
          );
        })}
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

export type DossierTilesKind = 'skills' | 'spells' | 'inventory' | 'achievements';

export type DossierTilesProps = (
  | { kind: 'skills'; items: readonly SkillEntry[] }
  | { kind: 'spells'; items: readonly SpellView[] }
  | { kind: 'inventory'; items: readonly InventoryEntry[] }
  | { kind: 'achievements'; items: readonly DossierAchievement[] }
) & {
  /** Tiles shown before "View all" takes over (R2 US2 scenario 4). */
  max?: number;
  onViewAll?: () => void;
  viewAllRef?: Ref<HTMLButtonElement>;
} & SectionHeadingProps;

/**
 * One tile: the name, then rank, cost or time as a mono caps footer (research
 * R8). Since 008 revision 2 a tile whose entry carries the sheet's text is a
 * tooltip trigger; one that does not is the inert tile it always was.
 */
function Tile({
  item,
  name,
  footer,
  desc,
  body: prebuilt,
  qty,
}: {
  item: string;
  name: string;
  footer?: string;
  desc?: string;
  /** 008 revision 4: a spell tile hands in the book's body already built. */
  body?: ReactNode;
  qty?: number;
}) {
  const body = prebuilt ?? tooltipBody(name, desc, footer);
  const face = (
    <>
      <span className={styles.itemLabel}>{name}</span>
      {footer === undefined ? null : <span className={styles.tileFooter}>{footer}</span>}
    </>
  );
  return (
    <li className={styles.tile} data-testid="tile" data-item={item} data-name={name}>
      <Qty qty={qty} testId="tile-qty" />
      {body === undefined ? (
        face
      ) : (
        <Tooltip content={body} className={styles.tileTrigger} label={copy.tooltipTrigger(name)}>
          {face}
        </Tooltip>
      )}
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
            ? props.items.slice(0, max).map((skill) => (
                <Tile
                  key={skill.name}
                  item="skill"
                  name={skill.name}
                  footer={skill.rank === undefined ? undefined : copy.skillRank(skill.rank)}
                  desc={skill.desc}
                />
              ))
            : props.kind === 'spells'
              ? props.items.slice(0, max).map((spell) => {
                  const body = spellTooltipBody(spell);
                  return (
                    <Tile
                      key={spell.id ?? spell.name}
                      item="spell"
                      name={spell.name}
                      footer={copy.spellMeta(spell.rank, spell.mana)}
                      {...(body === undefined ? {} : { body })}
                    />
                  );
                })
              : props.kind === 'achievements'
                ? props.items.slice(0, max).map((achievement) => (
                    <Tile
                      key={`${achievement.t}-${achievement.title}`}
                      item="achievement"
                      name={achievement.title}
                      footer={formatTime(achievement.t)}
                    />
                  ))
                : props.items.slice(0, max).map((entry) => (
                    <Tile
                      key={entry.name}
                      item="inventory"
                      name={entry.name}
                      desc={entry.desc}
                      qty={entry.qty}
                    />
                  ))}
        </ul>
      )}
      {cut ? (
        <ViewAll kind={kind} count={total} onViewAll={onViewAll} viewAllRef={viewAllRef} />
      ) : null}
    </Section>
  );
}
