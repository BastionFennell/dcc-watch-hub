import type { Marker } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './EventTimeline.module.css';

export interface EventTimelineProps {
  /** `timelineMarkers(events, durationSec, party)` — already positioned 0..1. */
  markers: Marker[];
  /** The playhead, for the elapsed fill (FR-042). */
  t: number;
  durationSec: number;
  /** Clicking a marker seeks playback to its time (FR-041). */
  onSeek: (t: number) => void;
}

/**
 * The marker bar under the stage (US3): a 3 px hairline track with a brand fill
 * up to the playhead and one focusable button per chapter, achievement, and
 * level-up. It holds no state — the fill and the markers are functions of `t`
 * and the event log.
 */
export function EventTimeline({ markers, t, durationSec, onSeek }: EventTimelineProps) {
  const span = durationSec > 0 ? durationSec : 1;
  const progress = Math.min(1, Math.max(0, t / span));

  return (
    <div className={styles.timeline} data-testid="event-timeline">
      <div className={styles.track} aria-hidden="true" />
      <div
        className={styles.fill}
        style={{ width: `${progress * 100}%` }}
        data-testid="timeline-fill"
        aria-hidden="true"
      />
      <ul className={styles.markers} aria-label={copy.timelineLabel}>
        {markers.map((marker) => (
          <li key={marker.id} className={styles.markerItem}>
            <button
              type="button"
              className={styles.marker}
              style={{ left: `${marker.pos * 100}%`, background: marker.color }}
              data-testid="timeline-marker"
              data-kind={marker.kind}
              title={marker.label}
              aria-label={marker.label}
              onClick={() => onSeek(marker.t)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EventTimeline;
