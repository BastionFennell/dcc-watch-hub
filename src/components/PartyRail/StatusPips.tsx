import styles from './PartyRail.module.css';

export interface StatusPipsProps {
  statuses: string[];
}

/** Small rounded chips under the HP bar. Purely informational — never clickable. */
export function StatusPips({ statuses }: StatusPipsProps) {
  if (statuses.length === 0) return null;
  return (
    <div className={styles.pips}>
      {statuses.map((status) => (
        <span key={status} className={styles.pip}>
          {status}
        </span>
      ))}
    </div>
  );
}

export default StatusPips;
