/**
 * `/crawlers` - the roster (011 §3.3).
 *
 * The filter chips appear only when there is something to filter: five living
 * crawlers make a row of chips that all do the same thing, which is chrome
 * pretending to be a feature. One status, no chips.
 */
import { useState } from 'react';
import { useCrawlers } from '../../data/CrawlersContext';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { RosterCard } from '../components/RosterCard';
import { SiteFooter } from '../components/SiteFooter';
import type { CrawlerLiveStatus } from '../../data/types';
import page from './page.module.css';
import styles from './CrawlersPage.module.css';

export function CrawlersPage() {
  const { profiles, status } = useCrawlers();
  const [filter, setFilter] = useState<CrawlerLiveStatus | null>(null);

  // First-seen order, so the chips read in the order the roster does.
  const present: CrawlerLiveStatus[] = [];
  for (const profile of profiles) {
    if (!present.includes(profile.status)) present.push(profile.status);
  }
  const showChips = present.length > 1;
  const shown =
    filter === null || !showChips ? profiles : profiles.filter((p) => p.status === filter);

  return (
    <div className={page.page}>
      <Seo
        title={siteCopy.pageTitle(siteCopy.crawlersTitle)}
        description={siteCopy.crawlersDescription}
        canonicalPath="/crawlers"
        ogImage={siteCopy.ogSiteImage}
      />

      <div className={page.head}>
        <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
        <h1 className={page.pageTitle}>{siteCopy.crawlersTitle}</h1>
        <p className={page.lead}>{siteCopy.crawlersLead}</p>
      </div>

      {showChips ? (
        <div className={styles.chips} role="group" aria-label={siteCopy.filterLabel}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={filter === null}
            onClick={() => setFilter(null)}
          >
            {siteCopy.filterAll}
          </button>
          {present.map((value) => (
            <button
              key={value}
              type="button"
              className={styles.chip}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {siteCopy.statusLabel[value]}
            </button>
          ))}
        </div>
      ) : null}

      <ul className={page.roster}>
        {shown.map((profile) => (
          <li key={profile.id}>
            <RosterCard profile={profile} status={status?.crawlers[profile.id]} variant="card" />
          </li>
        ))}
      </ul>

      <SiteFooter />
    </div>
  );
}

export default CrawlersPage;
