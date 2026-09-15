// @vitest-environment jsdom
/**
 * The rail's glance card (T304, FR-200..FR-203). Everything it shows comes from
 * a `Glance` built by the selector from the shared fixture, so the assertions
 * here and the selector's agree on the same event log.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CrawlerGlance } from './CrawlerGlance';
import type { Glance } from '../../engine/selectors';
import { crawlerDossier, crawlerGlance } from '../../engine/selectors';
import { reduceTo } from '../../engine/reducer';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { makeEpisode } from '../../test/fixtures';

const episode = makeEpisode();
const party = episode.initialState.party;

function glanceAt(t: number, id = 'harry'): Glance {
  const dossier = crawlerDossier(reduceTo(episode, t), episode.events, t, id, party);
  if (dossier === null) throw new Error(`no dossier for ${id} at ${t}`);
  return crawlerGlance(dossier);
}

function renderGlance(glance: Glance, onOpenRecord = vi.fn()) {
  const view = render(<CrawlerGlance glance={glance} onOpenRecord={onOpenRecord} />);
  return { ...view, onOpenRecord };
}

function ledger(kind: string): HTMLElement {
  return screen.getByTestId(`ledger-${kind}`);
}

describe('CrawlerGlance', () => {
  it('shows the identity header, HP and rank as of the playhead', () => {
    renderGlance(glanceAt(200));
    expect(screen.getByTestId('crawler-glance')).toHaveAttribute('data-crawler', 'harry');
    expect(screen.getByTestId('glance-name')).toHaveTextContent('Harry');
    const header = screen.getByTestId('glance-header');
    expect(header).toHaveTextContent('Harry · Marcus');
    expect(header).toHaveTextContent(`Compensated Anarchist · ${copy.levelShort(2)}`);
    expect(screen.getByTestId('glance-hp')).toHaveTextContent(copy.hpValue(20, 22));
    expect(screen.getByTestId('glance-rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('glance-rank-best')).toHaveTextContent(copy.rankValue(3012));
    expect(screen.getByTestId('rank-sparkline')).toBeInTheDocument();
  });

  it('prints the System’s "Unranked" line and no sparkline before the first rank', () => {
    renderGlance(glanceAt(90));
    expect(within(screen.getByTestId('glance-rank')).getByText(copy.unranked)).toBeInTheDocument();
    expect(screen.queryByTestId('rank-sparkline')).not.toBeInTheDocument();
  });

  it('gives each list one row with its count and newest entry', () => {
    renderGlance(glanceAt(200));
    expect(ledger('hotlist')).toHaveTextContent(copy.dossierSections.hotlist);
    expect(ledger('hotlist')).toHaveTextContent(copy.ledgerCount(1));
    expect(ledger('hotlist')).toHaveTextContent('Crowbar');
    expect(ledger('skills')).toHaveTextContent('Powerful Strike · Rank 1');
    expect(ledger('inventory')).toHaveTextContent('Torch');
    // Achievement rows carry the time; the other rows do not.
    expect(ledger('achievements')).toHaveTextContent('Gate Crasher');
    expect(ledger('achievements')).toHaveTextContent(formatTime(60));
    expect(ledger('inventory')).not.toHaveTextContent(formatTime(150));
  });

  it('changes the newest entry on a backward seek', () => {
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200));
    expect(ledger('hotlist')).toHaveTextContent('Crowbar');
    rerender(<CrawlerGlance glance={glanceAt(110)} onOpenRecord={onOpenRecord} />);
    expect(ledger('hotlist')).toHaveTextContent('Door');
    expect(ledger('inventory')).toHaveTextContent('Enchanted Crowbar');
    expect(ledger('achievements')).toHaveTextContent(copy.ledgerCount(1));
  });

  it('files an empty list with the System’s empty phrase and a zero count', () => {
    renderGlance(glanceAt(20));
    expect(ledger('hotlist')).toHaveTextContent(copy.ledgerCount(0));
    expect(ledger('hotlist')).toHaveTextContent(copy.dossierEmpty.hotlist);
    expect(ledger('inventory')).toHaveTextContent(copy.dossierEmpty.inventory);
    expect(ledger('achievements')).toHaveTextContent(copy.dossierEmpty.achievements);
    expect(screen.getByTestId('glance-debuffs')).toHaveTextContent(copy.dossierEmpty.debuffs);
  });

  it('always renders exactly three history rows, padding with the placeholder', () => {
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200));
    const rows = () => within(screen.getByTestId('glance-history')).getAllByRole('listitem');
    expect(rows()).toHaveLength(3);
    expect(rows().some((row) => row.dataset.placeholder === 'true')).toBe(false);
    expect(rows()[0]).toHaveTextContent(formatTime(200));

    rerender(<CrawlerGlance glance={glanceAt(40)} onOpenRecord={onOpenRecord} />);
    expect(rows()).toHaveLength(3);
    expect(rows().filter((row) => row.dataset.placeholder === 'true')).toHaveLength(2);
    expect(screen.getByTestId('glance-history')).toHaveTextContent(copy.historyPlaceholder);

    rerender(<CrawlerGlance glance={glanceAt(20)} onOpenRecord={onOpenRecord} />);
    expect(rows()).toHaveLength(3);
    expect(rows().filter((row) => row.dataset.placeholder === 'true')).toHaveLength(3);
  });

  it('never renders a full list: the ledger is four single-entry rows', () => {
    const { container } = renderGlance(glanceAt(200));
    // Harry has no debuffs at 200, so history is the card's only list.
    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(1);
    expect(lists[0].querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByTestId('glance-ledger').querySelectorAll('dt')).toHaveLength(4);
    expect(screen.getByTestId('glance-ledger').querySelectorAll('dd')).toHaveLength(4);
    // The skill's name appears once — in its ledger row, not in a list as well.
    expect(screen.getAllByText('Powerful Strike · Rank 1')).toHaveLength(1);
  });

  it('caps debuff chips at two rows and counts the rest', () => {
    const many: Glance = {
      ...glanceAt(200),
      debuffs: ['Poisoned', 'Bleeding', 'Stunned', 'Cursed', 'Burning', 'Frozen', 'Deafened'],
    };
    renderGlance(many);
    const chips = within(screen.getByTestId('glance-debuffs')).getAllByRole('listitem');
    expect(chips).toHaveLength(7);
    expect(screen.getByTestId('glance-debuffs-more')).toHaveTextContent(copy.debuffsMore(1));
    expect(screen.queryByText('Deafened')).not.toBeInTheDocument();
  });

  it('offers one control, which hands the dialog its trigger element', () => {
    const { container, onOpenRecord } = renderGlance(glanceAt(200));
    const button = screen.getByTestId('open-record');
    expect(button).toHaveTextContent(copy.openRecord);
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-controls', 'crawler-record');
    expect(container.querySelectorAll('button')).toHaveLength(1);

    fireEvent.click(button);
    expect(onOpenRecord).toHaveBeenCalledTimes(1);
    expect(onOpenRecord).toHaveBeenCalledWith(button);
  });
});
