/**
 * The cast lint (014), one failing case per rule of spec FR-011, a clean case,
 * and the real files - so a broken `cast.json` or an over-budget photo fails
 * `npm test` as well as `npm run build`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_PHOTO_BUDGET, CREDIT_PHOTO_BUDGET, lintCast } from './cast';
import type { FileSize } from './cast';
import { publicFileSize } from './lint-cast';
import { makeCast, makeCrawlers } from '../src/test/fixtures';

/** Every photo exists and is well inside budget. */
const small: FileSize = () => 1_000;

function lint(
  patch: (cast: Record<string, unknown>[]) => void,
  fileSize: FileSize = small,
): string[] {
  const file = makeCast() as unknown as { cast: Record<string, unknown>[] };
  patch(file.cast);
  return lintCast(file, makeCrawlers(), fileSize);
}

describe('lintCast', () => {
  it('passes the fixture cast', () => {
    expect(lintCast(makeCast(), makeCrawlers(), small)).toEqual([]);
  });

  it('rejects a file with no cast array', () => {
    expect(lintCast({ members: [] }, makeCrawlers(), small)).toEqual([
      'cast.json: the file must be an object with a "cast" array.',
    ]);
    expect(lintCast(null, makeCrawlers(), small)).toHaveLength(1);
  });

  it('rejects an id that is not a lowercase slug', () => {
    const errors = lint((cast) => {
      cast[2].id = 'The Voice';
    });
    expect(errors).toEqual(['cast[2]: id "The Voice" is not a lowercase slug.']);
  });

  it('rejects a duplicated id', () => {
    const errors = lint((cast) => {
      cast[2].id = 'danny';
    });
    expect(errors).toEqual(['danny: the id is used by more than one member.']);
  });

  it('rejects an empty name', () => {
    expect(lint((cast) => void (cast[0].name = ''))).toEqual([
      'danny: "name" must be a non-empty string.',
    ]);
  });

  it('rejects a member with both a crawlerId and a role', () => {
    expect(lint((cast) => void (cast[0].role = 'Producer'))).toEqual([
      'danny: set exactly one of "crawlerId" and "role".',
    ]);
  });

  it('rejects a member with neither a crawlerId nor a role', () => {
    expect(lint((cast) => void delete cast[2].role)).toEqual([
      'voice: set exactly one of "crawlerId" and "role".',
    ]);
  });

  it('rejects a crawlerId that is not a crawler (and the crawler left unplayed)', () => {
    expect(lint((cast) => void (cast[1].crawlerId = 'nobody'))).toEqual([
      'marcus: crawlerId "nobody" is not a crawler in crawlers.json.',
      'harry: has no player in cast.json.',
    ]);
  });

  it('rejects a crawler with no player', () => {
    expect(lint((cast) => void cast.splice(1, 1))).toEqual(['harry: has no player in cast.json.']);
  });

  it('rejects a crawler with more than one player', () => {
    const errors = lint((cast) => {
      delete cast[2].role;
      cast[2].crawlerId = 'stuntman';
    });
    expect(errors).toEqual(['stuntman: has more than one player in cast.json.']);
  });

  it('rejects pronouns that are not in slash form', () => {
    expect(lint((cast) => void (cast[0].pronouns = 'He / Him'))).toEqual([
      'danny: pronouns "He / Him" are not in slash form ("she/they").',
    ]);
  });

  it('rejects an empty bio paragraph and a bio that is not a list', () => {
    expect(lint((cast) => void (cast[0].bio = ['One.', '']))).toEqual([
      'danny: bio[1] must be a non-empty string.',
    ]);
    expect(lint((cast) => void (cast[0].bio = 'One.'))).toEqual([
      'danny: "bio" must be an array of paragraphs ([] when not written yet).',
    ]);
  });

  it('rejects a link of an unknown kind', () => {
    expect(lint((cast) => void (cast[0].links = [{ kind: 'myspace', url: 'https://x.y' }]))).toEqual(
      ['danny: links[0]: kind "myspace" is not one of youtube, discord, tiktok, bluesky, instagram, links.'],
    );
  });

  it('rejects a link that is not an https address', () => {
    expect(lint((cast) => void (cast[0].links = [{ kind: 'links', url: 'http://x.y' }]))).toEqual([
      'danny: links[0]: url "http://x.y" is not an https:// address.',
    ]);
  });

  it('rejects a photo path that is missing or not rooted', () => {
    expect(lint((cast) => void (cast[0].photo = { card: 'danny.webp' }))).toEqual([
      'danny: photo.card must be a path starting with "/".',
      'danny: photo.credit must be a path starting with "/".',
    ]);
  });

  it('rejects a photo file that does not exist', () => {
    const errors = lint(
      () => {},
      (path) => (path === '/img/cast/marcus-sm.webp' ? null : 1_000),
    );
    expect(errors).toEqual([
      'marcus: photo.credit "/img/cast/marcus-sm.webp" does not exist under public/.',
    ]);
  });

  it('rejects photos over their budgets, and accepts them exactly at it', () => {
    const atBudget = (path: string) =>
      path.endsWith('-sm.webp') ? CREDIT_PHOTO_BUDGET : CARD_PHOTO_BUDGET;
    expect(lint(() => {}, atBudget)).toEqual([]);

    const errors = lint(
      () => {},
      (path) => {
        if (path === '/img/cast/danny.webp') return CARD_PHOTO_BUDGET + 1;
        if (path === '/img/cast/voice-sm.webp') return CREDIT_PHOTO_BUDGET + 1;
        return 1_000;
      },
    );
    expect(errors).toEqual([
      'danny: photo.card "/img/cast/danny.webp" is 45001 bytes; the budget is 45000.',
      'voice: photo.credit "/img/cast/voice-sm.webp" is 8001 bytes; the budget is 8000.',
    ]);
  });
});

describe('the real cast.json', () => {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(resolve(__dirname, '../public/data', name), 'utf8')) as unknown;

  it('passes the lint against the real crawlers.json and the photos on disk', () => {
    expect(lintCast(read('cast.json'), read('crawlers.json'), publicFileSize)).toEqual([]);
  });
});
