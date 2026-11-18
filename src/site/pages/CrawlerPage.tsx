/**
 * `/crawlers/:id` - one crawler, and the player behind them (011 §3.4, R2).
 * Since 014 the player is only named here, with a face and a link: who they
 * are lives on their `/cast` card.
 *
 * Revision 2's two rules shape the whole page. **Empty renders nothing**: a
 * section whose data the author has not written yet prints no heading, no
 * placeholder and certainly no "coming soon", because one filled section beats
 * five empty ones. And **the hero keeps no secrets it should not**: no floor,
 * no level, no "ALIVE" pill - a stranger arriving from a search result learns
 * who this is, not how far they have got.
 *
 * The entry achievement is the page's one System-styled element: the only thing
 * here the System itself said, and it wears no section label because its own
 * "Achievement unlocked" kicker is already the heading.
 */
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useShow } from '../../data/ShowContext';
import { useCrawlers } from '../../data/CrawlersContext';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { useNow } from '../useNow';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { trackCrawlerView, trackCta } from '../analytics';
import { asset, crawlerOgImage } from '../media';
import { Dossier } from '../components/Dossier/Dossier';
import { EntryAchievement } from '../components/EntryAchievement';
import { GatedCta } from '../components/GatedCta';
import { SiteFooter } from '../components/SiteFooter';
import type { ShowLinks } from '../../data/types';
import { firstEpisode } from '../gate';
import { castAnchor, playerOf } from '../cast';
import page from './page.module.css';
import backdrop from '../backdrop.module.css';
import { backdropStyle } from '../backdrop';
import styles from './CrawlerPage.module.css';

const NO_LINKS: ShowLinks = { youtube: '', discord: '' };

/** The page's one CTA points at the start of the show, not the newest episode. */
export function CrawlerPage() {
  const { id = '' } = useParams();
  const { show } = useShow();
  const { profiles, status, loading, dossierFor, cast } = useCrawlers();
  const now = useNow(60_000, Date.parse(status?.generatedAt ?? '') || Date.now());

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
  // 014: `cast.json` names the crawler, not the other way round. Nobody
  // claiming this one (no cast file yet) costs the credit, not the page.
  const player = playerOf(cast, profile.id);
  const links = show?.links ?? NO_LINKS;
  const opener = show === null ? undefined : (firstEpisode(show) ?? undefined);

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
          className={`${styles.portrait} ${backdrop.backdrop}`}
          style={backdropStyle(profile)}
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
              primary
              label={siteCopy.startAtEpisodeOne}
              onTrack={(cta) => trackCta(cta, opener.id)}
            />
          </div>
        )}

        <div className={styles.text}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>{profile.name}</p>
            <h1 className={styles.name}>{profile.characterName}</h1>
            {/* No status pill (012). The hero says who this is; whether they
                are still alive is a question the dossier answers, and only
                inside a card the reader opened on purpose. */}
            <p className={styles.handleRow}>
              <span className={styles.handle}>{profile.handle}</span>
            </p>
          </div>

          {/*
           * 014: a face and a name, and the name leads to the card. The photo
           * is `alt=""` because the name is right beside it, and eager because
           * the credit is above the fold.
           */}
          {player === undefined ? null : (
            <div className={styles.credit}>
              <img
                className={styles.creditPhoto}
                src={asset(player.photo.credit)}
                alt=""
                width={40}
                height={40}
                loading="eager"
              />
              <p className={styles.creditLine}>
                <span className={styles.creditPrefix}>{siteCopy.playedBy} </span>
                <Link className={styles.playerName} to={castAnchor(player.id)}>
                  {player.name}
                </Link>
              </p>
            </div>
          )}

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

          {/*
           * No section label above it: the box's own "Achievement unlocked"
           * kicker is the heading, and a mono caps label over a System panel
           * only said the same thing twice. The text column's gap gives it its
           * air, whether it follows the pockets, the concept or the credit.
           */}
          {achievement === undefined ? null : <EntryAchievement achievement={achievement} />}
        </div>
      </article>

      {/*
       * The dossier (012): full width of the page measure, under the hero grid
       * and above the bar that walks the roster. `dossierFor` answers `null`
       * until the file is here - on a prerendered page it is here already, so
       * the locked rows are in the server's HTML and the row count never
       * changes under the reader.
       */}
      <Dossier profile={profile} dossier={dossierFor(profile.id)} />

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
