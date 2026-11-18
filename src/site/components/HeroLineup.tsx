/**
 * The home hero's group shot: every crawler's full figure standing on one
 * floor, each a link to their page.
 *
 * There is no painted group image, so the group is composed here from the
 * individual figures (`art.lineup`, trimmed to the figure). A crawler without
 * one is left out, and with none at all the hero is words only.
 */
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { CrawlerProfile } from '../../data/types';
import { asset } from '../media';
import styles from './HeroLineup.module.css';

/*
 * Art direction, not data: where each figure stands and how tall they read
 * beside the others, taken from the artist's own colour lineup. `x` and
 * `height` are fractions of the stage; `ratio` is the trimmed image's
 * width / height, so the box is reserved before the image arrives.
 */
const PLACEMENT: Record<string, { x: number; height: number; ratio: number; z: number }> = {
  ronald: { x: 0, height: 0.98, ratio: 418 / 760, z: 1 },
  veil: { x: 0.285, height: 0.84, ratio: 403 / 760, z: 2 },
  mimi: { x: 0.505, height: 0.95, ratio: 300 / 760, z: 3 },
  xo: { x: 0.69, height: 0.9, ratio: 403 / 760, z: 2 },
};

export function HeroLineup({ profiles }: { profiles: readonly CrawlerProfile[] }) {
  const standing = profiles.filter(
    (profile) => profile.art.lineup !== undefined && PLACEMENT[profile.id] !== undefined,
  );
  if (standing.length === 0) return null;

  return (
    <div className={styles.stage} data-testid="hero-lineup">
      {standing.map((profile) => {
        const place = PLACEMENT[profile.id]!;
        const style = {
          '--x': `${place.x * 100}%`,
          '--h': `${place.height * 100}%`,
          '--ratio': `${place.ratio}`,
          zIndex: place.z,
        } as CSSProperties;
        return (
          <Link
            key={profile.id}
            className={styles.figure}
            style={style}
            to={`/crawlers/${profile.id}`}
          >
            <img
              className={styles.art}
              src={asset(profile.art.lineup!)}
              alt={profile.characterName}
              loading="eager"
              decoding="async"
            />
          </Link>
        );
      })}
    </div>
  );
}
