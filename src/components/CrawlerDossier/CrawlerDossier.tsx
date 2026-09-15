import type { ReactNode } from 'react';
import type { EpisodeMeta } from '../../data/types';
import type { Dossier } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { FeedItemView } from '../EventFeed/FeedItem';
import { HpSegments } from './HpSegments';
import { RankSparkline } from './RankSparkline';
import styles from './CrawlerDossier.module.css';

export interface CrawlerDossierProps {
  /** `crawlerDossier(state, events, t, id)` — recomputed every render (FR-103). */
  dossier: Dossier;
  meta: EpisodeMeta;
}

const STAT_KEYS = ['str', 'int', 'con', 'dex', 'cha'] as const;

function Section({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: ReactNode;
}) {
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

/**
 * The System's copy of the crawler sheet, as of the playhead (FR-110/111). The
 * section order and vocabulary mirror the official sheet (research R3); every
 * value comes from the `Dossier` view model, so a backward seek simply removes
 * what the crawler has not earned yet (constitution I).
 */
export function CrawlerDossier({ dossier, meta }: CrawlerDossierProps) {
  const { rank } = dossier;

  return (
    <article
      className={styles.dossier}
      data-testid="crawler-dossier"
      data-crawler={dossier.id}
      data-episode={meta.id}
    >
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
              <li key={debuff} className={styles.chip}>
                {debuff}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* The sheet's stat block only exists when the data provides one (FR-110). */}
      {dossier.stats === undefined ? null : (
        <Section name="stats" title={copy.dossierSections.stats}>
          <ul className={styles.stats}>
            {STAT_KEYS.map((key) => (
              <li key={key} className={styles.stat}>
                <span className={styles.statLabel}>{copy.statLabels[key]}</span>
                <span className={styles.statValue}>{dossier.stats?.[key]}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section name="hotlist" title={copy.dossierSections.hotlist}>
        {dossier.hotlist.length === 0 ? (
          <Empty>{copy.dossierEmpty.hotlist}</Empty>
        ) : (
          <ul className={styles.list}>
            {dossier.hotlist.map((entry) => (
              <li key={entry} className={styles.listItem}>
                {entry}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section name="skills" title={copy.dossierSections.skills}>
        {dossier.skills.length === 0 ? (
          <Empty>{copy.dossierEmpty.skills}</Empty>
        ) : (
          <ul className={styles.list}>
            {dossier.skills.map((skill) => (
              <li key={skill.name} className={styles.listItem}>
                <span className={styles.itemName}>{skill.name}</span>
                {skill.rank === undefined ? null : (
                  <span className={styles.itemMeta}>{copy.skillRank(skill.rank)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section name="inventory" title={copy.dossierSections.inventory}>
        {dossier.inventory.length === 0 ? (
          <Empty>{copy.dossierEmpty.inventory}</Empty>
        ) : (
          <ul className={styles.list}>
            {dossier.inventory.map((item) => (
              <li key={item} className={styles.listItem}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section name="achievements" title={copy.dossierSections.achievements}>
        {dossier.achievements.length === 0 ? (
          <Empty>{copy.dossierEmpty.achievements}</Empty>
        ) : (
          <ul className={styles.list}>
            {dossier.achievements.map((achievement) => (
              <li key={`${achievement.t}-${achievement.title}`} className={styles.achievement}>
                <span className={styles.itemName}>{achievement.title}</span>
                <span className={styles.itemMeta}>{formatTime(achievement.t)}</span>
                {achievement.desc === undefined ? null : (
                  <span className={styles.itemDesc}>{achievement.desc}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section name="history" title={copy.dossierSections.history}>
        {dossier.history.length === 0 ? (
          <Empty>{copy.dossierEmpty.history}</Empty>
        ) : (
          <ul className={styles.history} data-testid="dossier-history-items">
            {dossier.history.map((item) => (
              <li key={item.id} className={styles.historyRow} data-testid="dossier-history-item">
                <FeedItemView item={item} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}

export default CrawlerDossier;
