import type { CSSProperties } from 'react';
import type { CrawlerProfile } from '../data/types';

/**
 * The crawler's own colour, handed to `backdrop.module.css` as a custom
 * property. Undefined when the roster gives none, and the stylesheet falls
 * back to the brand's deep violet.
 */
export function backdropStyle(profile: CrawlerProfile): CSSProperties | undefined {
  return profile.backdrop === undefined
    ? undefined
    : ({ '--backdrop': profile.backdrop } as CSSProperties);
}
