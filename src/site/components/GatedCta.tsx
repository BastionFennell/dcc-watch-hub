/**
 * The broadcast-delay button (011 §2.1). `ctaFor` decides; this renders the
 * decision, and the two kinds are different elements on purpose: the hub is an
 * in-app route, YouTube is somewhere else entirely.
 *
 * `now` is a prop rather than a clock read: the page owns the clock (`useNow`)
 * so a prerendered page and its first client render agree.
 */
import { Link } from 'react-router';
import type { EpisodeMeta, ShowLinks } from '../../data/types';
import type { Cta } from '../gate';
import { ctaFor } from '../gate';
import styles from './GatedCta.module.css';

export interface GatedCtaProps {
  episode: EpisodeMeta;
  now: number;
  links: ShowLinks;
  /** The filled button. One per surface; everything else is the outline. */
  primary?: boolean;
  /**
   * The crawler page's shape (011 R2): a full-width translucent brand tint that
   * sits in the hero grid rather than next to other buttons. Overrides
   * `primary`; nothing else on the front door uses it.
   */
  quiet?: boolean;
  /**
   * Overrides the gate's own wording. The gate still decides where the button
   * goes; a surface whose promise is "start here" says so on both sides of
   * `hubLiveAt` rather than renaming itself when the feed opens.
   */
  label?: string;
  /** Analytics, wired in Wave C: `hub_open` and `outbound` live here. */
  onTrack?: (cta: Cta) => void;
}

export function GatedCta({
  episode,
  now,
  links,
  primary = false,
  quiet = false,
  label,
  onTrack,
}: GatedCtaProps) {
  const gate = ctaFor(episode, now, links);
  const cta = label === undefined ? gate : { ...gate, label };
  const className = styles.cta;
  const variant = quiet ? 'quiet' : primary ? 'primary' : 'secondary';
  const handleClick = onTrack === undefined ? undefined : () => onTrack(cta);

  if (cta.kind === 'hub') {
    return (
      <Link className={className} data-variant={variant} data-kind="hub" to={cta.href} onClick={handleClick}>
        {cta.label}
      </Link>
    );
  }

  return (
    <a
      className={className}
      data-variant={variant}
      data-kind="youtube"
      href={cta.href}
      target="_blank"
      rel="noopener"
      onClick={handleClick}
    >
      {cta.label}
    </a>
  );
}

export default GatedCta;
