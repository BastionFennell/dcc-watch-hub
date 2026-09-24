/**
 * The bar under the stage (010, T1022, FR-1001).
 *
 * Play/pause, four nudges, the speed, the big mono timecode, and the one
 * primary action the whole tool is about: "Add event at m:ss". Every button
 * names its hotkey in its accessible label, so the keyboard shortcuts are
 * discoverable without a legend.
 *
 * It holds no time of its own: `t` comes from the page's `usePlayhead` and
 * every control goes back out through `useTransport`.
 */
import type { TransportApi } from '../hooks/useTransport';
import { RATES } from '../hooks/useTransport';
import { studioCopy } from '../copy';
import { formatTimecode } from '../timecode';
import styles from './TransportBar.module.css';

export interface TransportBarProps {
  transport: TransportApi;
  /** The playhead, from the page. */
  t: number;
  /** The draft's duration; the player's own wins when it knows one. */
  durationSec: number;
  onAdd(): void;
  /**
   * The stage's focus shield, when there is one to talk about: an embedded
   * player takes the keyboard the moment it is clicked, so the Studio covers it
   * and offers this way out for the author who needs the host's own controls.
   * Absent (the dev stage, no stage at all) and the button is not rendered.
   */
  videoLock?: { locked: boolean; toggle(): void };
}

export function TransportBar({ transport, t, durationSec, onAdd, videoLock }: TransportBarProps) {
  const duration = transport.duration ?? (durationSec > 0 ? durationSec : null);
  const now = formatTimecode(t);

  return (
    <div className={styles.bar} role="group" aria-label={studioCopy.transport.label}>
      {transport.available ? (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.button}
            data-testid="transport-toggle"
            aria-label={
              transport.paused ? studioCopy.transport.playLabel : studioCopy.transport.pauseLabel
            }
            onClick={transport.toggle}
          >
            {transport.paused ? studioCopy.transport.play : studioCopy.transport.pause}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="transport-back5"
            aria-label={studioCopy.transport.back5Label}
            onClick={() => transport.seekBy(-5)}
          >
            {studioCopy.transport.back5}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="transport-back1"
            aria-label={studioCopy.transport.back1Label}
            onClick={() => transport.seekBy(-1)}
          >
            {studioCopy.transport.back1}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="transport-forward1"
            aria-label={studioCopy.transport.forward1Label}
            onClick={() => transport.seekBy(1)}
          >
            {studioCopy.transport.forward1}
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid="transport-forward5"
            aria-label={studioCopy.transport.forward5Label}
            onClick={() => transport.seekBy(5)}
          >
            {studioCopy.transport.forward5}
          </button>
          <label className={styles.rate}>
            <span className={styles.rateLabel}>{studioCopy.transport.rateLabel}</span>
            <select
              className={styles.select}
              data-testid="transport-rate"
              value={String(transport.rate)}
              onChange={(event) => transport.setRate(Number(event.target.value))}
            >
              {RATES.map((rate) => (
                <option key={rate} value={String(rate)}>
                  {`${rate}x`}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        /* A host this build cannot drive: the times still follow it (FR-1001). */
        <p className={styles.noTransport} data-testid="no-transport">
          {studioCopy.transport.noTransport}
        </p>
      )}

      <p className={styles.clock} data-testid="transport-clock">
        <span className="sr-only">{`${studioCopy.transport.timeLabel}: `}</span>
        <span className={styles.now}>{now}</span>
        <span className={styles.total}>
          {duration === null ? studioCopy.transport.noDuration : formatTimecode(duration)}
        </span>
      </p>

      {videoLock === undefined ? null : (
        <button
          type="button"
          className={styles.lock}
          data-testid="video-lock"
          aria-pressed={videoLock.locked}
          aria-label={studioCopy.transport.videoLockLabel}
          onClick={videoLock.toggle}
        >
          {videoLock.locked
            ? studioCopy.transport.videoLocked
            : studioCopy.transport.videoUnlocked}
        </button>
      )}

      <button
        type="button"
        className={styles.add}
        data-testid="add-event"
        aria-label={studioCopy.transport.addLabel(now)}
        onClick={onAdd}
      >
        {studioCopy.transport.add(now)}
        <kbd className={styles.kbd}>{studioCopy.transport.addHint}</kbd>
      </button>

      {videoLock !== undefined && !videoLock.locked ? (
        <p className={styles.lockHint} data-testid="video-lock-hint">
          {studioCopy.transport.videoUnlockHint}
        </p>
      ) : null}
    </div>
  );
}

export default TransportBar;
