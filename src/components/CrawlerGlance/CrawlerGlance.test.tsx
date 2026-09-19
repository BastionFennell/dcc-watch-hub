// @vitest-environment jsdom
/**
 * The rail's glance card after revision 2 (T322/T323, R2 US1). Everything it
 * shows comes from a `Glance` built by the selector from the shared fixture, so
 * the assertions here and the selector's agree on the same event log.
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

const equippedRows = () => screen.queryAllByTestId('glance-equipped-row');
const historyRows = () => screen.queryAllByTestId('glance-history-row');

describe('CrawlerGlance', () => {
  it('shows the identity header with the credit and separators a screen reader can hear', () => {
    const { container } = renderGlance(glanceAt(200));
    expect(screen.getByTestId('crawler-glance')).toHaveAttribute('data-crawler', 'harry');
    expect(screen.getByTestId('glance-name')).toHaveTextContent('Harry');

    // The player is credited on its own line; the handle is gone because it
    // only repeated the name (008 r3).
    expect(screen.getByText(copy.playedBy('Marcus'))).toBeInTheDocument();
    expect(screen.getByTestId('glance-header').textContent).not.toContain('Harry·');
    const header = screen.getByTestId('glance-header');
    expect(header).toHaveTextContent('Compensated Anarchist');
    expect(header).toHaveTextContent(copy.levelShort(2));
    // The "·" carries no literal spaces any more - the rows around it are flex
    // containers, which trimmed them, so the spacing is a margin now (T330).
    expect(header.textContent).toContain(`Compensated Anarchist·${copy.srSeparator}`);
    const dots = container.querySelectorAll('[aria-hidden="true"]');
    expect(dots.length).toBeGreaterThanOrEqual(1);
    expect(header.querySelectorAll('.sr-only')).toHaveLength(1);
  });

  it('labels the HP strip and keeps the sheet’s ten segments (T344)', () => {
    renderGlance(glanceAt(200));
    expect(screen.getByText(copy.hpLabel)).toBeInTheDocument();
    expect(screen.getByTestId('hp-segments')).toHaveAttribute('aria-label', copy.hpAria(20, 22));
    expect(screen.getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('glance-hp')).toHaveTextContent(copy.hpValue(20, 22));
  });

  it('labels the rank row and names the move since the previous rank point', () => {
    // Harry's series is 4188 (100) → 3012 (150) → 3550 (200): the last step lost
    // him 538 places, so the card points down (T343, UX review 1.4).
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200));
    const rank = () => screen.getByTestId('glance-rank');
    expect(within(rank()).getByText(copy.rankLabel)).toBeInTheDocument();
    expect(screen.getByTestId('glance-rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('glance-rank-best')).toHaveTextContent(copy.rankValue(3012));
    expect(screen.getByTestId('glance-rank-delta')).toHaveTextContent('↓ 538');
    expect(screen.getByTestId('glance-rank-delta')).toHaveAttribute('data-direction', 'down');

    // One step earlier the same crawler had climbed 1,176 places.
    rerender(<CrawlerGlance glance={glanceAt(150)} onOpenRecord={onOpenRecord} />);
    expect(screen.getByTestId('glance-rank-delta')).toHaveTextContent('↑ 1,176');
    expect(screen.getByTestId('glance-rank-delta')).toHaveAttribute('data-direction', 'up');

    // The first point has nothing to compare against, so no delta is printed.
    rerender(<CrawlerGlance glance={glanceAt(110)} onOpenRecord={onOpenRecord} />);
    expect(screen.getByTestId('glance-rank-current')).toHaveTextContent(copy.rankValue(4188));
    expect(screen.queryByTestId('glance-rank-delta')).not.toBeInTheDocument();
  });

  it('keeps the RANK label and the sparkline’s row when the crawler is unranked', () => {
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200, 'actress'));
    const rank = () => screen.getByTestId('glance-rank');
    const spark = () => screen.getByTestId('glance-rank-spark');
    expect(within(rank()).getByText(copy.rankLabel)).toBeInTheDocument();
    expect(within(rank()).getByText(copy.unranked)).toBeInTheDocument();
    expect(screen.queryByTestId('rank-sparkline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('glance-rank-delta')).not.toBeInTheDocument();
    // Two rows either way - numbers, then the chart's reserved box (SC-201).
    expect(rank().children).toHaveLength(2);
    expect(spark()).toBeEmptyDOMElement();

    rerender(<CrawlerGlance glance={glanceAt(200)} onOpenRecord={onOpenRecord} />);
    expect(rank().children).toHaveLength(2);
    expect(within(spark()).getByTestId('rank-sparkline')).toBeInTheDocument();
  });

  it('lists worn gear as slot · item in the sheet’s order', () => {
    // Harry at 200: the starting crowbar was unequipped at 168 and the torch
    // took the hands slot at 169, over the jacket (152) and charm (153).
    renderGlance(glanceAt(200));
    const rows = equippedRows();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.dataset.slot)).toEqual(['torso', 'hands', 'accessory']);
    expect(within(rows[0]).getByText(copy.gearSlotLabels.torso)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Patched Jacket')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Torch')).toBeInTheDocument();
    expect(within(rows[2]).getByText(copy.gearSlotLabels.accessory)).toBeInTheDocument();
    expect(within(rows[2]).getByText('Lucky Rabbit Foot')).toBeInTheDocument();
    // The slot and the item are separated for the ear as well as the eye (0.7).
    expect(rows[0].querySelector('.sr-only')).not.toBeNull();
  });

  it('follows the playhead back to the starting gear', () => {
    renderGlance(glanceAt(20));
    const rows = equippedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].dataset.slot).toBe('hands');
    expect(within(rows[0]).getByText('Enchanted Crowbar')).toBeInTheDocument();
  });

  it('files an unequipped crawler with the System’s empty phrase', () => {
    renderGlance(glanceAt(200, 'actress'));
    expect(equippedRows()).toHaveLength(0);
    expect(screen.getByTestId('glance-equipped')).toHaveTextContent(copy.dossierEmpty.equipped);
  });

  it('shows at most the seven slot rows and counts the rest', () => {
    const many: Glance = {
      ...glanceAt(200),
      equipped: [
        { slot: 'head', item: 'Hard Hat' },
        { slot: 'torso', item: 'Patched Jacket' },
        { slot: 'arms', item: 'Bracers' },
        { slot: 'hands', item: 'Torch' },
        { slot: 'legs', item: 'Work Trousers' },
        { slot: 'feet', item: 'Steel Toes' },
        { slot: 'accessory', item: 'Lucky Rabbit Foot' },
        { slot: 'accessory', item: 'Bronze Token' },
        { slot: 'accessory', item: 'Cracked Lens' },
      ],
    };
    renderGlance(many);
    expect(equippedRows()).toHaveLength(7);
    expect(screen.getByTestId('glance-equipped-more')).toHaveTextContent(copy.equippedMore(2));
    expect(screen.queryByText('Cracked Lens')).not.toBeInTheDocument();
  });

  it('shows the latest achievement with its description and time', () => {
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200));
    const block = () => screen.getByTestId('glance-latest-achievement');
    expect(block()).toHaveTextContent(copy.dossierSections.latestAchievement);
    expect(block()).toHaveTextContent('Gate Crasher');
    expect(block()).toHaveTextContent('Ten mobs, one door.');
    expect(block()).toHaveTextContent(formatTime(60));

    // Before the award, the System files the section as empty - no dash row.
    rerender(<CrawlerGlance glance={glanceAt(20)} onOpenRecord={onOpenRecord} />);
    expect(block()).toHaveTextContent(copy.dossierEmpty.achievements);
    expect(block()).not.toHaveTextContent('Gate Crasher');
  });

  it('renders only the moments that happened, and reserves the other rows', () => {
    const { rerender, onOpenRecord } = renderGlance(glanceAt(200));
    expect(historyRows()).toHaveLength(3);
    expect(historyRows()[0]).toHaveTextContent(formatTime(200));

    // Two moments by 50 (the loot at 30, the HP drop at 45): two rows, and the
    // block keeps its three-row height in CSS instead of padding with "-".
    rerender(<CrawlerGlance glance={glanceAt(50)} onOpenRecord={onOpenRecord} />);
    expect(historyRows()).toHaveLength(2);

    rerender(<CrawlerGlance glance={glanceAt(20)} onOpenRecord={onOpenRecord} />);
    expect(historyRows()).toHaveLength(0);
    expect(screen.getByTestId('glance-history')).not.toHaveTextContent('-');
    expect(screen.getByTestId('glance-history-list').className).toMatch(/historyRows/);
  });

  it('has no ledger left: no counts, no newest-entry rows, no full lists', () => {
    const { container } = renderGlance(glanceAt(200));
    expect(screen.queryByTestId('glance-ledger')).not.toBeInTheDocument();
    for (const kind of ['hotlist', 'skills', 'inventory', 'achievements']) {
      expect(screen.queryByTestId(`ledger-${kind}`)).not.toBeInTheDocument();
    }
    expect(container.querySelectorAll('dt, dd')).toHaveLength(0);
    // The hotlist and skills the author cut are nowhere on the card.
    expect(screen.queryByText('Crowbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Powerful Strike/)).not.toBeInTheDocument();
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

/* ------------------------------------------------------------ 009: mana */

describe('CrawlerGlance - the MANA row', () => {
  it('draws one segment per point of the pool, filled to the current value', () => {
    // The Psychic's sheet writes 5/5.
    renderGlance(glanceAt(0, 'psychic'));
    expect(screen.getByText(copy.vitalsMana)).toBeInTheDocument();
    expect(screen.getByTestId('mana-segments')).toHaveAttribute(
      'aria-label',
      copy.manaAria(5, 5),
    );
    expect(screen.getByTestId('mana-segments')).toHaveAttribute('role', 'img');
    expect(screen.getAllByTestId('mana-segment')).toHaveLength(5);
    expect(screen.getByTestId('glance-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('empties segments as the pool is spent, and refills them on a rewind', () => {
    // The fixture spends The Psychic's pool at t = 171 and restores it at 172.
    const { rerender } = renderGlance(glanceAt(171, 'psychic'));
    const filled = () =>
      screen.getAllByTestId('mana-segment').filter((seg) => seg.dataset.filled === 'true');
    expect(filled()).toHaveLength(2);
    expect(screen.getByTestId('glance-mana')).toHaveTextContent(copy.hpValue(2, 5));

    // Scrubbing back is not an undo: the card is rebuilt from the elapsed log.
    rerender(<CrawlerGlance glance={glanceAt(0, 'psychic')} onOpenRecord={vi.fn()} />);
    expect(filled()).toHaveLength(5);
    expect(screen.getByTestId('glance-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('shows no row at all for a crawler with no pool', () => {
    // X.O. has neither a mana box nor an INT to derive one from.
    renderGlance(glanceAt(0, 'xo'));
    expect(screen.queryByTestId('mana-segments')).toBeNull();
    expect(screen.queryByTestId('glance-mana')).toBeNull();
    expect(screen.queryByText(copy.vitalsMana)).toBeNull();
  });

  it('leaves the HP strip exactly as it was', () => {
    renderGlance(glanceAt(0, 'psychic'));
    expect(screen.getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('glance-hp')).toHaveTextContent(copy.hpValue(20, 20));
  });
});
