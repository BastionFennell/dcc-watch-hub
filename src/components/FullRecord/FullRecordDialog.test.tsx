// @vitest-environment jsdom
/**
 * The full record (US2, FR-210..FR-214, R2-FR-221..224, research R6/R8/R9,
 * T308 + T326). The dialog is fed a real `Dossier` from the fixture episode, so
 * "keeps updating with the playhead" is tested the way the page does it:
 * recompute at another `t`, re-render.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { copy } from '../../copy';
import { reduceTo } from '../../engine/reducer';
import { crawlerDossier } from '../../engine/selectors';
import type { Dossier } from '../../engine/selectors';
import { formatTime } from '../../engine/time';
import { makeEpisode, makeEpisodeRaw, makeShow, makeSpells } from '../../test/fixtures';
import { normalizeEpisode } from '../../data/validate';
import { spellIndex } from '../../engine/spells';
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

/** The props the page always passes; individual tests override what they test. */
function open(dossier: Dossier, onClose = vi.fn()) {
  return render(
    <FullRecordDialog
      dossier={dossier}
      meta={meta}
      open
      onClose={onClose}
      returnFocusTo={null}
    />,
  );
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
    const { container } = open(dossierAt(200));

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

  it('dims the page from the first frame and anchors the sheet to a fixed top', () => {
    open(dossierAt(200));

    // T337 / UX review 0.6: only the box animates, so the glance card behind is
    // never legible through a fading backdrop.
    const backdrop = screen.getByTestId('record-backdrop');
    expect(backdrop.className).not.toContain('enter');
    expect(screen.getByTestId('crawler-record').className).toContain('enter');
    // T332: a shrinking seek must not re-centre the record vertically.
    expect(backdrop.className).toContain('anchorTop');
  });

  it('leads with the crawler art and falls back to the bust when there is none', () => {
    const { unmount } = open(dossierAt(200));

    const art = screen.getByTestId('record-art-image');
    expect(art).toHaveAttribute('src', '/img/crawlers/harry-art.svg');
    expect(art).toHaveAccessibleName(copy.artAlt('Harry'));
    expect(art).not.toHaveAttribute('data-fallback');
    unmount();

    // X.O. has no `art` in the fixture: the same column, the bust instead.
    open(dossierAt(200, 'xo'));
    const bust = screen.getByTestId('record-art-image');
    expect(bust).toHaveAttribute('src', '/img/crawlers/xo.svg');
    expect(bust).toHaveAttribute('data-fallback', 'bust');
    expect(bust).toHaveAccessibleName(copy.artAlt('X.O.'));
  });

  it('draws the hotlist as ten numbered slots, filled in order', () => {
    const { unmount } = open(dossierAt(200));

    const slots = within(section('hotlist')).getAllByTestId('hotbar-slot');
    expect(slots).toHaveLength(10);
    expect(slots[0]).toHaveAttribute('data-filled', 'true');
    expect(slots[0]).toHaveAttribute('data-name', 'Crowbar');
    expect(slots[0]).toHaveTextContent(copy.hotbarSlot(1));
    // Empty slots stay in place, dim and unnamed (R2-FR-221).
    expect(slots[1]).not.toHaveAttribute('data-filled');
    expect(slots[9]).toHaveTextContent(copy.hotbarSlot(10));
    expect(screen.queryByTestId('hotbar-overflow')).not.toBeInTheDocument();
    unmount();

    // At 210 Harry tracks eleven: the first ten fill the bar, one overflows.
    open(dossierAt(210));
    const full = within(section('hotlist')).getAllByTestId('hotbar-slot');
    expect(full).toHaveLength(10);
    expect(full.every((slot) => slot.getAttribute('data-filled') === 'true')).toBe(true);
    expect(full.map((slot) => slot.getAttribute('data-name'))).toEqual([
      'Crowbar',
      'The Hoarder',
      'Bronze Box Runner',
      'The Doorway',
      'Quadrant C',
      'The Rot Market',
      'Signal Tower',
      'The Meat District',
      'Grull Industries',
      'The Understudy',
    ]);
    expect(screen.getByTestId('hotbar-overflow')).toHaveTextContent(copy.hotbarOverflow(1));
  });

  it('lists every gear slot in sheet order, with "-" for the empty ones', () => {
    open(dossierAt(200));

    const rows = within(section('gear')).getAllByTestId('gear-row');
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.getAttribute('data-slot'))).toEqual([
      'head',
      'torso',
      'arms',
      'hands',
      'legs',
      'feet',
      'accessory',
    ]);
    expect(rows[0]).toHaveTextContent(copy.gearSlotLabels.head);
    expect(rows[0]).toHaveTextContent(copy.dossierEmpty.gearSlot);
    expect(rows[1]).toHaveAttribute('data-name', 'Patched Jacket');
    expect(rows[3]).toHaveAttribute('data-name', 'Torch');
    expect(rows[6]).toHaveTextContent(copy.gearAccessoriesLabel);
    expect(rows[6]).toHaveAttribute('data-name', 'Lucky Rabbit Foot');
  });

  it('labels the rank numbers and shows the movement since the last update (T343)', () => {
    open(dossierAt(200));

    expect(within(section('vitals')).getByText(copy.rankLabel)).toBeInTheDocument();
    expect(screen.getByTestId('rank-current')).toHaveTextContent(copy.rankValue(3550));
    expect(screen.getByTestId('rank-best')).toHaveTextContent(copy.rankValue(3012));
    // 3012 → 3550: the rank number rose, which is a fall.
    const delta = screen.getByTestId('rank-delta');
    expect(delta).toHaveTextContent(copy.rankDelta(-538));
    expect(delta).toHaveAttribute('data-direction', 'down');
  });

  it('credits the player on its own line, without repeating the handle (008 r3)', () => {
    open(dossierAt(200));

    const band = screen.getByTestId('dossier-name').parentElement as HTMLElement;
    expect(band).toHaveTextContent(copy.playedBy('Marcus'));
    expect(band.textContent).not.toContain(copy.srSeparator);
    expect(band.textContent).not.toContain('Harry·');
  });

  it('caps the tile grids at eight and offers the rest behind "View all"', () => {
    open(dossierAt(200, 'xo'));

    // X.O. has nine skills by 200 (fixture): eight tiles, then the control.
    const skills = within(section('skills'));
    expect(skills.getAllByTestId('tile')).toHaveLength(8);
    expect(skills.getByTestId('view-all-skills')).toHaveTextContent(copy.viewAll(9));
    expect(skills.getByTestId('view-all-skills')).toHaveAttribute(
      'aria-controls',
      'crawler-record-body',
    );
    // A section that fits offers nothing: achievements are a single tile.
    const achievements = within(section('achievements'));
    expect(achievements.getAllByTestId('tile')).toHaveLength(1);
    expect(achievements.queryByTestId('view-all-achievements')).not.toBeInTheDocument();
  });

  it('shows the eight latest history rows on the sheet, with the rest behind "View all"', () => {
    open(dossierAt(200));

    const history = within(section('history'));
    expect(history.getAllByTestId('dossier-history-item')).toHaveLength(8);
    expect(history.getByTestId('view-all-history')).toBeInTheDocument();
  });

  it('opens a category in full, retitles the dialog, and returns focus on the way back', () => {
    open(dossierAt(200, 'xo'));

    const trigger = screen.getByTestId('view-all-skills');
    fireEvent.click(trigger);

    // The body is replaced by the list view: the full nine, no tiles, no sheet.
    const list = within(section('skills'));
    expect(list.getAllByRole('listitem')).toHaveLength(9);
    expect(screen.queryByTestId('tile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-art-image')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hotbar-slot')).not.toBeInTheDocument();
    // The title names the category (R2-FR-223) and still names the dialog.
    expect(screen.getByTestId('crawler-record')).toHaveAccessibleName(
      copy.recordListTitle('X.O.', copy.dossierSections.skills),
    );
    // Focus lands on the list's heading (contracts/dialog.md Revision 2).
    expect(document.activeElement).toBe(
      within(section('skills')).getByRole('heading', { level: 3 }),
    );

    fireEvent.click(screen.getByTestId('record-back'));
    expect(screen.getByTestId('record-art-image')).toBeInTheDocument();
    expect(screen.getByTestId('crawler-record')).toHaveAccessibleName(
      copy.recordTitle('X.O.'),
    );
    // …and back on the "View all" that opened it.
    expect(document.activeElement).toBe(screen.getByTestId('view-all-skills'));
  });

  it('steps Escape out of a list view first and closes the record from the sheet', () => {
    const onClose = vi.fn();
    open(dossierAt(200, 'xo'), onClose);

    fireEvent.click(screen.getByTestId('view-all-skills'));
    expect(screen.getByTestId('record-back')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('record-back')).not.toBeInTheDocument();
    expect(screen.getByTestId('record-art-image')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a list view live while the playhead moves', () => {
    const { rerender } = render(
      <FullRecordDialog
        dossier={dossierAt(200)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );

    fireEvent.click(screen.getByTestId('view-all-history'));
    const before = within(section('history')).getAllByTestId('dossier-history-item').length;

    // Seek back: the same list view, fewer elapsed moments (FR-212).
    rerender(
      <FullRecordDialog
        dossier={dossierAt(110)}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    expect(screen.getByTestId('record-back')).toBeInTheDocument();
    const after = within(section('history')).getAllByTestId('dossier-history-item').length;
    expect(after).toBeLessThan(before);
  });

  it('reopens on the sheet after a list view was left open (R2-FR-223)', () => {
    const { rerender } = render(
      <FullRecordDialog
        dossier={dossierAt(200, 'xo')}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    fireEvent.click(screen.getByTestId('view-all-skills'));
    expect(screen.getByTestId('record-back')).toBeInTheDocument();

    for (const open of [false, true]) {
      rerender(
        <FullRecordDialog
          dossier={dossierAt(200, 'xo')}
          meta={meta}
          open={open}
          onClose={vi.fn()}
          returnFocusTo={null}
        />,
      );
    }
    expect(screen.queryByTestId('record-back')).not.toBeInTheDocument();
    expect(screen.getByTestId('record-art-image')).toBeInTheDocument();
  });

  it('lays out the whole sheet: identity, vitals, stats, and the crawler sheet', () => {
    open(dossierAt(200));

    expect(screen.getByTestId('dossier-name')).toHaveTextContent('Harry');
    const identity = within(section('identity'));
    expect(identity.getByText('10,491,201')).toBeInTheDocument();
    expect(identity.getByText('Compensated Anarchist')).toBeInTheDocument();

    expect(within(section('vitals')).getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('dossier-hp')).toHaveTextContent(copy.hpValue(20, 22));
    expect(within(section('stats')).getByText(copy.statLabels.dex)).toBeInTheDocument();

    expect(within(section('hotlist')).getByText('Crowbar')).toBeInTheDocument();
    expect(within(section('skills')).getByText('Powerful Strike')).toBeInTheDocument();
    expect(within(section('inventory')).getByText('Torch')).toBeInTheDocument();
    const achievements = within(section('achievements'));
    expect(achievements.getByText('Gate Crasher')).toBeInTheDocument();
    expect(achievements.getByText(formatTime(60))).toBeInTheDocument();
    expect(within(section('debuffs')).getByText(copy.dossierEmpty.debuffs)).toBeInTheDocument();
  });

  it('gives every item a stable, labelled structure for later explanations (FR-214)', () => {
    open(dossierAt(200));

    const item = within(section('inventory')).getAllByTestId('tile')[0];
    expect(item).toHaveAttribute('data-item', 'inventory');
    expect(item).toHaveAttribute('data-name', 'Torch');
    // The label is its own element, so a tooltip can attach without restructuring.
    expect(item.firstElementChild?.tagName).toBe('SPAN');
    expect(item.firstElementChild).toHaveTextContent('Torch');

    const achievement = within(section('achievements')).getAllByTestId('tile')[0];
    expect(achievement).toHaveAttribute('data-item', 'achievement');
    expect(achievement).toHaveAttribute('data-name', 'Gate Crasher');

    const slot = within(section('hotlist')).getAllByTestId('hotbar-slot')[0];
    expect(slot).toHaveAttribute('data-item', 'hotlist');
    expect(slot).toHaveAttribute('data-name', 'Crowbar');

    // The sheet itself is a tab stop, so a keyboard can scroll a record too
    // long for the viewport (axe scrollable-region-focusable, T313).
    expect(screen.getByTestId('record-body')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('record-body')).toHaveAttribute('id', 'crawler-record-body');
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

    // Seek back before the trade at 150 - the same dialog node, new contents.
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

  it('closes on the close control, on Escape, and on the backdrop - but not from inside', () => {
    const onClose = vi.fn();
    open(dossierAt(200), onClose);

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

/* ----- 008 revision 2: quantities, tooltips and the SPELLS section (R2) ----- */

describe('FullRecordDialog - 008 revision 2', () => {
  const psychic = () => dossierAt(0, 'psychic');

  it('draws a quantity box on a key that holds a stack', () => {
    open(psychic());
    const slot = within(section('hotlist')).getAllByTestId('hotbar-slot')[0];
    expect(slot).toHaveAttribute('data-name', 'Mana Draught');
    expect(within(slot).getByTestId('hotbar-qty')).toHaveTextContent('x5');
  });

  it('names the stack, and its count, in the key accessible name', () => {
    open(psychic());
    expect(
      screen.getByRole('button', { name: copy.hotbarSlotQtyAria(1, 'Mana Draught', 5) }),
    ).toBeInTheDocument();
  });

  it('shows the sheet text on click and hides it on Escape', () => {
    open(psychic());
    const trigger = screen.getByRole('button', {
      name: copy.hotbarSlotQtyAria(1, 'Mana Draught', 5),
    });
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip')).toHaveTextContent(
      'Restores your Mana in full when you spend an Action to drink one.',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    // Escape inside a tooltip does not also close the record.
    expect(screen.getByTestId('crawler-record')).toBeInTheDocument();
  });

  it('leaves a key with nothing to explain as an inert slot', () => {
    open(dossierAt(210));
    const slot = within(section('hotlist')).getAllByTestId('hotbar-slot')[0];
    expect(within(slot).queryByRole('button')).not.toBeInTheDocument();
    expect(within(slot).queryByTestId('hotbar-qty')).not.toBeInTheDocument();
  });

  it('files SPELLS between SKILLS and INVENTORY, with a mono footer', () => {
    open(psychic());
    const sections = screen.getAllByTestId(/^dossier-/).map((node) => node.dataset.testid);
    expect(sections.indexOf('dossier-spells')).toBeGreaterThan(sections.indexOf('dossier-skills'));
    expect(sections.indexOf('dossier-spells')).toBeLessThan(sections.indexOf('dossier-inventory'));

    const tile = within(section('spells')).getByTestId('tile');
    expect(tile).toHaveAttribute('data-item', 'spell');
    expect(tile).toHaveAttribute('data-name', 'Second Sight');
    expect(tile).toHaveTextContent(copy.spellMeta(2, 3) as string);
  });

  it('explains a spell tile on click', () => {
    open(psychic());
    fireEvent.click(
      within(section('spells')).getByRole('button', {
        name: copy.tooltipTrigger('Second Sight'),
      }),
    );
    const tip = screen.getByTestId('tooltip');
    expect(tip).toHaveTextContent('Read the room one beat before it happens.');
    expect(tip).toHaveTextContent(copy.spellMeta(2, 3) as string);
  });

  it('says so when the crawler has inscribed nothing', () => {
    open(dossierAt(200));
    expect(within(section('spells')).getByText(copy.dossierEmpty.spells)).toBeInTheDocument();
  });

  it('opens a spells list view that carries the full text', () => {
    const base = psychic();
    const many: Dossier = {
      ...base,
      // Unresolved views (no `id`): a sheet's own spell, not one the book carries.
      spells: Array.from({ length: 9 }, (_, i) => ({
        name: `Cantrip ${i + 1}`,
        rank: i,
        mana: i + 1,
        description: `What Cantrip ${i + 1} does.`,
        tags: [],
        upgrades: [],
      })),
    };
    open(many);
    fireEvent.click(screen.getByTestId('view-all-spells'));
    expect(screen.getByTestId('crawler-record')).toHaveAttribute('data-view', 'spells');
    const row = within(section('spells')).getAllByRole('listitem')[0];
    expect(row).toHaveAttribute('data-item', 'spell');
    expect(row).toHaveTextContent('What Cantrip 1 does.');
    fireEvent.click(screen.getByTestId('record-back'));
    expect(screen.getByTestId('crawler-record')).toHaveAttribute('data-view', 'sheet');
  });
});

/* ------------------- 008 revision 4: a sheet entry that points at the book */

describe('FullRecordDialog - registry-backed spells (008 revision 4)', () => {
  const spells = spellIndex(makeSpells());

  /** The Psychic with her Heal replaced by a `ref` into the book. */
  function referring(): Dossier {
    const raw = makeEpisodeRaw() as { initialState: { party: Record<string, unknown>[] } };
    const psychic = raw.initialState.party.find((crawler) => crawler.id === 'psychic');
    if (psychic !== undefined) {
      psychic.spells = [{ ref: 'mending-light', rank: 1 }];
      psychic.hotlist = [{ ref: 'mending-light' }];
    }
    const data = normalizeEpisode(raw);
    const dossier = crawlerDossier(
      reduceTo(data, 0),
      data.events,
      0,
      'psychic',
      data.initialState.party,
      spells,
    );
    if (dossier === null) throw new Error('No dossier for psychic');
    return dossier;
  }

  it("names a ref hotbar key from the registry and explains it in the book's words", () => {
    open(referring());
    const key = within(section('hotlist')).getByRole('button', {
      name: copy.hotbarSlotAria(1, 'Mending Light'),
    });
    expect(key).toHaveTextContent('Mending Light');

    fireEvent.click(key);
    const tip = screen.getByTestId('tooltip');
    expect(tip).toHaveTextContent(copy.spellTags(['Interrupt', 'Passive']) as string);
    expect(tip).toHaveTextContent(copy.spellMana(2));
    expect(tip).toHaveTextContent(copy.spellRange('Self only'));
    expect(tip).toHaveTextContent('Heal 2 HB slots.');
    expect(tip).toHaveTextContent(copy.spellUpgrade(5, 'Heal 3 HB slots instead.'));
  });

  it("gives the spell tile the book's cost in its footer and its fields in the tooltip", () => {
    open(referring());
    const tile = within(section('spells')).getByTestId('tile');
    expect(tile).toHaveAttribute('data-name', 'Mending Light');
    expect(tile).toHaveTextContent(copy.spellMeta(1, 2) as string);

    fireEvent.click(
      within(section('spells')).getByRole('button', {
        name: copy.tooltipTrigger('Mending Light'),
      }),
    );
    const tip = screen.getByTestId('tooltip');
    expect(tip).toHaveTextContent(copy.spellLimitations('Rank 1 maximum'));
    expect(tip).toHaveTextContent(copy.spellCooldown('10 minutes'));
    expect(tip).toHaveTextContent(copy.spellDuration('5 seconds'));
  });

  it('prints the same fields in the spells list view, with no tooltip needed', () => {
    const base = referring();
    // Nine spells force the "View all" control the list view lives behind.
    open({ ...base, spells: Array.from({ length: 9 }, () => base.spells[0]) });
    fireEvent.click(screen.getByTestId('view-all-spells'));
    const row = within(section('spells')).getAllByRole('listitem')[0];
    expect(row).toHaveTextContent(copy.spellTags(['Interrupt', 'Passive']) as string);
    expect(row).toHaveTextContent(copy.spellMana(2));
    expect(row).toHaveTextContent('Heal 2 HB slots.');
    expect(row).toHaveTextContent(copy.spellUpgrade(5, 'Heal 3 HB slots instead.'));
  });
});

/* ------------------------------------------------------------ 009: mana */

describe('the record’s MANA row', () => {
  it('sits inside VITALS with one segment per point and a mono current/max', () => {
    open(dossierAt(0, 'psychic'));
    const vitals = within(section('vitals'));
    expect(vitals.getByText(copy.vitalsMana)).toBeInTheDocument();
    const strip = vitals.getByTestId('mana-segments');
    expect(strip).toHaveAttribute('role', 'img');
    expect(strip).toHaveAttribute('aria-label', copy.manaAria(5, 5));
    expect(vitals.getAllByTestId('mana-segment')).toHaveLength(5);
    expect(screen.getByTestId('dossier-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('follows the playhead in both directions', () => {
    const { rerender } = open(dossierAt(171, 'psychic'));
    expect(screen.getByTestId('dossier-mana')).toHaveTextContent(copy.hpValue(2, 5));
    expect(
      screen.getAllByTestId('mana-segment').filter((seg) => seg.dataset.filled === 'true'),
    ).toHaveLength(2);

    // The page recomputes and re-renders; the record has nothing to undo.
    rerender(
      <FullRecordDialog
        dossier={dossierAt(0, 'psychic')}
        meta={meta}
        open
        onClose={vi.fn()}
        returnFocusTo={null}
      />,
    );
    expect(screen.getByTestId('dossier-mana')).toHaveTextContent(copy.hpValue(5, 5));
  });

  it('shows the derived pool for a crawler whose sheet writes no box', () => {
    // Harry has INT 6 and no mana box.
    open(dossierAt(0));
    expect(within(section('vitals')).getAllByTestId('mana-segment')).toHaveLength(6);
    expect(screen.getByTestId('dossier-mana')).toHaveTextContent(copy.hpValue(6, 6));
  });

  it('drops the row entirely for a crawler with no pool, HP untouched', () => {
    open(dossierAt(0, 'xo'));
    const vitals = within(section('vitals'));
    expect(vitals.queryByTestId('mana-segments')).toBeNull();
    expect(screen.queryByTestId('dossier-mana')).toBeNull();
    expect(vitals.queryByText(copy.vitalsMana)).toBeNull();
    expect(vitals.getAllByTestId('hp-segment')).toHaveLength(10);
    expect(screen.getByTestId('dossier-hp')).toHaveTextContent(copy.hpValue(18, 18));
  });
});
