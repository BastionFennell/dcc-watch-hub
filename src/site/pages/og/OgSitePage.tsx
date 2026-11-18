/**
 * `/_og/site` - the default share image (011 §3.1), in the front door's own
 * look: the gold label, the tagline set in rows, the crawlers standing
 * together, and the mark. Used by every route that has no image of its own.
 *
 * No pitch: every platform prints the page's description beside the picture,
 * and two sentences of it at a size a thumbnail can hold would crowd out the
 * headline.
 */
import { useShow } from '../../../data/ShowContext';
import { useCrawlers } from '../../../data/CrawlersContext';
import { asset } from '../../media';
import { siteCopy } from '../../copy';
import { taglineRows } from '../../tagline';
import { HeroLineup } from '../../components/HeroLineup';
import { OgFrame } from './OgFrame';
import styles from './og.module.css';

export function OgSitePage() {
  const { show } = useShow();
  const { profiles } = useCrawlers();
  if (show === null) return null;

  return (
    <OgFrame>
      <div className={styles.site}>
        <div className={styles.siteText}>
          <p className={styles.siteLabel}>{siteCopy.heroEyebrow}</p>
          <h1 className={styles.siteTagline}>
            {taglineRows(show.tagline ?? siteCopy.defaultTitle).map((row, index) => (
              <span key={index} className={styles.siteTaglineRow}>
                {row}{' '}
              </span>
            ))}
          </h1>
          <div className={styles.mark}>
            <img src={asset('/img/dcc-mark.svg')} alt="" width={40} height={40} loading="eager" />
            <span>{show.title}</span>
          </div>
        </div>
        <div className={styles.siteLineup}>
          <HeroLineup profiles={profiles} />
        </div>
      </div>
    </OgFrame>
  );
}

export default OgSitePage;
