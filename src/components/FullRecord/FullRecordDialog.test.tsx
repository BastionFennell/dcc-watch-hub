// @vitest-environment jsdom
/**
 * The full record (US2, FR-210..FR-214, research R6, T308). The dialog is fed a
 * real `Dossier` from the fixture episode, so "keeps updating with the playhead"
 * is tested the way the page does it: recompute at another `t`, re-render.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { copy } from '../../copy';
import { reduceTo } from '../../engine/reducer';
import { crawlerDossier } from '../../engine/selectors';
import type { Dossier } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { makeEpisode, makeShow } from '../../test/fixtures';
import { FullRecordDialog } from './FullRecordDialog';

const episode = makeEpisode(1);
const meta = makeShow().episodes[0];

/** Exactly what `EpisodePage` hands the dialog: the dossier at the playhead. */
function dossierAt(t: number, crawlerId = 'harry'): Dossier {
  const dossier = crawlerDossier(reduceTo(episode, t), episode.events, t, crawlerId);
  if (dossier === null) throw new Error(`No dossier for ${crawlerId}`);
  return dossier;
}

function section(name: string): HTMLElement {
  return screen.getByTestId(`dossier-${name}`);
}

afterEach(() => {
  document.body.className = '';
});

describe('FullRecordDialog', () => {
  it('renders nothing while it is closed', () => {
    render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open={false}
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    expect(screen.queryByTestId('crawler-record')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-backdrop')).not.toBeInTheDocument();
    expect(document.body.classList.contains('dialog-open')).toBe(false);
  });

  it('is a modal dialog named by the crawler, portaled to the body', () => {
    const { container } = render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );

    const dialog = screen.getByTestId('crawler-record');
    expect(dialog).toHaveAttribute('id', 'crawler-record');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // `aria-labelledby` resolves to the visible title, not a stray string.
    expect(dialog).toHaveAccessibleName(copy.recordTitle('Harry'));
    expect(screen.getByText(copy.recordKicker)).toBeInTheDocument();
    // Portaled: the backdrop is a child of the body, not of the page's tree.
    expect(screen.getByTestId('record-backdrop').parentElement).toBe(document.body);
    expect(container).toBeEmptyDOMElement();
    // Initial focus is the close control (FR-210).
    expect(document.activeElement).toBe(screen.getByTestId('record-close'));
    expect(document.body.classList.contains('dialog-open')).toBe(true);
  });

  it('lays out the whole sheet: identity, vitals, stats, and every list in full', () => {
    render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );

    expect(screen.getByTestId('dossier-name')).toHaveTextContent('Harry');
    const identity = within(section('identity'));
    expect(identity.getByText('10,491,201')).toBeInTheDocument();
    expect(identity.getByText('Compensated Anarchist')).toBeInTheDocument();

    expect(within(section('vitals')).getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('dossier-hp')).toHaveTextContent(copy.hpValue(20, 22));
    expect(screen.getByTestId('rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('rank-best')).toHaveTextContent(copy.rankValue(3012));
    expect(within(section('stats')).getByText(copy.statLabels.dex)).toBeInTheDocument();

    // The record is the full lists — nothing is summarized or cut (FR-211).
    expect(within(section('hotlist')).getByText('Crowbar')).toBeInTheDocument();
    expect(within(section('skills')).getByText('Powerful Strike')).toBeInTheDocument();
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();
    const achievements = within(section('achievements'));
    expect(achievements.getByText('Gate Crasher')).toBeInTheDocument();
    expect(achievements.getByText(formatTime(60))).toBeInTheDocument();
    expect(
      within(section('history')).getAllByTestId('dossier-history-item').length,
    ).toBeGreaterThan(1);
    expect(within(section('debuffs')).getByText(copy.dossierEmpty.debuffs)).toBeInTheDocument();
  });

  it('gives every list item a stable, labelled structure for later explanations (FR-214)', () => {
    render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );

    const item = within(section('inventory')).getByRole('listitem');
    expect(item).toHaveAttribute('data-item', 'inventory');
    expect(item).toHaveAttribute('data-name', 'Torch');
    // The label is its own element, so a tooltip can attach without restructuring.
    expect(item.firstElementChild?.tagName).toBe('SPAN');
    expect(item.firstElementChild).toHaveTextContent('Torch');

    const achievement = within(section('achievements')).getAllByRole('listitem')[0];
    expect(achievement).toHaveAttribute('data-item', 'achievement');
    expect(achievement).toHaveAttribute('data-name', 'Gate Crasher');
    // Nothing is interactive yet: the close control is the dialog's only control.
    expect(within(screen.getByTestId('record-body')).queryByRole('button')).toBeNull();
  });

  it('keeps updating with the playhead without closing or remounting', () => {
    const { rerender } = render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    const dialog = screen.getByTestId('crawler-record');
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();

    // Seek back before the trade at 150 — the same dialog node, new contents.
    rerender(
      <FullRecordDialog
        dossier={dossierAt(110)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    expect(screen.getByTestId('crawler-record')).toBe(dialog);
    expect(within(section('inventory')).getByText('Enchanted Crowbar')).toBeInTheDocument();
    expect(within(section('inventory')).queryByText('Torch')).not.toBeInTheDocument();
    expect(within(section('hotlist')).getByText('Door')).toBeInTheDocument();
  });

  it('closes on the close control, on Escape, and on the backdrop — but not from inside', () => {
    const onClose = vi.fn();
    const props = {
      dossier: dossierAt(200),
      meta,
      open: true,
      onClose,
      returnFocusTo: null,
    };
    render(<FullRecordDialog {...props} />);

    fireEvent.click(screen.getByTestId('crawler-record'));
    fireEvent.click(screen.getByTestId('dossier-name'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('record-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByTestId('record-close'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('record-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('traps Tab inside the dialog and returns focus to its trigger', () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);
    const onClose = vi.fn();

    const { rerender } = render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={onClose}
        returnFocusTo={trigger}
      />,
    );
    const close = screen.getByTestId('record-close');

    fireEvent.keyDown(close, { key: 'Tab' });
    expect(screen.getByTestId('crawler-record')).toContainElement(
      document.activeElement as HTMLElement,
    );
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Tab', shiftKey: true });
    expect(screen.getByTestId('crawler-record')).toContainElement(
      document.activeElement as HTMLElement,
    );

    rerender(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open={false}
        onClose={onClose}
        returnFocusTo={trigger}
      />,
    );
    expect(document.activeElement).toBe(trigger);
    expect(document.body.classList.contains('dialog-open')).toBe(false);
    trigger.remove();
  });
});
