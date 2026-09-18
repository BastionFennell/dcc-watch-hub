import type { EpisodeMeta } from '../../data/types';
import type { Dossier } from '../../engine/selectors';
import {
  DossierAchievements,
  DossierHeader,
  DossierHistory,
  DossierList,
  DossierStats,
  DossierVitals,
} from './sections';
import styles from './CrawlerDossier.module.css';

export interface CrawlerDossierProps {
  /** `crawlerDossier(state, events, t, id)` - recomputed every render (FR-103). */
  dossier: Dossier;
  meta: EpisodeMeta;
}

/**
 * The System's copy of the crawler sheet, as of the playhead (FR-110/111),
 * stacked in the official sheet's order. Since T306 the sections live in
 * `sections.tsx`, so the full-record dialog can re-lay exactly these components
 * in landscape columns without a second rendering of the sheet (research R5).
 */
export function CrawlerDossier({ dossier, meta }: CrawlerDossierProps) {
  return (
    <article
      className={styles.dossier}
      data-testid="crawler-dossier"
      data-crawler={dossier.id}
      data-episode={meta.id}
    >
      <DossierHeader dossier={dossier} meta={meta} />
      <DossierVitals dossier={dossier} />
      <DossierStats stats={dossier.stats} />
      <DossierList kind="hotlist" items={dossier.hotlist} />
      <DossierList kind="skills" items={dossier.skills} />
      <DossierList kind="inventory" items={dossier.inventory} />
      <DossierAchievements items={dossier.achievements} />
      <DossierHistory items={dossier.history} />
    </article>
  );
}

export default CrawlerDossier;
