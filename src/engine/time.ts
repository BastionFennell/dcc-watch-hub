/** `mm:ss` under an hour, `h:mm:ss` at or past it. Fractional seconds floor. */
export function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}
