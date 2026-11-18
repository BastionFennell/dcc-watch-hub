/**
 * `/cast` - the five real people behind the show (014): the four players and
 * the voice of the System, one card each, in `cast.json` order.
 *
 * One column at every width, like `/community`: bios run from nothing to two
 * paragraphs, and a grid would only leave ragged holes between them. The
 * System box is not used here - nobody on this page is being announced.
 *
 * Each card is `/cast#<id>`. A cold load lands natively, because the cards are
 * in the prerendered HTML; a client-side arrival (the "Played by" credit on a
 * crawler page) needs the one effect below, because react-router does not
 * scroll to a hash and this page is a lazy chunk the hash got to first.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useCrawlers } from '../../data/CrawlersContext';
import { Seo } from '../seo';
import { siteCopy } from '../copy';
import { CastCard } from '../components/CastCard';
import { SiteFooter } from '../components/SiteFooter';
import page from './page.module.css';
import styles from './CastPage.module.css';

export function CastPage() {
  const { cast, castSeeded, profiles } = useCrawlers();
  const { hash, key } = useLocation();
  /*
   * The browser made the fragment jump itself only when this document *is*
   * the prerendered `/cast`: a seeded cast on the history entry the page was
   * loaded with (react-router keys that first entry `default`). A seeded cast
   * alone is not enough - it stays seeded for the whole visit, including a
   * client-side hop here from a prerendered crawler page, which is exactly the
   * arrival that needs the scroll.
   */
  const nativeJump = castSeeded && key === 'default';

  /*
   * The app has no scroll handling on route change, so this is the only thing
   * that moves the page. Two guards: after a native jump that held, a second
   * one would yank a reader who has started scrolling; and jsdom has no
   * `scrollIntoView` (the same guard as the Studio's event list). An unknown
   * hash does nothing.
   *
   * "That held" is measured, not assumed (T1423): the native jump happens
   * against the prerendered HTML before this page's chunk CSS has loaded, and
   * today the marketing pages' server markup is re-rendered on the client a
   * moment after load, which drops the reader back at the top. So a native
   * jump only counts when the card is sitting at its scroll margin.
   */
  useEffect(() => {
    if (hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target === null || typeof target.scrollIntoView !== 'function') return;
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const landed = Math.abs(target.getBoundingClientRect().top - margin) < 2;
    if (nativeJump && landed) return;
    target.scrollIntoView();
  }, [hash, cast.length, nativeJump]);

  return (
    <div className={`${page.page} ${styles.page}`}>
      <Seo
        title={siteCopy.pageTitle(siteCopy.navCast)}
        description={siteCopy.castDescription}
        canonicalPath="/cast"
        ogImage={siteCopy.ogSiteImage}
      />

      <div className={styles.column}>
        <div className={page.head}>
          <p className={page.eyebrow}>{siteCopy.heroEyebrow}</p>
          <h1 className={page.pageTitle}>{siteCopy.castTitle}</h1>
          <p className={`${page.lead} ${styles.lead}`}>{siteCopy.castLead}</p>
        </div>

        {cast.length === 0 ? null : (
          <div className={styles.cards}>
            {cast.map((member, index) => (
              <CastCard
                key={member.id}
                member={member}
                profile={
                  member.crawlerId === undefined
                    ? undefined
                    : profiles.find((profile) => profile.id === member.crawlerId)
                }
                eager={index === 0}
              />
            ))}
          </div>
        )}

        <SiteFooter />
      </div>
    </div>
  );
}

export default CastPage;
