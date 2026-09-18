import type { MouseEvent } from 'react';
import type { Marker, MarkerKind } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import styles from './EventTimeline.module.css';

export interface EventTimelineProps {
  /** `timelineMarkers(events, durationSec, party)` - already positioned 0..1. */
  markers: Marker[];
  /** The playhead, for the elapsed fill (FR-042) and label reveal. */
  t: number;
  durationSec: number;
  /** Clicking a marker - or anywhere on the strip - seeks playback (FR-041). */
  onSeek: (t: number) => void;
}

/** The legend's reading order: the story spine first, then the punctuation. */
const LEGEND_KINDS: MarkerKind[] = ['story', 'boss', 'loot', 'achievement', 'levelup'];

/**
 * A marker names itself only once the playhead has reached it. Before that the
 * tooltip gives away nothing but the kind (already visible as the colour) and
 * the time - a future boss chapter must not spoil its own name (constitution I).
 */
function labelFor(marker: Marker, t: number): string {
  if (marker.t <= t) return marker.label;
  return copy.markerUpcoming(copy.markerKinds[marker.kind], formatTime(marker.t));
}

/** Keeps a tooltip at either end of the strip inside the page (review 1.1). */
function anchorFor(pos: number): 'start' | 'center' | 'end' {
  if (pos < 0.12) return 'start';
  if (pos > 0.88) return 'end';
  return 'center';
}

/**
 * The marker bar under the stage (US3): a 3 px hairline track with a brand fill
 * up to the playhead, a distinct playhead tick, and one focusable button per
 * chapter, achievement, and level-up. The whole strip is a scrub target: a click
 * anywhere seeks to that fraction of the episode. It holds no state - the fill,
 * the playhead, the markers, and their labels are functions of `t` and the log.
 *
 * Each marker carries its own tooltip rather than a native `title` (review 1.1,
 * T341): the native one waits a second, never appears on touch, and cannot be
 * styled. A legend under the strip says what the colours mean.
 */
export function EventTimeline({ markers, t, durationSec, onSeek }: EventTimelineProps) {
  const span = durationSec > 0 ? durationSec : 1;
  const progress = Math.min(1, Math.max(0, t / span));

  const seekToPointer = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(Math.round(fraction * span));
  };

  return (
    <div className={styles.wrap} role="group" aria-label={copy.timelineScrubHint}>
      <div className={styles.timeline} data-testid="event-timeline" onClick={seekToPointer}>
        <div className={styles.track} aria-hidden="true" />
        <div
          className={styles.fill}
          style={{ width: `${progress * 100}%` }}
          data-testid="timeline-fill"
          aria-hidden="true"
        />
        {/* Where the broadcast actually is, told apart from how far it has come. */}
        <div
          className={styles.playhead}
          style={{ left: `${progress * 100}%` }}
          data-testid="timeline-playhead"
          aria-hidden="true"
        />
        <ul className={styles.markers} aria-label={copy.timelineLabel}>
          {markers.map((marker) => {
            const label = labelFor(marker, t);
            return (
              <li key={marker.id} className={styles.markerItem}>
                <button
                  type="button"
                  className={styles.marker}
                  style={{ left: `${marker.pos * 100}%`, background: marker.color }}
                  data-testid="timeline-marker"
                  data-kind={marker.kind}
                  data-elapsed={marker.t <= t ? 'true' : undefined}
                  aria-label={label}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeek(marker.t);
                  }}
                />
                <span
                  className={styles.tooltip}
                  role="tooltip"
                  data-testid="timeline-tooltip"
                  data-anchor={anchorFor(marker.pos)}
                  style={{ left: `${marker.pos * 100}%` }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className={styles.legend} data-testid="timeline-legend">
        {LEGEND_KINDS.map((kind) => (
          <li key={kind} className={styles.legendItem} data-kind={kind}>
            <span
              className={styles.legendSwatch}
              style={{ background: `var(--marker-${kind})` }}
              aria-hidden="true"
            />
            {copy.markerKinds[kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EventTimeline;
