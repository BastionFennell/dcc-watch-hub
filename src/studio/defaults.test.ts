import { describe, expect, it } from 'vitest';
import { KNOWN_EVENT_TYPES } from '../data/types';
import { makeEpisodeRaw } from '../test/fixtures';
import { defaultsFor, nextRankFor } from './defaults';
import type { DraftMeta } from './draft';
import { draftFromEpisode, newDraft } from './draft';
import { EVENT_FORMS } from './eventForms';
import { stateAt } from './options';

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

const draft = draftFromEpisode(META, makeEpisodeRaw());

describe('defaultsFor (FR-1004)', () => {
  it('prefills hp with the crawler current values at that second', () => {
    expect(defaultsFor('hp', 'harry', stateAt(draft, 100))).toEqual({
      actor: 'harry',
      current: 4,
      max: 22,
    });
    expect(defaultsFor('hp', 'harry', stateAt(draft, 175))).toEqual({
      actor: 'harry',
      current: 20,
      max: 22,
    });
  });

  it('prefills mana from the pool, and leaves it out when there is none', () => {
    expect(defaultsFor('mana', 'psychic', stateAt(draft, 171.5))).toEqual({
      actor: 'psychic',
      current: 2,
      max: 5,
    });
    // X.O. has no mana box and no INT, so there is no pool to read.
    expect(defaultsFor('mana', 'xo', stateAt(draft, 100))).toEqual({ actor: 'xo' });
  });

  it('prefills level_up with the next level', () => {
    expect(defaultsFor('level_up', 'xo', stateAt(draft, 60))).toEqual({ actor: 'xo', level: 2 });
    expect(defaultsFor('level_up', 'xo', stateAt(draft, 75))).toEqual({ actor: 'xo', level: 3 });
  });

  it('prefills rank and class only when the crawler has one', () => {
    expect(defaultsFor('rank', 'harry', stateAt(draft, 160))).toEqual({
      actor: 'harry',
      rank: 3012,
    });
    expect(defaultsFor('rank', 'harry', stateAt(draft, 50))).toEqual({ actor: 'harry' });
    expect(defaultsFor('class', 'harry', stateAt(draft, 100))).toEqual({
      actor: 'harry',
      class: 'Compensated Anarchist',
    });
    expect(defaultsFor('class', 'harry', stateAt(draft, 50))).toEqual({ actor: 'harry' });
  });

  it('opens the list events with empty lists and the world events with a kind', () => {
    const state = stateAt(draft, 100);
    expect(defaultsFor('inventory', 'harry', state)).toEqual({
      actor: 'harry',
      add: [],
      remove: [],
    });
    expect(defaultsFor('chapter', undefined, state)).toEqual({ kind: 'story' });
    expect(defaultsFor('map_reveal', undefined, state)).toEqual({ cells: [] });
    // An entity beat belongs to the party by default, not to the sticky actor.
    expect(defaultsFor('npc', 'harry', state)).toEqual({ action: 'met' });
  });

  it('carries the sticky actor into every type that has one', () => {
    const state = stateAt(draft, 100);
    for (const type of KNOWN_EVENT_TYPES) {
      const hasActor = EVENT_FORMS[type].fields.some((field) => field.key === 'actor');
      const values = defaultsFor(type, 'harry', state);
      if (hasActor && type !== 'npc') expect(values.actor, type).toBe('harry');
      else expect(values.actor, type).toBeUndefined();
    }
  });

  it('never throws without state, an actor, or a normalizable draft', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      expect(defaultsFor(type, undefined, null)).toBeTypeOf('object');
      expect(defaultsFor(type, 'ghost', stateAt(newDraft(META), 0))).toBeTypeOf('object');
    }
  });
});

describe('nextRankFor', () => {
  it('offers one past the rank the actor holds', () => {
    // X.O. takes Understudy Strike to rank 1 at t = 80.
    expect(nextRankFor(stateAt(draft, 100), 'xo', 'skill', 'Understudy Strike')).toBe(2);
    expect(nextRankFor(stateAt(draft, 165), 'xo', 'skill', 'Understudy Strike')).toBe(3);
  });

  it('offers nothing for a skill the actor has not got yet', () => {
    expect(nextRankFor(stateAt(draft, 100), 'xo', 'skill', 'Brand New')).toBeUndefined();
    expect(nextRankFor(stateAt(draft, 100), 'xo', 'skill', undefined)).toBeUndefined();
    expect(nextRankFor(null, 'xo', 'skill', 'Understudy Strike')).toBeUndefined();
  });

  it('counts a rankless entry as rank 0', () => {
    // "Swamp Step" is logged at 148 with no rank at all.
    expect(nextRankFor(stateAt(draft, 150), 'xo', 'skill', 'Swamp Step')).toBe(1);
  });

  it('keys a spell by its ref when it has one, and its name otherwise', () => {
    expect(nextRankFor(stateAt(draft, 100), 'psychic', 'spell', 'Second Sight')).toBe(3);
    expect(nextRankFor(stateAt(draft, 100), 'psychic', 'spell', 'second-sight')).toBeUndefined();
  });
});
