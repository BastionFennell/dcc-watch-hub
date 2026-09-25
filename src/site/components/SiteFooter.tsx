/**
 * The front door's footer (011 §3.1): the same three links as the header, the
 * disclaimer the show is required to carry, and a copyright line with no year
 * in it - a year read from the clock would differ between the prerendered HTML
 * and the first client render, and this is not worth a hydration mismatch.
 */
import { Link } from 'react-router';
import { siteCopy } from '../copy';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.nav} aria-label={siteCopy.footerNavLabel}>
        <Link className={styles.link} to="/watch">
          {siteCopy.navWatch}
        </Link>
        <Link className={styles.link} to="/crawlers">
          {siteCopy.navCrawlers}
        </Link>
        <Link className={styles.link} to="/community">
          {siteCopy.navCommunity}
        </Link>
      </nav>
      <p className={styles.line}>{siteCopy.footerDisclaimer}</p>
      <p className={styles.line}>{siteCopy.footerRights}</p>
    </footer>
  );
}

export default SiteFooter;
