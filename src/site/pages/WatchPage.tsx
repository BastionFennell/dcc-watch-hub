/**
 * `/watch` - the episode archive, grouped by floor (011 §3.2).
 *
 * The descent reads downward, so the archive reads upward: the deepest floor
 * first, and inside it the newest episode first. A floor the show has declared
 * but not filled yet keeps its heading and says so, because an empty heading is
 * how a viewer learns the floor exists.
 */
import { useShow } from '../../data/ShowContext';
import { useCrawlers } from '../../data/CrawlersContext';
import { episodesByFloor } from '../../data/show';
import { useNow } from '../useNow';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { episodeListJsonLd } from '../jsonLd';
import { EpisodeRow } from '../components/EpisodeRow';
import { SiteFooter } from '../components/SiteFooter';
import page from './page.module.css';
import styles from './WatchPage.module.css';

export function WatchPage() {
  const { show } = useShow();
  const { status } = useCrawlers();
  const now = useNow(60_000, Date.parse(status?.generatedAt ?? '') || Date.now());

  // `episodesByFloor` reads in show order; the archive reads the other way.
  const groups = show === null ? [] : [...episodesByFloor(show)].reverse();
  /*
   * The archive, said once more for a machine (011 §7). Built from the same
   * groups the page renders, so the order a reader sees is the order a search
   * engine is given.
   */
  const listed = groups.flatMap((group) => [...group.episodes].reverse());

  return (
    <div className={page.page}>
      <Seo
        title={siteCopy.pageTitle(siteCopy.watchTitle)}
        description={siteCopy.watchDescription}
        canonicalPath="/watch"
        ogImage={siteCopy.ogSiteImage}
        jsonLd={listed.length === 0 ? undefined : episodeListJsonLd(listed)}
      />

      <div className={page.head}>
        <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
        <h1 className={page.pageTitle}>{siteCopy.watchTitle}</h1>
        <p className={page.lead}>{siteCopy.watchLead}</p>
      </div>

      {groups.map((group) => (
        <section
          className={page.section}
          key={`${group.season}-${group.floor}`}
          aria-labelledby={`floor-${group.season}-${group.floor}`}
        >
          <h2 className={styles.floor} id={`floor-${group.season}-${group.floor}`}>
            {group.label}
          </h2>
          {group.episodes.length === 0 ? (
            <p className={styles.empty}>{siteCopy.emptyFloor(group.floor)}</p>
          ) : (
            <div className={page.stack}>
              {[...group.episodes].reverse().map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  now={now}
                  links={show?.links ?? { youtube: '', discord: '' }}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <SiteFooter />
    </div>
  );
}

export default WatchPage;
