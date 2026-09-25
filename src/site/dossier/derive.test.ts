/**
 * The status strip's arithmetic (012). Everything here is about the difference
 * between what the file knows and what the reader has opened.
 */
import { describe, expect, it } from 'vitest';
import type { CrawlerCondition, DossierCard } from '../../data/types';
import { deriveStrip, headingFor } from './derive';

function card(
  episode: number,
  overrides: Partial<DossierCard> & { condition?: CrawlerCondition } = {},
): DossierCard {
  return {
    episode,
    floor: 1,
    kind: 'update',
    onCamera: true,
    title: `Episode ${String(episode)}`,
    body: 'Body.',
    chips: [],
    level: episode,
    condition: 'alive',
    ...overrides,
  };
}

describe('deriveStrip', () => {
  it('says nothing at all when nothing is revealed', () => {
    expect(deriveStrip([])).toEqual({ level: null, condition: null, lastOnCamera: null });
  });

  it('takes the last revealed level in episode order, not in click order', () => {
    expect(deriveStrip([card(3), card(1)]).level).toBe(3);
  });

  it('reports only what is revealed, never the newest card on file', () => {
    // The file goes to 5; the reader has opened 1 and 2.
    expect(deriveStrip([card(1), card(2)]).level).toBe(2);
  });

  it('is the highest revealed on-camera episode, and a dash when there is none', () => {
    expect(deriveStrip([card(1), card(3), card(2, { onCamera: false })]).lastOnCamera).toBe(3);
    expect(deriveStrip([card(1, { onCamera: false })]).lastOnCamera).toBeNull();
  });

  it('counts a revealed card the crawler was absent from as revealed, silently', () => {
    const strip = deriveStrip([card(1), card(2, { kind: 'quiet', onCamera: false })]);
    expect(strip).toEqual({ level: 2, condition: 'alive', lastOnCamera: 1 });
  });

  /*
   * The brief's own bug: reading condition off the most recent revealed card
   * printed "Alive" next to a posthumous update. Accumulate, and make it stick.
   */
  it('is deceased once any revealed card says so, whatever follows it', () => {
    const nine = card(9, { condition: 'deceased' });
    const twelve = card(12, { condition: 'deceased', kind: 'quiet', onCamera: false });
    expect(deriveStrip([nine, twelve]).condition).toBe('deceased');
    expect(deriveStrip([twelve, nine]).condition).toBe('deceased');
  });

  it('reads the later card alone as deceased too, because the data is sticky', () => {
    const twelve = card(12, { condition: 'deceased', kind: 'quiet', onCamera: false });
    expect(deriveStrip([twelve]).condition).toBe('deceased');
  });

  it('is alive while every revealed card says alive', () => {
    expect(deriveStrip([card(1), card(2)]).condition).toBe('alive');
  });

  it('leaves the caller s array alone', () => {
    const revealed = [card(3), card(1)];
    deriveStrip(revealed);
    expect(revealed.map((entry) => entry.episode)).toEqual([3, 1]);
  });
});

describe('headingFor', () => {
  it('reads the first token of the roster s pronouns field', () => {
    expect(headingFor('he/him')).toBe('he');
    expect(headingFor('she/her')).toBe('she');
    expect(headingFor('they/them')).toBe('they');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(headingFor('  He / Him ')).toBe('he');
    expect(headingFor('SHE/HER')).toBe('she');
  });

  it('falls back to "they" for anything else, including an unwritten field', () => {
    expect(headingFor(undefined)).toBe('they');
    expect(headingFor('')).toBe('they');
    expect(headingFor('xe/xem')).toBe('they');
    expect(headingFor('he or she')).toBe('he');
  });
});
