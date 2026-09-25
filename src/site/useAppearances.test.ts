/**
 * "Appears in" is derived from the episode's own data (011 §3.4): the party it
 * started with, or any event that names the crawler.
 */
import { describe, expect, it } from 'vitest';
import { referencesCrawler } from './useAppearances';
import { makeEpisode } from '../test/fixtures';

const episode = makeEpisode(1);

describe('referencesCrawler', () => {
  it('finds a crawler in the starting party', () => {
    expect(referencesCrawler(episode, 'stuntman')).toBe(true);
  });

  it('finds a crawler that only an event names', () => {
    const guest = {
      ...episode,
      initialState: { ...episode.initialState, party: [] },
    };
    expect(referencesCrawler(guest, 'stuntman')).toBe(true);
  });

  it('says no to a crawler the episode never mentions', () => {
    expect(referencesCrawler(episode, 'nobody')).toBe(false);
  });
});
