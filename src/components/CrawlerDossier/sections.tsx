import type { ReactNode } from 'react';
import type { CrawlerStats, EpisodeMeta, SkillEntry } from '../../data/types';
import type { Dossier, DossierAchievement, FeedItem } from '../../engine/selectors';
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
 * (FR-214 — no tooltip today).
 */

const STAT_KEYS = ['str', 'int', 'con', 'dex', 'cha'] as const;

function Section({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} data-testid={`dossier-${name}`}>
      <h3 className={styles.sectionBar}>{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
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
          <p className={styles.handle}>
            {dossier.handle}
            <span className={styles.dot}> · </span>
            {dossier.player}
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
          <Row label={copy.sheetLabels.crawlerNumber} value={String(dossier.crawlerNumber)} />
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

/** VITALS + DEBUFFS: how the crawler is doing right now (FR-110). */
export function DossierVitals({ dossier }: DossierVitalsProps) {
  const { rank } = dossier;
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
                  <span className={styles.rankLabel}>{copy.rankCurrent}</span>
                  <span className={styles.rankValue} data-testid="rank-current">
                    {copy.rankValue(rank.current)}
                  </span>
                  <span className={styles.rankLabel}>{copy.rankBest}</span>
                  <span className={styles.rankValue} data-testid="rank-best">
                    {copy.rankValue(rank.best)}
                  </span>
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

export type DossierListProps =
  | { kind: 'hotlist'; items: readonly string[] }
  | { kind: 'inventory'; items: readonly string[] }
  | { kind: 'skills'; items: readonly SkillEntry[] };

/** HOTLIST / SKILLS / INVENTORY — the three plain-name lists. */
export function DossierList(props: DossierListProps) {
  const { kind } = props;
  if (props.items.length === 0) {
    return (
      <Section name={kind} title={copy.dossierSections[kind]}>
        <Empty>{copy.dossierEmpty[kind]}</Empty>
      </Section>
    );
  }

  return (
    <Section name={kind} title={copy.dossierSections[kind]}>
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

export interface DossierAchievementsProps {
  items: readonly DossierAchievement[];
}

export function DossierAchievements({ items }: DossierAchievementsProps) {
  return (
    <Section name="achievements" title={copy.dossierSections.achievements}>
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

export interface DossierHistoryProps {
  items: readonly FeedItem[];
}

/** This crawler's elapsed moments, newest first (FR-111). */
export function DossierHistory({ items }: DossierHistoryProps) {
  return (
    <Section name="history" title={copy.dossierSections.history}>
      {items.length === 0 ? (
        <Empty>{copy.dossierEmpty.history}</Empty>
      ) : (
        <ul className={styles.history} data-testid="dossier-history-items">
          {items.map((item) => (
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
    </Section>
  );
}
