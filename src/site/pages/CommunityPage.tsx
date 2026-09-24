/**
 * `/community` - the single link every social bio points at (011 §3.5).
 *
 * Discord first and large, then everywhere else, then how often new crawls
 * land, then the one paragraph about supporting the show. Single column at
 * every width: this page is meant to be fast and boring.
 */
import { useShow } from '../../data/ShowContext';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { SiteFooter } from '../components/SiteFooter';
import { SocialRow } from '../components/SocialRow';
import page from './page.module.css';
import styles from './CommunityPage.module.css';

export function CommunityPage() {
  const { show } = useShow();

  return (
    <div className={page.page}>
      <Seo
        title={siteCopy.pageTitle(siteCopy.navCommunity)}
        description={siteCopy.communityDescription}
        canonicalPath="/community"
        ogImage={siteCopy.ogSiteImage}
      />

      <div className={page.head}>
        <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
        <h1 className={page.pageTitle}>{siteCopy.communityTitle}</h1>
        <p className={page.lead}>{siteCopy.communityLead}</p>
      </div>

      {show === null ? null : (
        <>
          <section className={styles.discord} aria-labelledby="discord">
            <h2 className={page.sectionTitle} id="discord">
              {siteCopy.discordTitle}
            </h2>
            <p className={page.lead}>{siteCopy.discordBody}</p>
            <a className={styles.big} href={show.links.discord} target="_blank" rel="noopener">
              {siteCopy.discordCta}
            </a>
          </section>

          <section className={page.section} aria-labelledby="platforms">
            <h2 className={page.sectionTitle} id="platforms">
              {siteCopy.navCommunity}
            </h2>
            <SocialRow links={show.links} />
            {show.cadence === undefined ? null : (
              <p className={styles.cadence}>{show.cadence}</p>
            )}
          </section>
        </>
      )}

      <section className={page.section} aria-labelledby="support">
        <h2 className={page.sectionTitle} id="support">
          {siteCopy.supportTitle}
        </h2>
        <p className={page.lead}>{siteCopy.supportBody}</p>
      </section>

      <SiteFooter />
    </div>
  );
}

export default CommunityPage;
