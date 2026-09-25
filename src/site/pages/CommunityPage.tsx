/**
 * `/community` - the single link every social bio points at (011 §3.5).
 *
 * Discord first and large, then everywhere else, then how often new crawls
 * land, then the one paragraph about supporting the show. Single column at
 * every width: this page is meant to be fast and boring.
 *
 * The shell's measure holds the page; `styles.column` holds the reading
 * column inside it, so every block - card, tiles, paragraph, footer - shares
 * one left edge and one 24 px rhythm.
 */
import { useShow } from '../../data/ShowContext';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { trackOutbound } from '../analytics';
import { SiteFooter } from '../components/SiteFooter';
import { SocialRow } from '../components/SocialRow';
import page from './page.module.css';
import styles from './CommunityPage.module.css';

export function CommunityPage() {
  const { show } = useShow();

  return (
    <div className={`${page.page} ${styles.page}`}>
      <Seo
        title={siteCopy.pageTitle(siteCopy.navCommunity)}
        description={siteCopy.communityDescription}
        canonicalPath="/community"
        ogImage={siteCopy.ogSiteImage}
      />

      <div className={styles.column}>
        <div className={page.head}>
          <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
          <h1 className={page.pageTitle}>{siteCopy.communityTitle}</h1>
          <p className={`${page.lead} ${styles.lead}`}>{siteCopy.communityLead}</p>
        </div>

        {show === null ? null : (
          <>
            <section className={styles.discord} aria-labelledby="discord">
              <div className={styles.discordText}>
                <h2 className={styles.h2} id="discord">
                  {siteCopy.discordTitle}
                </h2>
                <p className={styles.discordBody}>{siteCopy.communityDiscordBody}</p>
              </div>
              <a
                className={styles.big}
                href={show.links.discord}
                target="_blank"
                rel="noopener"
                onClick={() => trackOutbound('discord')}
              >
                {siteCopy.discordCta}
              </a>
            </section>

            <section className={styles.follow} aria-labelledby="platforms">
              <div className={styles.followHead}>
                <h2 className={styles.h2} id="platforms">
                  {siteCopy.followTitle}
                </h2>
                {show.cadence === undefined ? null : (
                  <p className={styles.cadence}>{show.cadence}</p>
                )}
              </div>
              <SocialRow links={show.links} variant="tiles" />
            </section>
          </>
        )}

        <section className={styles.support} aria-label={siteCopy.supportAria}>
          <p className={styles.supportBody}>{siteCopy.supportBody}</p>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}

export default CommunityPage;
