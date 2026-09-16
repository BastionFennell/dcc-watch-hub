// @vitest-environment jsdom
/**
 * The Encountered strip (T708, FR-610, research R3). Every list it renders comes
 * from `encounteredNpcs` over the shared fixture, so the order, the tints and
 * the defeated marker are asserted against the same event log the selector and
 * the page tests use.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EncounterRail } from './EncounterRail';
import type { Encounter } from '../../engine/selectors';
import { encounteredNpcs } from '../../engine/selectors';
import { reduceTo } from '../../engine/reducer';
import { copy } from '../../copy';
import { makeEpisode, makeRegistry } from '../../test/fixtures';

const episode = makeEpisode(1);
const registry = makeRegistry();

function encountersAt(t: number): Encounter[] {
  return encounteredNpcs(reduceTo(episode, t), registry);
}

function renderRail(encounters: Encounter[], activeId: string | null = null) {
  const onActivate = vi.fn();
  const view = render(
    <EncounterRail encounters={encounters} activeId={activeId} onActivate={onActivate} />,
  );
  return { ...view, onActivate };
}

const chips = () => screen.queryAllByTestId('encounter-chip');
const ids = () => chips().map((chip) => chip.getAttribute('data-npc'));

describe('EncounterRail', () => {
  it('stands by under its title until the first entity is met', () => {
    renderRail(encountersAt(100));

    expect(screen.getByTestId('encounter-rail')).toHaveAccessibleName(copy.encounterTitle);
    expect(screen.getByTestId('encounter-empty')).toHaveTextContent(copy.encounterEmpty);
    expect(chips()).toHaveLength(0);
  });

  it('lists what the playhead says, newest encounter first', () => {
    const { rerender } = renderRail(encountersAt(120));
    // 118 hoarder, 112 grull-rep — and nothing for the id 140 names, which the
    // registry does not carry (spec US1 scenario 5).
    expect(ids()).toEqual(['hoarder', 'grull-rep']);

    rerender(
      <EncounterRail encounters={encountersAt(200)} activeId={null} onActivate={vi.fn()} />,
    );
    // hoarder last moved at 195, the quartermaster at 135, grull-rep at 112.
    expect(ids()).toEqual(['hoarder', 'quartermaster', 'grull-rep']);
    expect(screen.queryByTestId('encounter-empty')).not.toBeInTheDocument();
  });

  it('names each entity with its kind, and marks a defeated one', () => {
    renderRail(encountersAt(200));
    const [hoarder, quartermaster, grull] = chips();

    expect(hoarder).toHaveAttribute('data-kind', 'boss');
    expect(within(hoarder).getByText('The Hoarder')).toBeInTheDocument();
    expect(within(hoarder).getByText(copy.kindLabels.boss)).toBeInTheDocument();
    expect(hoarder).toHaveAttribute('data-defeated', 'true');
    expect(within(hoarder).getByText(copy.npcDefeated)).toBeInTheDocument();

    expect(quartermaster).toHaveAttribute('data-kind', 'ally');
    expect(within(quartermaster).getByText(copy.kindLabels.ally)).toBeInTheDocument();
    expect(quartermaster).not.toHaveAttribute('data-defeated');
    expect(within(quartermaster).queryByText(copy.npcDefeated)).not.toBeInTheDocument();

    expect(grull).toHaveAttribute('data-kind', 'vendor');
    expect(within(grull).getByText(copy.kindLabels.vendor)).toBeInTheDocument();
  });

  it('shows a portrait where there is one and an initial where there is not', () => {
    renderRail(encountersAt(200));
    const [hoarder, quartermaster] = chips();

    // The name is right beside it, so the portrait is decorative (`alt=""`).
    const portrait = within(hoarder).getByRole('presentation', { hidden: true });
    expect(portrait).toHaveAttribute('src', '/img/npcs/hoarder.svg');
    expect(portrait).toHaveAttribute('alt', '');

    // "The Quartermaster" skips its article: the disc reads "Q".
    expect(within(quartermaster).getByText('Q')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is a panel trigger, exactly as a crawler frame is', () => {
    const { onActivate } = renderRail(encountersAt(200), 'hoarder');
    const [hoarder, , grull] = chips();

    expect(hoarder).toHaveAttribute('aria-controls', 'rail-panel');
    expect(hoarder).toHaveAttribute('data-panel-trigger', 'npc:hoarder');
    expect(hoarder).toHaveAttribute('aria-expanded', 'true');
    expect(grull).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(grull);
    expect(onActivate).toHaveBeenCalledTimes(1);
    // The element itself goes back, so the panel can return focus to it (FR-101).
    expect(onActivate).toHaveBeenCalledWith('grull-rep', grull);
  });

  /* --- Revision 3 (T724): the Registry as a panel beside the broadcast --- */

  it('offers no way into the Registry until it is given one', () => {
    renderRail(encountersAt(200));
    expect(screen.queryByTestId('encounter-browse')).toBeNull();
    // The link revision 2 put here is gone: it lives in the panel's footer now.
    expect(screen.queryByTestId('encounter-registry-link')).toBeNull();
  });

  it('browses the Registry from a panel trigger beside the title', () => {
    const onBrowse = vi.fn();
    const { rerender } = render(
      <EncounterRail
        encounters={encountersAt(100)}
        activeId={null}
        onActivate={vi.fn()}
        onBrowse={onBrowse}
      />,
    );

    const browse = screen.getByTestId('encounter-browse');
    expect(browse).toHaveTextContent(copy.registryBrowse);
    expect(browse).toHaveAttribute('aria-controls', 'rail-panel');
    expect(browse).toHaveAttribute('data-panel-trigger', 'registry');
    expect(browse).toHaveAttribute('aria-expanded', 'false');
    // Reachable while the strip is still standing by, so an empty episode is
    // not a dead end.
    expect(screen.getByTestId('encounter-empty')).toBeInTheDocument();

    fireEvent.click(browse);
    // The element itself goes back, so the panel can return focus to it (FR-101).
    expect(onBrowse).toHaveBeenCalledWith(browse);

    rerender(
      <EncounterRail
        encounters={encountersAt(100)}
        activeId={null}
        onActivate={vi.fn()}
        onBrowse={onBrowse}
        browsing
      />,
    );
    expect(screen.getByTestId('encounter-browse')).toHaveAttribute('aria-expanded', 'true');
  });

  it('carries its layout so the strip scrolls and the phone pane is a grid', () => {
    const { rerender } = renderRail(encountersAt(200));
    expect(screen.getByTestId('encounter-rail')).toHaveAttribute('data-layout', 'row');

    rerender(
      <EncounterRail
        encounters={encountersAt(200)}
        activeId={null}
        onActivate={vi.fn()}
        layout="grid"
      />,
    );
    expect(screen.getByTestId('encounter-rail')).toHaveAttribute('data-layout', 'grid');
    expect(ids()).toEqual(['hoarder', 'quartermaster', 'grull-rep']);
  });
});
