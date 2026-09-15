import { describe, expect, it } from 'vitest';
import {
  DataError,
  isEpisodeData,
  isShow,
  normalizeEpisode,
  normalizeEvent,
  sortEvents,
  toNumber,
} from './validate';
import type { AnyEvent } from './types';
import { makeShow, makeEpisode } from '../test/fixtures';

describe('normalizeEvent', () => {
  it('keeps a well-formed known event', () => {
    expect(normalizeEvent({ t: 10, type: 'note', text: 'hello' })).toEqual({
      t: 10,
      type: 'note',
      text: 'hello',
    });
  });

  it('demotes an unknown event type to `unknown` without throwing', () => {
    const event = normalizeEvent({ t: 100, type: 'future_type', payload: 1 });
    expect(event.type).toBe('unknown');
    expect(event.t).toBe(100);
  });

  it('demotes a malformed hp event to `unknown`', () => {
    expect(normalizeEvent({ t: 5, type: 'hp', actor: 'harry', current: 'x' }).type).toBe(
      'unknown',
    );
    expect(normalizeEvent({ t: 5, type: 'hp', current: 3, max: 10 }).type).toBe('unknown');
  });

  it('demotes a non-object and a typeless row to `unknown`', () => {
    expect(normalizeEvent(null).type).toBe('unknown');
    expect(normalizeEvent('nope').type).toBe('unknown');
    expect(normalizeEvent({ t: 4 }).type).toBe('unknown');
  });

  it('coerces numeric strings and clamps negative t to 0', () => {
    expect(normalizeEvent({ t: '12', type: 'level_up', actor: 'xo', level: '3' })).toEqual({
      t: 12,
      type: 'level_up',
      actor: 'xo',
      level: 3,
    });
    const clamped = normalizeEvent({ t: -4, type: 'note', text: 'early' });
    expect(clamped.t).toBe(0);
  });

  it('accepts a crawler-scoped rank only with an actor', () => {
    expect(normalizeEvent({ t: 1, type: 'rank', scope: 'crawler', rank: 5 }).type).toBe('unknown');
    expect(normalizeEvent({ t: 1, type: 'rank', scope: 'crawler', rank: 5, actor: 'xo' })).toEqual({
      t: 1,
      type: 'rank',
      scope: 'crawler',
      rank: 5,
      actor: 'xo',
    });
  });

  it('rejects a sponsor without a positive duration', () => {
    expect(normalizeEvent({ t: 1, type: 'sponsor', text: 'x', durationSec: 0 }).type).toBe(
      'unknown',
    );
  });
});

describe('sortEvents', () => {
  it('sorts ascending and is stable for equal t (file order wins)', () => {
    const events: AnyEvent[] = [
      { t: 10, type: 'note', text: 'c' },
      { t: 5, type: 'note', text: 'a' },
      { t: 10, type: 'note', text: 'd' },
      { t: 5, type: 'note', text: 'b' },
    ];
    expect(sortEvents(events).map((e) => (e.type === 'note' ? e.text : ''))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('guards', () => {
  it('accepts the fixtures', () => {
    expect(isShow(makeShow())).toBe(true);
    expect(isEpisodeData(makeEpisode())).toBe(true);
  });

  it('rejects junk', () => {
    expect(isShow({})).toBe(false);
    expect(isEpisodeData({ episodeId: 1, events: [] })).toBe(false);
    expect(() => normalizeEpisode({ nope: true })).toThrow(DataError);
  });

  it('normalizeEpisode sorts and normalizes events', () => {
    const episode = normalizeEpisode({
      episodeId: 1,
      initialState: makeEpisode().initialState,
      events: [
        { t: 20, type: 'nonsense' },
        { t: 5, type: 'note', text: 'first' },
      ],
    });
    expect(episode.events.map((e) => e.t)).toEqual([5, 20]);
    expect(episode.events[1].type).toBe('unknown');
  });
});

describe('toNumber', () => {
  it('handles numbers, numeric strings, and rejects the rest', () => {
    expect(toNumber(3)).toBe(3);
    expect(toNumber(' 4.5 ')).toBe(4.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});
