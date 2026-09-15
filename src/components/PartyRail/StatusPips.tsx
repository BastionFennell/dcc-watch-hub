import styles from './PartyRail.module.css';

export interface StatusPipsProps {
  statuses: string[];
}

/**
 * Small rounded chips under the HP bar. Purely informational — never clickable,
 * and spans only, because the v2 frame around them is a `<button>`.
 */
export function StatusPips({ statuses }: StatusPipsProps) {
  if (statuses.length === 0) return null;
  return (
    <span className={styles.pips}>
      {statuses.map((status) => (
        <span key={status} className={styles.pip}>
          {status}
        </span>
      ))}
    </span>
  );
}

export default StatusPips;
