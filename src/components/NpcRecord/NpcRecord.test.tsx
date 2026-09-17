// @vitest-environment jsdom
/**
 * The entity record (T709, FR-611, research R4). Every record here is built by
 * `npcRecord` from the shared fixture, so what the panel shows and what the
 * selector says are asserted against the same event log.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NpcRecord } from './NpcRecord';
import type { NpcRecordView } from '../../engine/selectors';
import { npcRecord } from '../../engine/selectors';
import { reduceTo } from '../../engine/reducer';
import { formatTime } from '../../engine/time';
import { copy } from '../../copy';
import { makeEpisode, makeRegistry } from '../../test/fixtures';

const episode = makeEpisode(1);
const party = episode.initialState.party;
const registry = makeRegistry();

function recordAt(t: number, id = 'hoarder'): NpcRecordView {
  const view = npcRecord(reduceTo(episode, t), episode.events, registry, id, party, t);
  if (view === null) throw new Error(`no record for ${id} at ${t}`);
  return view;
}

function renderRecord(record: NpcRecordView) {
  const onSeek = vi.fn();
  const onShare = vi.fn();
  const view = render(
    <MemoryRouter>
      <NpcRecord record={record} episodeId={1} onSeek={onSeek} onShare={onShare} />
    </MemoryRouter>,
  );
  return { ...view, onSeek, onShare };
}

const facts = () => screen.queryAllByTestId('npc-fact');
const moments = () => screen.queryAllByTestId('npc-moment');

describe('NpcRecord', () => {
  it('heads the record with the entity, its kind and its floor', () => {
    renderRecord(recordAt(200));

    const record = screen.getByTestId('npc-record');
    expect(record).toHaveAttribute('data-npc', 'hoarder');
    expect(record).toHaveAttribute('data-kind', 'boss');
    expect(screen.getByTestId('npc-name')).toHaveTextContent('The Hoarder');
    expect(screen.getByText(copy.kindLabels.boss)).toBeInTheDocument();
    expect(screen.getByText(copy.floorLabel(1))).toBeInTheDocument();
    expect(screen.getByTestId('npc-intro')).toHaveTextContent(
      'Something in Quadrant C has been stacking crates into walls.',
    );
  });

  it('releases only the facts unlocked at the playhead', () => {
    const { rerender } = renderRecord(recordAt(120));
    // 122 unlocks the lair, 185 the weakness: neither has elapsed yet.
    expect(facts()).toHaveLength(0);
    expect(screen.getByTestId('npc-facts-empty')).toHaveTextContent(copy.npcFactsEmpty);

    const again = (t: number) =>
      rerender(
        <MemoryRouter>
          <NpcRecord record={recordAt(t)} episodeId={1} onSeek={vi.fn()} onShare={vi.fn()} />
        </MemoryRouter>,
      );

    again(150);
    expect(facts().map((fact) => fact.getAttribute('data-fact'))).toEqual(['lair']);
    expect(screen.queryByTestId('npc-facts-empty')).not.toBeInTheDocument();

    again(200);
    expect(facts().map((fact) => fact.getAttribute('data-fact'))).toEqual(['lair', 'weakness']);
    expect(within(screen.getByTestId('npc-facts')).getByText('It cannot see red.')).toBeInTheDocument();

    // And a backward seek takes them away again (constitution I).
    again(130);
    expect(facts().map((fact) => fact.getAttribute('data-fact'))).toEqual(['lair']);
  });

  it('says nothing further about an entity with no facts at all', () => {
    renderRecord(recordAt(200, 'grull-rep'));

    expect(facts()).toHaveLength(0);
    expect(screen.getByTestId('npc-facts-empty')).toHaveTextContent(copy.npcFactsEmpty);
  });

  it('turns the status line over once the entity is defeated', () => {
    const { rerender } = renderRecord(recordAt(190));
    expect(screen.queryByTestId('npc-status')).toBeNull();
    expect(screen.getByTestId('npc-record')).not.toHaveAttribute('data-defeated');

    rerender(
      <MemoryRouter>
        <NpcRecord record={recordAt(200)} episodeId={1} onSeek={vi.fn()} onShare={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('npc-status')).toHaveTextContent(copy.npcDefeated);
    expect(screen.getByTestId('npc-record')).toHaveAttribute('data-defeated', 'true');
  });

  it('lists every moment about the entity, newest first, each one seekable', () => {
    const { onSeek, onShare } = renderRecord(recordAt(200));

    // 118 met, 122 update, 185 update, 195 defeated.
    expect(moments()).toHaveLength(4);
    const [newest] = moments();
    expect(within(newest).getByTestId('feed-time')).toHaveTextContent(formatTime(195));
    expect(within(newest).getByText(copy.feedText.npcDefeated('The Hoarder'))).toBeInTheDocument();

    const seek = within(newest).getByRole('button', {
      name: copy.feedSeek(
        formatTime(195),
        `${copy.labels.npc} · ${copy.feedText.npcDefeated('The Hoarder')}`,
      ),
    });
    fireEvent.click(seek);
    expect(onSeek).toHaveBeenCalledWith(195);

    fireEvent.click(within(newest).getByTestId('share-row'));
    expect(onShare).toHaveBeenCalledWith(195);
    // Sharing never moves the broadcast (004 FR-306).
    expect(onSeek).toHaveBeenCalledTimes(1);
  });

  it('links into the Registry at this entity (US1 scenario 6)', () => {
    renderRecord(recordAt(200));

    const link = screen.getByTestId('npc-registry-link');
    expect(link).toHaveTextContent(copy.npcOpenRegistry);
    // Scoped to the episode being watched (R2 scenario 5): the Registry opens
    // at this entry holding nothing this viewer has not reached.
    expect(link).toHaveAttribute('href', '/codex?scope=through-1#hoarder');
  });

  it('carries whichever episode it is rendered on into the scope', () => {
    const onSeek = vi.fn();
    render(
      <MemoryRouter>
        <NpcRecord record={recordAt(200)} episodeId={3} onSeek={onSeek} onShare={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('npc-registry-link')).toHaveAttribute(
      'href',
      '/codex?scope=through-3#hoarder',
    );
  });

  /* --- Revision 3 (T724): beside the broadcast it opens the panel instead --- */

  it('opens the Registry panel rather than leaving, when it is given the handler', () => {
    const onOpenRegistry = vi.fn();
    render(
      <MemoryRouter>
        <NpcRecord
          record={recordAt(200)}
          episodeId={1}
          onSeek={vi.fn()}
          onShare={vi.fn()}
          onOpenRegistry={onOpenRegistry}
        />
      </MemoryRouter>,
    );

    // No link at all: nothing in the record now leaves the episode page.
    expect(screen.queryByTestId('npc-registry-link')).toBeNull();
    const button = screen.getByTestId('npc-registry-open');
    expect(button).toHaveTextContent(copy.npcOpenRegistry);
    expect(button).toHaveAttribute('aria-controls', 'rail-panel');

    fireEvent.click(button);
    expect(onOpenRegistry).toHaveBeenCalledWith('hoarder');
  });
});
