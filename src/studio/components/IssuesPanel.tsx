/**
 * Everything wrong with the draft, worst first (010, T1018, US6).
 *
 * The list itself is `validateDraft.issuesFor`; this is only how it reads. An
 * issue that names an event is a button, because the only useful thing to do
 * with it is go there - and one that does not (a missing title, an empty party)
 * is plain text rather than a control that would do nothing.
 */
import { studioCopy } from '../copy';
import type { Issue } from '../validateDraft';
import styles from './IssuesPanel.module.css';

export interface IssuesPanelProps {
  issues: readonly Issue[];
  /** The event the author picked; the container selects and seeks to it. */
  onSelect(uid: string): void;
}

/** Errors first, each severity in the order `issuesFor` found them. */
function ordered(issues: readonly Issue[]): Issue[] {
  return [
    ...issues.filter((issue) => issue.severity === 'error'),
    ...issues.filter((issue) => issue.severity !== 'error'),
  ];
}

export function IssuesPanel({ issues, onSelect }: IssuesPanelProps) {
  const rows = ordered(issues);

  if (rows.length === 0) {
    return (
      <p className={styles.empty} data-testid="issues-empty">
        {studioCopy.issues.empty}
      </p>
    );
  }

  return (
    <ul className={styles.list} data-testid="issues-panel" aria-label={studioCopy.issues.title}>
      {rows.map((issue, index) => {
        const { uid } = issue;
        const severity =
          issue.severity === 'error' ? studioCopy.issues.error : studioCopy.issues.warning;
        const body = (
          <>
            <span className={styles.icon} aria-hidden="true">
              {issue.severity === 'error' ? '!' : '?'}
            </span>
            <span className="sr-only">{`${severity}: `}</span>
            <span className={styles.text}>{issue.message}</span>
          </>
        );
        return (
          <li
            key={`${issue.severity}-${uid ?? 'meta'}-${index}`}
            className={styles.row}
            data-severity={issue.severity}
            data-testid="issue"
          >
            {uid === undefined ? (
              <p className={styles.plain}>{body}</p>
            ) : (
              <button
                type="button"
                className={styles.button}
                data-testid="issue-select"
                aria-label={studioCopy.issues.selectLabel(issue.message)}
                onClick={() => onSelect(uid)}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default IssuesPanel;
