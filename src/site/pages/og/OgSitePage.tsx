/**
 * `/_og/site` - the default share image (011 §3.1): the mark, the tagline and
 * the pitch. Used by every route that has no image of its own.
 */
import { useShow } from '../../../data/ShowContext';
import { asset } from '../../media';
import { siteCopy } from '../../copy';
import { OgFrame } from './OgFrame';
import styles from './og.module.css';

export function OgSitePage() {
  const { show } = useShow();
  if (show === null) return null;

  return (
    <OgFrame>
      <div className={styles.site}>
        <div className={styles.mark}>
          <img src={asset('/img/dcc-mark.svg')} alt="" width={40} height={40} loading="eager" />
          <span>{show.title}</span>
        </div>
        <h1 className={styles.siteTagline}>{show.tagline ?? siteCopy.defaultTitle}</h1>
        <p className={styles.sitePitch}>{show.pitch ?? siteCopy.defaultDescription}</p>
      </div>
    </OgFrame>
  );
}

export default OgSitePage;
