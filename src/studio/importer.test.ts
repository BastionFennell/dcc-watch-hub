import { describe, expect, it } from 'vitest';
import { eventsOf, fromEpisodeJson, StudioImportError } from './importer';

const EPISODE = {
  episodeId: 3,
  initialState: {
    party: [{ id: 'harry', name: 'Harry' }],
    map: { floor: 2, grid: { cols: 12, rows: 8 }, revealed: [] },
  },
  events: [
    { t: 30, type: 'note', text: 'second' },
    { t: 10, type: 'note', text: 'first' },
  ],
};

describe('fromEpisodeJson', () => {
  it('takes a JSON string or a parsed object', () => {
    const fromText = fromEpisodeJson(JSON.stringify(EPISODE));
    const fromObject = fromEpisodeJson(EPISODE);
    expect(fromText.draft.events.map((entry) => entry.event.text)).toEqual(['first', 'second']);
    expect(fromObject.draft.events).toHaveLength(2);
  });

  it('reads the id and floor from the file when no guess is given', () => {
    const { draft, warnings } = fromEpisodeJson(EPISODE);
    expect(draft.meta.id).toBe(3);
    expect(draft.meta.floor).toBe(2);
    expect(draft.meta.title).toBe('Episode 3');
    expect(warnings).toContain('No video id came with the file; set one before exporting.');
  });

  it('lets the guess win, and says so when the file disagrees', () => {
    const { draft, warnings } = fromEpisodeJson(EPISODE, {
      id: 9,
      title: 'Episode 9 - Down',
      youtubeId: 'aqz-KE-bpKQ',
      floor: 5,
      durationSec: 700,
    });
    expect(draft.meta).toEqual({
      id: 9,
      title: 'Episode 9 - Down',
      youtubeId: 'aqz-KE-bpKQ',
      floor: 5,
      durationSec: 700,
    });
    expect(warnings.join('\n')).toMatch(/file says episode 3 but it was opened as episode 9/);
  });

  it('warns about a missing episodeId and a missing initial state', () => {
    const { draft, warnings } = fromEpisodeJson({ events: [] });
    expect(draft.meta.id).toBe(0);
    expect(draft.meta.title).toBe('Untitled episode');
    expect(warnings.join('\n')).toMatch(/no episodeId/);
    expect(warnings.join('\n')).toMatch(/no initial state/);
  });

  it('drops rows that are not events and counts them', () => {
    const { draft, warnings } = fromEpisodeJson({
      ...EPISODE,
      events: [{ t: 1, type: 'note', text: 'ok' }, 'junk', null, { t: 2 }],
    });
    expect(draft.events).toHaveLength(1);
    expect(warnings.join('\n')).toMatch(/3 rows had no usable time or type/);
  });

  it('warns about a row the viewer would drop, and one from a later schema', () => {
    const { warnings } = fromEpisodeJson({
      ...EPISODE,
      events: [
        { t: 5, type: 'hp', actor: 'harry', current: 4 },
        { t: 6, type: 'future_type', headline: 'later' },
      ],
    });
    expect(warnings).toContain('The hp row at 0:05 is missing something it needs.');
    expect(warnings.join('\n')).toMatch(/type "future_type", which this build does not know/);
  });

  it('throws only when the file is not an episode at all', () => {
    expect(() => fromEpisodeJson('{not json')).toThrow(StudioImportError);
    expect(() => fromEpisodeJson('[]')).toThrow(/not an episode object/);
    expect(() => fromEpisodeJson('"a string"')).toThrow(/not an episode object/);
    expect(() => fromEpisodeJson({ episodeId: 1 })).toThrow(/no "events" array/);
  });
});

describe('eventsOf', () => {
  it('reads the raw log of a parsed episode', () => {
    expect(eventsOf(EPISODE)).toHaveLength(2);
    expect(eventsOf({ events: [{ t: '10', type: 'note' }] })).toEqual([{ t: 10, type: 'note' }]);
    expect(eventsOf(null)).toEqual([]);
    expect(eventsOf({ events: 'no' })).toEqual([]);
  });
});
