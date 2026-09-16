/**
 * T401 — `?t=` parsing (research R6: a table, so every rejected shape is named).
 * Framework-free: no DOM beyond `URLSearchParams`, which node has.
 */
import { describe, expect, it } from 'vitest';
import { momentSearch, parseDeepLinkT } from './deepLink';

const DURATION = 240;

describe('parseDeepLinkT', () => {
  const table: Array<[label: string, search: string, expected: number | null]> = [
    ['a whole second', '?t=156', 156],
    ['no leading question mark', 't=156', 156],
    ['zero', '?t=0', 0],
    ['exactly the duration', '?t=240', 240],
    ['decimals, floored to the second being watched', '?t=156.9', 156],
    ['beside other params', '?fake=1&t=156&panel=map', 156],
    ['t last', '?panel=map&t=12', 12],
    ['no t at all', '?fake=1', null],
    ['an empty search', '', null],
    ['an empty value', '?t=', null],
    ['whitespace only', '?t=%20', null],
    ['non-numeric', '?t=abc', null],
    ['negative', '?t=-5', null],
    ['past the duration', '?t=99999', null],
    ['one second past the duration', '?t=241', null],
    ['Infinity', '?t=Infinity', null],
    ['NaN', '?t=NaN', null],
    ['hex-ish garbage', '?t=1e', null],
  ];

  for (const [label, search, expected] of table) {
    it(`${expected === null ? 'ignores' : 'reads'} ${label}`, () => {
      expect(parseDeepLinkT(search, DURATION)).toBe(expected);
    });
  }

  it('takes the first value when the param repeats', () => {
    expect(parseDeepLinkT('?t=10&t=20', DURATION)).toBe(10);
  });

  it('allows only 0 on a zero-length episode', () => {
    expect(parseDeepLinkT('?t=0', 0)).toBe(0);
    expect(parseDeepLinkT('?t=1', 0)).toBeNull();
  });

  it('ignores every value when the duration is unknown', () => {
    expect(parseDeepLinkT('?t=10', Number.NaN)).toBeNull();
    expect(parseDeepLinkT('?t=10', -1)).toBeNull();
  });
});

describe('momentSearch', () => {
  it('names a whole second', () => {
    expect(momentSearch(156)).toBe('?t=156');
    expect(momentSearch(0)).toBe('?t=0');
  });

  it('floors and clamps, so a share never emits a bad link', () => {
    expect(momentSearch(156.94)).toBe('?t=156');
    expect(momentSearch(-3)).toBe('?t=0');
    expect(momentSearch(Number.NaN)).toBe('?t=0');
  });

  it('round-trips through the parser', () => {
    expect(parseDeepLinkT(momentSearch(156.4), DURATION)).toBe(156);
  });
});
