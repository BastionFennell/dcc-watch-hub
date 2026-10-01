import { describe, expect, it } from 'vitest';
import { makeEpisodeRaw, makeRegistry, makeSpells } from '../test/fixtures';
import type { DraftMeta, RawEvent, StudioDraft } from './draft';
import { draftFromEpisode, newDraft } from './draft';
import type { StudioRegistries } from './options';
import { countIssues, issuesFor } from './validateDraft';

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

const registries: StudioRegistries = { npcs: makeRegistry(), spells: makeSpells() };

/** A minimal valid draft: one crawler, one map, and whatever events are given. */
function draftWith(events: RawEvent[], meta: Partial<DraftMeta> = {}): StudioDraft {
  return draftFromEpisode(
    { ...META, ...meta },
    {
      initialState: {
        party: [
          {
            id: 'harry',
            name: 'Harry',
            handle: 'Harry',
            player: 'Marcus',
            level: 2,
            hp: { current: 10, max: 10 },
            portrait: '/img/harry.svg',
            class: null,
            inventory: [],
            rank: null,
          },
        ],
        map: { floor: 1, grid: { cols: 12, rows: 8 }, revealed: [] },
      },
      events,
    },
  );
}

const messages = (draft: StudioDraft, regs?: StudioRegistries) =>
  issuesFor(draft, regs).map((issue) => `${issue.severity}: ${issue.message}`);

describe('issuesFor - the file', () => {
  it('is silent on a healthy draft', () => {
    expect(issuesFor(draftWith([{ t: 10, type: 'note', text: 'ok' }]))).toEqual([]);
  });

  it('reports missing meta', () => {
    const draft = draftWith([], { youtubeId: '  ', title: '', durationSec: 0 });
    const issues = issuesFor(draft);
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(2);
    expect(messages(draft).join('\n')).toMatch(/no YouTube video id/);
    expect(messages(draft).join('\n')).toMatch(/no title/);
    expect(messages(draft).join('\n')).toMatch(/warning: The episode duration is 0/);
  });

  it('warns about an empty party and reports the initial state it cannot use', () => {
    const issues = issuesFor(newDraft(META));
    expect(issues.some((issue) => issue.message === 'The party is empty.')).toBe(true);
    expect(
      issues.some(
        (issue) => issue.severity === 'error' && issue.message.startsWith('The initial state'),
      ),
    ).toBe(true);
  });
});

describe('issuesFor - the events', () => {
  it('reports a known type the viewer would drop, pointing at the event', () => {
    const draft = draftWith([{ t: 10, type: 'hp', actor: 'harry', current: 4 }]);
    const issues = issuesFor(draft);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toBe(
      'HB at 0:10 is missing something it needs; the viewer will ignore it.',
    );
    expect(issues[0].uid).toBe(draft.events[0].uid);
  });

  it('only warns about a type from a later schema', () => {
    const issues = issuesFor(draftWith([{ t: 10, type: 'future_type', headline: 'later' }]));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toMatch(/does not know/);
  });

  it('reports an actor who is not in the party', () => {
    const issues = issuesFor(
      draftWith([{ t: 10, type: 'loot', actor: 'ghost', item: 'Torch' }]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toMatch(/"ghost", who is not in the party/);
  });

  it('reports a time outside the video', () => {
    expect(messages(draftWith([{ t: 600, type: 'note', text: 'late' }]))).toEqual([
      'error: Note at 10:00 is past the end of the video (4:00).',
    ]);
    // With no duration yet there is nothing to compare against.
    expect(
      messages(draftWith([{ t: 600, type: 'note', text: 'late' }], { durationSec: 0 })).filter(
        (message) => message.includes('past the end'),
      ),
    ).toEqual([]);
  });

  it('reports a negative time', () => {
    const draft = draftWith([]);
    draft.events.push({ uid: 'neg', event: { t: -5, type: 'note', text: 'x' } });
    expect(messages(draft)).toContain('error: Note at 0:00 has a negative time.');
  });

  it('warns about a spell ref the registry has not got, only when it is loaded', () => {
    const events: RawEvent[] = [
      { t: 10, type: 'spell', actor: 'harry', ref: 'not-a-spell' },
      { t: 11, type: 'spell', actor: 'harry', ref: 'mending-light' },
    ];
    expect(messages(draftWith(events), registries)).toEqual([
      'warning: Spell at 0:10 points at spell "not-a-spell", which the spell registry has not got.',
    ]);
    expect(messages(draftWith(events))).toEqual([]);
  });

  it('warns about an entity the registry has not got, only when it is loaded', () => {
    const events: RawEvent[] = [
      { t: 10, type: 'npc', id: 'unknown-id', action: 'met' },
      { t: 11, type: 'npc', id: 'hoarder', action: 'met' },
    ];
    expect(messages(draftWith(events), registries)).toEqual([
      'warning: Entity at 0:10 is about "unknown-id", which the entity registry has not got.',
    ]);
    expect(messages(draftWith(events))).toEqual([]);
  });

  it('warns about an exact duplicate, on the second one', () => {
    const draft = draftWith([
      { t: 10, type: 'loot', actor: 'harry', item: 'Torch' },
      { t: 10, type: 'loot', item: 'Torch', actor: 'harry' },
      { t: 12, type: 'loot', actor: 'harry', item: 'Torch' },
    ]);
    const issues = issuesFor(draft);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].uid).toBe(draft.events[1].uid);
  });
});

describe('issuesFor - published episodes', () => {
  it('finds nothing but the deliberate future-schema row in the fixture episode', () => {
    const draft = draftFromEpisode(META, makeEpisodeRaw());
    const issues = issuesFor(draft, registries);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    // The fixture carries one future type and one entity the registry omits.
    expect(issues).toHaveLength(2);
    expect(countIssues(issues)).toEqual({ errors: 0, warnings: 2 });
  });
});
