/**
 * `/crawlers/:id` - one crawler, and the player behind them (011 §3.4, R2).
 *
 * Revision 2's two rules shape the whole page. **Empty renders nothing**: a
 * section whose data the author has not written yet prints no heading, no
 * placeholder and certainly no "coming soon", because one filled section beats
 * five empty ones. And **the hero keeps no secrets it should not**: no floor,
 * no level, no "ALIVE" pill - a stranger arriving from a search result learns
 * who this is, not how far they have got.
 *
 * The entry achievement is the page's one System-styled element: the only thing
 * here the System itself said.
 */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useShow } from '../../data/ShowContext';
import { useCrawlers } from '../../data/CrawlersContext';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { useNow } from '../useNow';
import { useAppearances } from '../useAppearances';
import { hubLive } from '../gate';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { trackCrawlerView, trackCta } from '../analytics';
import { asset, crawlerOgImage } from '../media';
import { EntryAchievement } from '../components/EntryAchievement';
import { GatedCta } from '../components/GatedCta';
import { SiteFooter } from '../components/SiteFooter';
import { SocialRow } from '../components/SocialRow';
import type { EpisodeMeta, ShowLinks } from '../../data/types';
import page from './page.module.css';
import styles from './CrawlerPage.module.css';

const NO_LINKS: ShowLinks = { youtube: '', discord: '' };

/** The page's one CTA points at the start of the show, not the newest episode. */
function firstEpisode(episodes: EpisodeMeta[]): EpisodeMeta | undefined {
  let first: EpisodeMeta | undefined;
  for (const episode of episodes) if (first === undefined || episode.id < first.id) first = episode;
  return first;
}

export function CrawlerPage() {
  const { id = '' } = useParams();
  const { show } = useShow();
  const { profiles, status, loading } = useCrawlers();
  const now = useNow(60_000, Date.parse(status?.generatedAt ?? '') || Date.now());
  const appearances = useAppearances(id);

  const index = profiles.findIndex((profile) => profile.id === id);
  const profile = index === -1 ? undefined : profiles[index];

  /*
   * `crawler_view` (011 §7). After the roster has landed, so a page that
   * mounts before the fetch finishes counts once rather than never, and keyed
   * on the id so prev/next counts as a new view.
   */
  const found = profile !== undefined;
  useEffect(() => {
    if (found) trackCrawlerView(id);
  }, [found, id]);

  // While the roster is still in flight there is nothing to say yet; only a
  // loaded roster that has no such crawler is a 404.
  if (profile === undefined) return loading ? <div className={page.page} /> : <NotFoundPage />;

  const prev = index > 0 ? profiles[index - 1] : undefined;
  const next = index < profiles.length - 1 ? profiles[index + 1] : undefined;
  const achievement = profile.entryAchievement;
  const { player } = profile;
  const links = show?.links ?? NO_LINKS;
  const opener = show === null ? undefined : firstEpisode(show.episodes);
  // "Only for published episodes" (011 R2): the gate decides, as everywhere.
  const published = appearances.filter((episode) => hubLive(episode, now));
  const detail = [player.pronouns, player.bio].filter((part) => part !== undefined).join(' · ');

  return (
    <div className={`${page.page} ${styles.page}`}>
      <Seo
        title={siteCopy.pageTitle(profile.characterName)}
        description={siteCopy.crawlerDescription(
          profile.characterName,
          profile.concept,
          profile.name,
        )}
        canonicalPath={`/crawlers/${profile.id}`}
        ogImage={crawlerOgImage(profile)}
        ogType="profile"
      />

      <article className={styles.hero}>
        <img
          className={styles.portrait}
          src={asset(profile.art.full ?? profile.art.bust)}
          alt={profile.characterName}
          /* Above the fold on its own page, so it is never deferred (T1124). */
          loading="eager"
        />

        {/* Its own grid child rather than a button inside the text: the CTA
            wants the portrait's width, and the 1fr row under it is what holds
            the 16 px gap open however tall the text column grows. */}
        {opener === undefined ? null : (
          <div className={styles.ctaCell}>
            <GatedCta
              episode={opener}
              now={now}
              links={links}
              quiet
              label={siteCopy.startAtEpisodeOne}
              onTrack={(cta) => trackCta(cta, opener.id)}
            />
          </div>
        )}

        <div className={styles.text}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>{profile.name}</p>
            <h1 className={styles.name}>{profile.characterName}</h1>
            <p className={styles.handleRow}>
              <span className={styles.handle}>{profile.handle}</span>
              {/* "Alive" is the default and says nothing worth a pill; the ones
                  that are not are the news (011 R2). */}
              {profile.status === 'alive' ? null : (
                <span className={styles.statusPill} data-status={profile.status}>
                  {siteCopy.statusLabel[profile.status]}
                </span>
              )}
            </p>
          </div>

          <div className={styles.credit}>
            <p className={styles.creditLine}>
              <span className={styles.creditPrefix}>{siteCopy.playedBy} </span>
              <span className={styles.playerName}>{player.name}</span>
            </p>
            {detail === '' ? null : <p className={styles.creditDetail}>{detail}</p>}
            {player.links === undefined ? null : (
              <SocialRow links={{ ...NO_LINKS, ...player.links }} />
            )}
          </div>

          {profile.concept === '' ? null : <p className={styles.concept}>{profile.concept}</p>}

          {profile.pockets.length === 0 ? null : (
            <section className={styles.block} aria-labelledby="pockets">
              <h2 className={styles.label} id="pockets">
                {siteCopy.pocketsTitle}
              </h2>
              <ul className={styles.pockets}>
                {profile.pockets.map((item) => (
                  <li key={item} className={styles.pocket}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {achievement === undefined ? null : (
            <section className={styles.block} aria-labelledby="achievement">
              <h2 className={styles.label} id="achievement">
                {siteCopy.entryAchievementTitle}
              </h2>
              <EntryAchievement achievement={achievement} />
            </section>
          )}

          {/*
           * Precomputed by the build where there is one, derived after mount
           * where there is not - so the list is empty on the first render of a
           * page that has to fetch for it, and hydration stays honest.
           */}
          {published.length === 0 ? null : (
            <section className={styles.block} aria-labelledby="appears">
              <h2 className={styles.label} id="appears">
                {siteCopy.appearsInTitle}
              </h2>
              <ul className={styles.appearances}>
                {published.map((episode) => (
                  <li key={episode.id}>
                    <Link className={styles.appearance} to={`/ep/${episode.id}`}>
                      {episode.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      <nav className={styles.prevNext} aria-label={siteCopy.crawlersTitle}>
        {prev === undefined ? (
          <span />
        ) : (
          <Link className={styles.prevNextLink} to={`/crawlers/${prev.id}`} rel="prev">
            <span className={styles.prevNextLabel}>{siteCopy.prevCrawler}</span>
            <span className={styles.prevNextName}>{`← ${prev.characterName}`}</span>
          </Link>
        )}
        {next === undefined ? (
          <span />
        ) : (
          <Link
            className={`${styles.prevNextLink} ${styles.next}`}
            to={`/crawlers/${next.id}`}
            rel="next"
          >
            <span className={styles.prevNextLabel}>{siteCopy.nextCrawler}</span>
            <span className={styles.prevNextName}>{`${next.characterName} →`}</span>
          </Link>
        )}
      </nav>

      <SiteFooter />
    </div>
  );
}

export default CrawlerPage;
