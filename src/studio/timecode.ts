/**
 * Timecode entry and display for the Studio (010, FR-1005).
 *
 * The author types whatever they are reading off the player: a raw second
 * count, `m:ss`, or `h:mm:ss`. Everything the Studio stores is seconds.
 */

/** Digits, optionally with a decimal tail (`4:05.5` is half a second past). */
const PART_RE = /^\d+(\.\d+)?$/;

/**
 * Seconds for `input`, or `null` when it is not a timecode.
 *
 * `"245"`, `"4:05"` and `"1:02:03"` all parse; spaces anywhere are ignored, so
 * `" 1 : 02 : 03 "` is the same value. A minute or second field of 60 or more
 * is a typo, not an overflow, so it is rejected rather than carried.
 */
export function parseTimecode(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? input : null;
  }
  if (typeof input !== 'string') return null;

  const cleaned = input.replace(/\s+/g, '');
  if (cleaned === '') return null;

  const parts = cleaned.split(':');
  if (parts.length > 3) return null;
  if (!parts.every((part) => PART_RE.test(part))) return null;

  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  // Only the leading field may exceed 59: "90:00" is ninety minutes.
  if (numbers.slice(1).some((n) => n >= 60)) return null;

  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/**
 * `m:ss` under an hour, `h:mm:ss` at or above it. Seconds are truncated, so
 * the label always names the second the playhead is inside.
 */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  const ss = String(s).padStart(2, '0');
  if (h === 0) return `${m}:${ss}`;
  return `${h}:${String(m).padStart(2, '0')}:${ss}`;
}

/** `[0, durationSec]` when a duration is known, `[0, ∞)` when it is not. */
export function clampTime(seconds: number, durationSec: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  if (durationSec > 0 && seconds > durationSec) return durationSec;
  return seconds;
}
