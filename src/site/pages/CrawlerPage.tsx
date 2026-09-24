/**
 * `/crawlers/:id` - one crawler, and the player behind them (011 §3.4).
 *
 * The entry achievement is the centrepiece and the only System box on the page:
 * it is the one thing here the System itself announced. Everything else is the
 * show talking about its own cast.
 */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useShow } from '../../data/ShowContext';
import { useCrawlers } from '../../data/CrawlersContext';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { useNow } from '../useNow';
import { useAppearances } from '../useAppearances';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { trackCrawlerView } from '../analytics';
import { asset, crawlerOgImage } from '../media';
import { EpisodeRow } from '../components/EpisodeRow';
import { RosterCard } from '../components/RosterCard';
import { SiteFooter } from '../components/SiteFooter';
import { SocialRow } from '../components/SocialRow';
import { SystemBox } from '../components/SystemBox';
import type { ShowLinks } from '../../data/types';
import page from './page.module.css';
import styles from './CrawlerPage.module.css';

const NO_LINKS: ShowLinks = { youtube: '', discord: '' };

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
  const live = status?.crawlers[profile.id];
  const achievement = profile.entryAchievement;
  const playerLinks = profile.player.links;

  return (
    <div className={page.page}>
      <Seo
        title={siteCopy.pageTitle(profile.characterName)}
        description={siteCopy.crawlerDescription(profile.characterName, profile.concept)}
        canonicalPath={`/crawlers/${profile.id}`}
        ogImage={crawlerOgImage(profile)}
        ogType="profile"
      />

      <RosterCard profile={profile} status={live} variant="hero" />

      <section className={page.section} aria-labelledby="concept">
        <h2 className={page.sectionTitle} id="concept">
          {siteCopy.conceptTitle}
        </h2>
        <p className={page.lead}>{profile.concept}</p>
      </section>

      {profile.pockets.length === 0 ? null : (
        <section className={page.section} aria-labelledby="pockets">
          <h2 className={page.sectionTitle} id="pockets">
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
        <section className={page.section} aria-labelledby="achievement">
          <h2 className={page.sectionTitle} id="achievement">
            {siteCopy.entryAchievementTitle}
          </h2>
          <SystemBox
            title={achievement.title}
            footer={
              achievement.box === undefined || achievement.item === undefined
                ? undefined
                : siteCopy.reward(achievement.box, achievement.item)
            }
          >
            <p>{achievement.text}</p>
          </SystemBox>
        </section>
      )}

      <section className={page.section} aria-labelledby="player">
        <h2 className={page.sectionTitle} id="player">
          {siteCopy.playerTitle}
        </h2>
        <div className={styles.player}>
          {profile.player.bust === undefined ? null : (
            <img
              className={styles.playerBust}
              src={asset(profile.player.bust)}
              alt={profile.player.name}
              loading="lazy"
            />
          )}
          <div className={styles.playerText}>
            <p className={styles.playerName}>
              {profile.player.name}
              {profile.player.pronouns === undefined ? null : (
                <span className={styles.pronouns}>{profile.player.pronouns}</span>
              )}
            </p>
            {profile.player.bio === undefined ? null : (
              <p className={page.lead}>{profile.player.bio}</p>
            )}
            {playerLinks === undefined ? null : (
              <SocialRow links={{ ...NO_LINKS, ...playerLinks }} />
            )}
          </div>
        </div>
      </section>

      {/*
       * Derived on the client (see `useAppearances`), so this section is empty
       * on the server and fills in after mount rather than risking a mismatch.
       */}
      {appearances.length === 0 ? null : (
        <section className={page.section} aria-labelledby="appears">
          <h2 className={page.sectionTitle} id="appears">
            {siteCopy.appearsInTitle}
          </h2>
          <div className={page.stack}>
            {appearances.map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                now={now}
                links={show?.links ?? NO_LINKS}
              />
            ))}
          </div>
        </section>
      )}

      <nav className={styles.prevNext} aria-label={siteCopy.crawlersTitle}>
        {prev === undefined ? (
          <span />
        ) : (
          <Link className={styles.prevNextLink} to={`/crawlers/${prev.id}`} rel="prev">
            <span className={styles.prevNextLabel}>{siteCopy.prevCrawler}</span>
            <span>{prev.characterName}</span>
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
            <span>{next.characterName}</span>
          </Link>
        )}
      </nav>

      <SiteFooter />
    </div>
  );
}

export default CrawlerPage;
