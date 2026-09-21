/**
 * The draft's own marker strip (010, T1022, FR-1006).
 *
 * It echoes the viewer's `EventTimeline` - a hairline track, an elapsed fill, a
 * playhead tick, small rounded markers - but it answers to the draft rather
 * than to a published episode, so every event has a mark from the moment it is
 * saved, coloured by its group and labelled with the sentence the feed will
 * say.
 *
 * Seeking is a real `<input type="range">` under the markers rather than a
 * click handler on a div: the keyboard gets arrows, Home and End for free, and
 * a screen reader gets a control it recognizes (FR-1013). The markers sit above
 * it as ordinary buttons, so clicking one selects its event instead of seeking
 * to wherever the pointer landed.
 */
import type { FieldGroup } from '../eventForms';
import { GROUP_LABELS } from '../eventForms';
import { GROUP_COLORS, groupOf } from '../groups';
import type { DraftEvent, StudioDraft } from '../draft';
import type { FeedLineContext } from '../feedLine';
import { feedSentence } from '../feedLine';
import { studioCopy } from '../copy';
import { formatTimecode } from '../timecode';
import styles from './StudioTimeline.module.css';

export interface StudioTimelineProps {
  draft: StudioDraft;
  /** The feed context the page already built; markers read their own sentence. */
  feed: FeedLineContext;
  t: number;
  selectedUid?: string;
  onSeek(t: number): void;
  onSelect(uid: string): void;
}

export function StudioTimeline({
  draft,
  feed,
  t,
  selectedUid,
  onSeek,
  onSelect,
}: StudioTimelineProps) {
  const span = draft.meta.durationSec > 0 ? draft.meta.durationSec : 1;
  const progress = Math.min(1, Math.max(0, t / span));

  function markerFor(entry: DraftEvent) {
    const group = groupOf(entry.event.type);
    const pos = Math.min(1, Math.max(0, entry.event.t / span));
    const label = studioCopy.timeline.markerLabel(
      formatTimecode(entry.event.t),
      feedSentence(entry.event, feed),
    );
    return { group, pos, label };
  }

  return (
    <div className={styles.wrap} role="group" aria-label={studioCopy.timeline.label}>
      <div className={styles.strip} data-testid="studio-timeline">
        <div className={styles.track} aria-hidden="true" />
        <div
          className={styles.fill}
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
          data-testid="studio-timeline-fill"
        />
        <input
          className={styles.scrub}
          type="range"
          min={0}
          max={Math.round(span)}
          step={1}
          value={Math.round(Math.min(t, span))}
          aria-label={studioCopy.timeline.scrub}
          aria-valuetext={formatTimecode(t)}
          data-testid="studio-scrub"
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div
          className={styles.playhead}
          style={{ left: `${progress * 100}%` }}
          aria-hidden="true"
          data-testid="studio-playhead"
        />
        <ul className={styles.markers}>
          {draft.events.map((entry) => {
            const { group, pos, label } = markerFor(entry);
            return (
              <li key={entry.uid} className={styles.markerItem}>
                <button
                  type="button"
                  className={styles.marker}
                  style={{ left: `${pos * 100}%`, background: GROUP_COLORS[group] }}
                  data-testid="studio-marker"
                  data-group={group}
                  data-selected={entry.uid === selectedUid ? 'true' : undefined}
                  aria-label={label}
                  aria-current={entry.uid === selectedUid ? 'true' : undefined}
                  onClick={() => {
                    onSeek(entry.event.t);
                    onSelect(entry.uid);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <ul className={styles.legend} data-testid="studio-legend">
        {(Object.keys(GROUP_COLORS) as FieldGroup[]).map((group) => (
          <li key={group} className={styles.legendItem}>
            <span
              className={styles.swatch}
              style={{ background: GROUP_COLORS[group] }}
              aria-hidden="true"
            />
            {GROUP_LABELS[group]}
          </li>
        ))}
        {draft.events.length === 0 ? (
          <li className={styles.legendEmpty}>{studioCopy.timeline.empty}</li>
        ) : null}
      </ul>
    </div>
  );
}

export default StudioTimeline;
