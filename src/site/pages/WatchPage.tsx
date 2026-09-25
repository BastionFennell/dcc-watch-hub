/**
 * `/watch` - the episode archive, grouped by floor (011 §3.2, R3).
 *
 * The descent reads downward, so the archive does too: Floor 1 first, and
 * inside it Episode 1 first, which is the order someone starting the show
 * wants. Anyone who is caught up wants the other end, so the page opens with a
 * "Jump to latest" control and closes with a way back up. A floor the show has
 * declared but not filled yet keeps its heading and says so, because an empty
 * heading is how a viewer learns the floor exists.
 */
import { useCallback, useRef } from 'react';
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

  /*
   * `episodesByFloor` already reads in show order - floors ascending, and any
   * episode filed under no floor trailing behind - which is the order the
   * archive wants. Only the inside of a floor is pinned here, so a hand-edited
   * `show.json` cannot put Episode 2 above Episode 1.
   */
  const groups =
    show === null
      ? []
      : episodesByFloor(show).map((group) => ({
          ...group,
          episodes: [...group.episodes].sort((a, b) => a.id - b.id),
        }));
  /*
   * The archive, said once more for a machine (011 §7). Built from the same
   * groups the page renders, so the order a reader sees is the order a search
   * engine is given.
   */
  const listed = groups.flatMap((group) => group.episodes);
  const latest = listed.at(-1);

  const latestRef = useRef<HTMLElement | null>(null);
  const jump = useCallback(() => {
    const row = latestRef.current;
    if (row === null) return;
    /*
     * Reduced motion means no journey: the page arrives at the bottom rather
     * than travelling there. `matchMedia` is guarded because this handler also
     * exists in jsdom and in the prerenderer's DOM-less render.
     */
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    // A keyboard user's next Tab should continue from the row, not the button.
    row.querySelector('a')?.focus({ preventScroll: true });
  }, []);

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
        <h1 className={page.pageTitle} id="top">
          {siteCopy.watchTitle}
        </h1>
        <p className={page.lead}>{siteCopy.watchLead}</p>
        {listed.length > 1 ? (
          <div className={styles.jumpRow}>
            <button type="button" className={styles.jump} onClick={jump}>
              {siteCopy.jumpToLatest}
            </button>
          </div>
        ) : null}
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
              {group.episodes.map((episode) => {
                const isLatest = episode.id === latest?.id;
                return (
                  <EpisodeRow
                    key={episode.id}
                    episode={episode}
                    now={now}
                    links={show?.links ?? { youtube: '', discord: '' }}
                    {...(isLatest
                      ? /* The row a deep link addresses: `/watch#ep-3`. */
                        { anchorId: `ep-${episode.id}`, latest: true, rowRef: latestRef }
                      : {})}
                  />
                );
              })}
            </div>
          )}
        </section>
      ))}

      {listed.length > 1 ? (
        <p className={styles.jumpRow}>
          <a className={styles.jump} href="#top">
            {siteCopy.backToTop}
          </a>
        </p>
      ) : null}

      <SiteFooter />
    </div>
  );
}

export default WatchPage;
