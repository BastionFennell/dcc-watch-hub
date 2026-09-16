import { Link } from 'react-router';
import type { EpisodeMeta, Show } from '../../data/types';
import { prevNext, seasonOf } from '../../data/show';
import { useScrolled } from '../../hooks/useScrolled';
import { useEpisodePath } from '../../hooks/useEpisodePath';
import { IconBroadcast, IconChevronLeft, IconChevronRight } from '../icons';
import { EpisodesMenu } from './EpisodesMenu';
import { copy } from '../../copy';
import styles from './SiteHeader.module.css';

export interface SiteHeaderProps {
  /** Null while the archive is still loading or failed to load. */
  show: Show | null;
  /** The episode whose page is open, if any. */
  current?: EpisodeMeta;
}

function ShowLinks({ show, className }: { show: Show; className: string }) {
  return (
    <div className={className}>
      <a className={styles.link} href={show.links.youtube} target="_blank" rel="noopener noreferrer">
        {copy.youtube}
      </a>
      <a className={styles.link} href={show.links.discord} target="_blank" rel="noopener noreferrer">
        {copy.discord}
      </a>
    </div>
  );
}

/**
 * The persistent broadcast chrome (FR-050..FR-052): slim, dark, sticky, and
 * shrinking once the page scrolls so the stage stays dominant.
 */
export function SiteHeader({ show, current }: SiteHeaderProps) {
  const episodePath = useEpisodePath();
  const scrolled = useScrolled();
  const { prev, next } = show && current ? prevNext(show, current.id) : {};
  const season = show && current ? seasonOf(show, current.id) : 1;

  return (
    <header className={styles.header} data-scrolled={scrolled ? '' : undefined}>
      <Link to="/" className={styles.brand}>
        <img
          className={styles.mark}
          src={`${import.meta.env.BASE_URL}img/dcc-mark.svg`}
          alt=""
          width={22}
          height={22}
        />
        <span className={styles.title}>{copy.siteTitle}</span>
        <span className={styles.pill}>
          <IconBroadcast />
          {copy.systemFeedPill}
        </span>
      </Link>

      <div className={styles.center}>
        {current ? (
          <>
            {prev ? (
              <Link to={episodePath(prev.id)} className={styles.arrow} aria-label={copy.prevEpisode}>
                <IconChevronLeft />
              </Link>
            ) : null}
            <span className={styles.episodeLabel}>
              {copy.episodeLabel(season, current.floor, current.id)}
            </span>
            {next ? (
              <Link to={episodePath(next.id)} className={styles.arrow} aria-label={copy.nextEpisode}>
                <IconChevronRight />
              </Link>
            ) : null}
          </>
        ) : null}
      </div>

      <nav className={styles.right} aria-label={copy.episodes}>
        {show ? (
          <>
            <EpisodesMenu show={show} currentId={current?.id}>
              {/*
                The glossary rides in the phone menu beside the show links, for
                the same reason they do: the header has no room for it (FR-052).
              */}
              {show.registryUrl ? (
                <Link to="/registry" className={styles.menuRegistry}>
                  {copy.registry}
                </Link>
              ) : null}
              <ShowLinks show={show} className={styles.menuLinks} />
            </EpisodesMenu>
            {/* Only a show that publishes a registry links to one (FR-600). */}
            {show.registryUrl ? (
              <Link to="/registry" className={styles.registryLink}>
                {copy.registry}
              </Link>
            ) : null}
            <ShowLinks show={show} className={styles.links} />
          </>
        ) : null}
      </nav>
    </header>
  );
}

export default SiteHeader;
