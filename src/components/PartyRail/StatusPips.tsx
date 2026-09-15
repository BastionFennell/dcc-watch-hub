import styles from './PartyRail.module.css';

export interface StatusPipsProps {
  statuses: string[];
}

/**
 * Small rounded chips under the HP bar. Purely informational — never clickable,
 * and spans only, because the v2 frame around them is a `<button>`.
 *
 * The row is rendered even when it is empty (review 0.10, T339): debuffs come
 * and go with the playhead, and a row that appeared only when occupied made
 * every frame in the rail change height on a seek.
 */
export function StatusPips({ statuses }: StatusPipsProps) {
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
