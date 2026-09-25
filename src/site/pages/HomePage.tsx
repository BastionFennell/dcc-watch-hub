/**
 * `/` - convert a stranger in ten seconds (011 §3.1).
 *
 * Order, top to bottom and identical on a phone: hero, latest episode, the
 * roster, the two strips, the footer. Everything time-dependent takes `now`
 * from `useNow`, seeded with the build's own clock, so the prerendered HTML and
 * the first client render agree before the real clock takes over.
 */
import { Link } from 'react-router';
import { useShow } from '../../data/ShowContext';
import { useCrawlers } from '../../data/CrawlersContext';
import { ctaFor, firstEpisode, newestEpisode } from '../gate';
import { useNow } from '../useNow';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { trackCta, trackOutbound } from '../analytics';
import { youtubeThumb } from '../media';
import { EpisodeRow } from '../components/EpisodeRow';
import { GatedCta } from '../components/GatedCta';
import { RosterCard } from '../components/RosterCard';
import { SiteFooter } from '../components/SiteFooter';
import { SocialRow } from '../components/SocialRow';
import { SystemBox } from '../components/SystemBox';
import { TrailerEmbed } from '../components/TrailerEmbed';
import page from './page.module.css';
import styles from './HomePage.module.css';

export function HomePage() {
  const { show } = useShow();
  const { profiles, status } = useCrawlers();
  // A minute is enough for a countdown chip that never shows seconds.
  const now = useNow(60_000, Date.parse(status?.generatedAt ?? '') || Date.now());

  const newest = show === null ? null : newestEpisode(show);
  // The hero sends a stranger to the opener, not the newest episode (author, 2026-09-25).
  const opener = show === null ? null : firstEpisode(show);
  const trailerId = show?.trailerYoutubeId;
  const hasTrailer = trailerId !== undefined && trailerId !== '';
  const embedId = hasTrailer ? trailerId : (newest?.youtubeId ?? '');
  const primary = show !== null && opener !== null ? ctaFor(opener, now, show.links) : null;

  return (
    <div className={page.page}>
      <Seo
        title={siteCopy.defaultTitle}
        description={show?.pitch ?? siteCopy.defaultDescription}
        canonicalPath="/"
        ogImage={siteCopy.ogSiteImage}
        /* The hero poster is this page's LCP element on a phone (011 §7). */
        preloadImage={embedId === '' ? undefined : youtubeThumb(embedId)}
      />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
          <h1 className={styles.tagline}>{show?.tagline ?? siteCopy.defaultTitle}</h1>
          <p className={page.lead}>{show?.pitch ?? siteCopy.defaultDescription}</p>
          {show !== null && opener !== null ? (
            <div className={styles.ctas}>
              <GatedCta
                episode={opener}
                now={now}
                links={show.links}
                primary
                onTrack={(cta) => trackCta(cta, opener.id)}
              />
              {/*
               * The secondary is the other half of the same choice. Once the
               * feed is open that is YouTube; before it opens the feed is shut,
               * so the archive stands in rather than teasing a locked route
               * (011 §2.1).
               */}
              {primary?.kind === 'hub' ? (
                <a
                  className={styles.secondary}
                  href={
                    opener.youtubeId === ''
                      ? show.links.youtube
                      : `https://www.youtube.com/watch?v=${opener.youtubeId}`
                  }
                  target="_blank"
                  rel="noopener"
                  onClick={() => trackOutbound('youtube')}
                >
                  {siteCopy.watchOnYouTube}
                </a>
              ) : (
                <Link className={styles.secondary} to="/watch">
                  {siteCopy.browseEveryEpisode}
                </Link>
              )}
            </div>
          ) : null}
        </div>
        {embedId === '' ? null : (
          <div className={styles.heroMedia}>
            <TrailerEmbed youtubeId={embedId} title={show?.title ?? siteCopy.siteName} />
          </div>
        )}
      </section>

      {/*
       * With no trailer configured the hero already embeds the newest episode,
       * and this card would be the same video twice (011 §3.1).
       */}
      {hasTrailer && show !== null && newest !== null ? (
        <section className={page.section} aria-labelledby="latest">
          <h2 className={page.sectionTitle} id="latest">
            {siteCopy.latestEpisodeTitle}
          </h2>
          <EpisodeRow episode={newest} now={now} links={show.links} />
        </section>
      ) : null}

      <section className={page.section} aria-labelledby="roster">
        <div className={page.head}>
          <h2 className={page.sectionTitle} id="roster">
            {siteCopy.meetTheCrawlersTitle}
          </h2>
          <p className={page.lead}>{siteCopy.meetTheCrawlersLead}</p>
        </div>
        <ul className={page.roster}>
          {profiles.map((profile) => (
            <li key={profile.id}>
              <RosterCard
                profile={profile}
                status={status?.crawlers[profile.id]}
                variant="card"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.strips}>
        <SystemBox title={siteCopy.newcomerTitle}>
          <p>{siteCopy.newcomerBody}</p>
          {show === null ? null : (
            <p>
              <a
                href={show.links.youtube}
                target="_blank"
                rel="noopener"
                onClick={() => trackOutbound('youtube')}
              >
                {siteCopy.newcomerLink}
              </a>
            </p>
          )}
        </SystemBox>

        <div className={styles.discord}>
          <h2 className={page.sectionTitle}>{siteCopy.discordTitle}</h2>
          <p className={page.lead}>{siteCopy.discordBody}</p>
          {show === null ? null : (
            <>
              <p className={styles.cadence}>{show.cadence}</p>
              <SocialRow links={show.links} />
            </>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export default HomePage;
