/**
 * `/crawlers` - the roster (011 §3.3).
 *
 * No filter chips (012). They filtered on an authored `status` field that no
 * longer exists, and could not exist: a row of chips reading "Alive / Dead" is
 * a spoiler served to everyone who lands here, and a chip that appears the week
 * someone dies is a worse one. Condition lives in the dossier now, one card at
 * a time, behind a click the reader chose to make.
 */
import { useCrawlers } from '../../data/CrawlersContext';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { RosterCard } from '../components/RosterCard';
import { SiteFooter } from '../components/SiteFooter';
import page from './page.module.css';

export function CrawlersPage() {
  const { profiles } = useCrawlers();

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

      <ul className={page.roster}>
        {profiles.map((profile) => (
          <li key={profile.id}>
            <RosterCard profile={profile} variant="card" />
          </li>
        ))}
      </ul>

      <SiteFooter />
    </div>
  );
}

export default CrawlersPage;
