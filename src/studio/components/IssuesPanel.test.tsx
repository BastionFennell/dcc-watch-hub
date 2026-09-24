// @vitest-environment jsdom
/**
 * T1019 - the issues list (T1018, US6).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { studioCopy } from '../copy';
import type { Issue } from '../validateDraft';
import { IssuesPanel } from './IssuesPanel';

afterEach(cleanup);

const ISSUES: Issue[] = [
  { severity: 'warning', message: 'The party is empty.' },
  { severity: 'error', message: 'Loot at 0:30 names "ghost", who is not in the party.', uid: 'a' },
  { severity: 'warning', message: 'Spell at 1:00 points at a spell the registry has not got.', uid: 'b' },
  { severity: 'error', message: 'The episode has no title.' },
];

describe('IssuesPanel (T1018)', () => {
  it('puts the errors first', () => {
    render(<IssuesPanel issues={ISSUES} onSelect={() => undefined} />);
    expect(
      screen.getAllByTestId('issue').map((row) => row.getAttribute('data-severity')),
    ).toEqual(['error', 'error', 'warning', 'warning']);
  });

  it('makes the rows that name an event selectable, and only those', () => {
    const onSelect = vi.fn();
    render(<IssuesPanel issues={ISSUES} onSelect={onSelect} />);
    const buttons = screen.getAllByTestId('issue-select');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('names the severity for a screen reader, not only in colour', () => {
    render(<IssuesPanel issues={ISSUES} onSelect={() => undefined} />);
    expect(screen.getAllByTestId('issue-select')[0]).toHaveAccessibleName(
      studioCopy.issues.selectLabel(ISSUES[1].message),
    );
    const spoken = Array.from(document.querySelectorAll('.sr-only')).map(
      (node) => node.textContent,
    );
    expect(spoken).toEqual([
      `${studioCopy.issues.error}: `,
      `${studioCopy.issues.error}: `,
      `${studioCopy.issues.warning}: `,
      `${studioCopy.issues.warning}: `,
    ]);
  });

  it('shows an empty state', () => {
    render(<IssuesPanel issues={[]} onSelect={() => undefined} />);
    expect(screen.getByTestId('issues-empty')).toHaveTextContent(studioCopy.issues.empty);
  });
});
