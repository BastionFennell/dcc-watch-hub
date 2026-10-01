/**
 * The dossier's rules (012), one test per rule the build enforces and one per
 * hole the compiler fills.
 *
 * The compile tests are where the feature's invariant is actually proved:
 * **one card per aired episode, always**, for an author who wrote everything,
 * an author who wrote nothing, and an author who wrote a card for an episode
 * nobody has seen yet.
 */
import { describe, expect, it } from 'vitest';
import type { AuthoredUpdate, Show } from '../src/data/types';
import {
  MAX_CHIPS,
  MAX_TITLE_LENGTH,
  airedEpisodes,
  compileDossier,
  lintUpdates,
  parseAuthored,
} from './dossier';
import { quietBody, quietTitle } from '../src/site/dossier/quiet';
import { makeShow } from '../src/test/fixtures';

const NOW = Date.parse('2026-09-20T00:00:00.000Z');

/** The fixture show, with a `hubLiveAt` per episode: 3 has not aired at NOW. */
function gatedShow(): Show {
  const show = makeShow();
  const gates = ['2026-08-15T17:00:00Z', '2026-08-29T17:00:00Z', '2026-10-10T17:00:00Z'];
  show.episodes = show.episodes.map((episode, index) => ({
    ...episode,
    hubLiveAt: gates[index],
  }));
  return show;
}

function card(overrides: Partial<AuthoredUpdate> = {}): AuthoredUpdate {
  return {
    episode: 1,
    kind: 'update',
    onCamera: true,
    title: 'A title in the present tense',
    body: 'A body in the present tense.',
    chips: ['ONE FACT'],
    level: null,
    condition: 'alive',
    ...overrides,
  };
}

const ALL = [1, 2, 3];

describe('parseAuthored', () => {
  it('reads a well-formed file', () => {
    const raw = { id: 'harry', updates: [card({ episode: 2, level: 4 })] };
    const parsed = parseAuthored(raw, 'harry');
    expect(parsed.errors).toEqual([]);
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.updates[0]).toMatchObject({ episode: 2, level: 4, kind: 'update' });
  });

  it('refuses a file that is not an object, or has no updates array', () => {
    expect(parseAuthored(null, 'harry').errors).toHaveLength(1);
    expect(parseAuthored([], 'harry').errors).toHaveLength(1);
    expect(parseAuthored({ id: 'harry' }, 'harry').errors).toHaveLength(1);
  });

  it('refuses a file whose id is not its own name', () => {
    const parsed = parseAuthored({ id: 'mimi', updates: [] }, 'harry');
    expect(parsed.errors.join(' ')).toMatch(/"id" is "mimi", expected "harry"/);
  });

  it('names every field it cannot read, and keeps the card out', () => {
    const raw = {
      id: 'harry',
      updates: [
        { episode: '1', kind: 'news', onCamera: 'yes', title: 1, body: null, chips: 'a', level: 1.5, condition: 'fine' },
      ],
    };
    const parsed = parseAuthored(raw, 'harry');
    expect(parsed.updates).toEqual([]);
    for (const field of ['episode', 'kind', 'onCamera', 'title', 'body', 'chips', 'level', 'condition']) {
      expect(parsed.errors.join('\n'), field).toContain(`"${field}"`);
    }
  });

  it('takes a null level, which is how an author asks for the reducer', () => {
    const parsed = parseAuthored({ id: 'harry', updates: [card({ level: null })] }, 'harry');
    expect(parsed.errors).toEqual([]);
    expect(parsed.updates[0].level).toBeNull();
  });
});

describe('lintUpdates', () => {
  it('passes a clean, ascending, fully aired file', () => {
    const result = lintUpdates([card({ episode: 1 }), card({ episode: 2 })], ALL, ALL);
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('passes a file with gaps: a missing aired episode is the compiler s job', () => {
    expect(lintUpdates([card({ episode: 3 })], ALL, ALL).errors).toEqual([]);
  });

  it('fails an episode show.json has never heard of', () => {
    const result = lintUpdates([card({ episode: 9 })], ALL, ALL);
    expect(result.errors.join(' ')).toMatch(/episode 9: no such episode/);
  });

  it('fails two cards for the same episode', () => {
    const result = lintUpdates([card({ episode: 1 }), card({ episode: 1 })], ALL, ALL);
    expect(result.errors.join(' ')).toMatch(/a second card for the same episode/);
  });

  it('fails cards that do not ascend', () => {
    const result = lintUpdates([card({ episode: 3 }), card({ episode: 2 })], ALL, ALL);
    expect(result.errors.join(' ')).toMatch(/out of order/);
  });

  it('fails an empty title or body', () => {
    const result = lintUpdates([card({ title: '   ', body: '' })], ALL, ALL);
    expect(result.errors.join(' ')).toMatch(/the title is empty/);
    expect(result.errors.join(' ')).toMatch(/the body is empty/);
  });

  it(`fails a title over ${String(MAX_TITLE_LENGTH)} characters`, () => {
    const ok = lintUpdates([card({ title: 'x'.repeat(MAX_TITLE_LENGTH) })], ALL, ALL);
    expect(ok.errors).toEqual([]);
    const tooLong = lintUpdates([card({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })], ALL, ALL);
    expect(tooLong.errors.join(' ')).toMatch(/the title is 61 characters/);
  });

  it(`fails more than ${String(MAX_CHIPS)} chips, and any empty one`, () => {
    const tooMany = lintUpdates([card({ chips: ['a', 'b', 'c', 'd'] })], ALL, ALL);
    expect(tooMany.errors.join(' ')).toMatch(/4 chips/);
    const empty = lintUpdates([card({ chips: ['a', ' '] })], ALL, ALL);
    expect(empty.errors.join(' ')).toMatch(/an empty chip/);
  });

  it('fails a level below 1', () => {
    expect(lintUpdates([card({ level: 0 })], ALL, ALL).errors.join(' ')).toMatch(/below 1/);
  });

  it('fails a condition that goes back to alive: death is sticky', () => {
    const result = lintUpdates(
      [card({ episode: 1, condition: 'deceased' }), card({ episode: 2, condition: 'alive' })],
      ALL,
      ALL,
    );
    expect(result.errors.join(' ')).toMatch(/condition returns to "alive" after episode 1/);
  });

  it('allows a run of deceased cards, which is the posthumous feed', () => {
    const result = lintUpdates(
      [
        card({ episode: 1, condition: 'deceased' }),
        card({ episode: 2, condition: 'deceased' }),
        card({ episode: 3, condition: 'deceased' }),
      ],
      ALL,
      ALL,
    );
    expect(result.errors).toEqual([]);
  });

  it('warns - and does not fail - on a card for an episode that has not aired', () => {
    const result = lintUpdates([card({ episode: 3 })], [1, 2], ALL);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/episode 3: has not aired yet/);
  });

  it('warns on a quiet card that claims screen time', () => {
    const result = lintUpdates([card({ kind: 'quiet', onCamera: true })], ALL, ALL);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/quiet card marked onCamera/);
  });
});

describe('airedEpisodes', () => {
  it('is the episodes past their hubLiveAt, ascending', () => {
    expect(airedEpisodes(gatedShow(), NOW).map((episode) => episode.id)).toEqual([1, 2]);
  });

  it('is empty before anything has aired', () => {
    expect(airedEpisodes(gatedShow(), Date.parse('2026-01-01T00:00:00Z'))).toEqual([]);
  });
});

describe('compileDossier', () => {
  const crawler = { id: 'harry', characterName: 'Harold Wallace' };
  const levels = (episodeId: number) => (episodeId === 1 ? 2 : 3);

  function compile(authored: AuthoredUpdate[], now = NOW) {
    return compileDossier({ crawler, show: gatedShow(), authored, levelAt: levels, now });
  }

  it('emits exactly one card per aired episode, ascending, for an empty file', () => {
    const file = compile([]);
    expect(file.id).toBe('harry');
    expect(file.generatedAt).toBe(new Date(NOW).toISOString());
    expect(file.updates.map((update) => update.episode)).toEqual([1, 2]);
    for (const update of file.updates) {
      expect(update.kind).toBe('quiet');
      expect(update.onCamera).toBe(false);
      expect(update.title).toBe(quietTitle);
      expect(update.body).toBe(quietBody('Harold Wallace'));
      expect(update.chips).toEqual([]);
    }
  });

  it('never ships a card for an episode that has not aired', () => {
    const file = compile([card({ episode: 3, title: 'Not yet' })]);
    expect(file.updates.map((update) => update.episode)).toEqual([1, 2]);
    expect(JSON.stringify(file)).not.toContain('Not yet');
  });

  it('takes floor from show.json rather than from the author', () => {
    const file = compile([card({ episode: 1 }), card({ episode: 2 })]);
    expect(file.updates.map((update) => update.floor)).toEqual([1, 1]);
  });

  it('fills a null level from the reducer and keeps an authored one', () => {
    const file = compile([card({ episode: 1, level: null }), card({ episode: 2, level: 9 })]);
    expect(file.updates.map((update) => update.level)).toEqual([2, 9]);
  });

  /*
   * Each episode file opens its party at its own initialState, so a later
   * episode can report a smaller level without anything having happened.
   */
  it('treats a derived level as a high-water mark', () => {
    const file = compileDossier({
      crawler,
      show: gatedShow(),
      authored: [],
      levelAt: (episodeId) => (episodeId === 1 ? 5 : 1),
      now: NOW,
    });
    expect(file.updates.map((update) => update.level)).toEqual([5, 5]);
  });

  it('carries the last known level into a generated card', () => {
    const file = compileDossier({
      crawler,
      show: gatedShow(),
      authored: [card({ episode: 1, level: 7 })],
      levelAt: () => null,
      now: NOW,
    });
    expect(file.updates.map((update) => update.level)).toEqual([7, 7]);
  });

  it('keeps generating cards after a death, and keeps the condition', () => {
    const file = compile([card({ episode: 1, condition: 'deceased' })]);
    expect(file.updates).toHaveLength(2);
    expect(file.updates.map((update) => update.condition)).toEqual(['deceased', 'deceased']);
    // ... and the generated card is the same one everybody else gets.
    expect(file.updates[1].title).toBe(quietTitle);
  });

  it('is byte-identical between two crawlers with nothing authored, apart from the name', () => {
    const show = gatedShow();
    const one = compileDossier({ crawler, show, authored: [], levelAt: () => 1, now: NOW });
    const two = compileDossier({
      crawler: { id: 'mimi', characterName: 'Harold Wallace' },
      show,
      authored: [],
      levelAt: () => 1,
      now: NOW,
    });
    expect(JSON.stringify(one.updates)).toBe(JSON.stringify(two.updates));
  });

  it('is empty, not broken, before anything has aired', () => {
    const file = compile([card({ episode: 1 })], Date.parse('2026-01-01T00:00:00Z'));
    expect(file.updates).toEqual([]);
  });

  it('copies the chips rather than sharing the author s array', () => {
    const authored = card({ episode: 1, chips: ['ONE'] });
    const file = compile([authored]);
    file.updates[0].chips.push('TWO');
    expect(authored.chips).toEqual(['ONE']);
  });
});
