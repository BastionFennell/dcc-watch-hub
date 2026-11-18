import { describe, expect, it } from 'vitest';
import { castAnchor, playerOf } from './cast';
import { makeCast } from '../test/fixtures';

describe('playerOf', () => {
  const { cast } = makeCast();

  it('finds the member who plays a crawler', () => {
    expect(playerOf(cast, 'stuntman')?.name).toBe('Danny');
    expect(playerOf(cast, 'harry')?.name).toBe('Marcus');
  });

  it('answers undefined for a crawler nobody plays, and for an empty cast', () => {
    expect(playerOf(cast, 'nobody')).toBeUndefined();
    expect(playerOf([], 'stuntman')).toBeUndefined();
  });

  it('never matches someone with an authored role instead of a crawler', () => {
    expect(cast.find((member) => member.role !== undefined)).toBeDefined();
    expect(playerOf(cast, '')).toBeUndefined();
  });

  it('takes the first match when two members claim one crawler', () => {
    const twice = [...cast, { ...cast[0], id: 'impostor', name: 'Impostor' }];
    expect(playerOf(twice, 'stuntman')?.id).toBe('danny');
  });
});

describe('castAnchor', () => {
  it('points at the card on /cast', () => {
    expect(castAnchor('madio')).toBe('/cast#madio');
  });
});
