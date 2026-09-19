import { describe, expect, it } from 'vitest';
import { initialOf } from './initial';

describe('initialOf', () => {
  it('skips a leading article', () => {
    expect(initialOf('The Hoarder')).toBe('H');
    expect(initialOf('A Lamplighter')).toBe('L');
    expect(initialOf('an Usher')).toBe('U');
  });
  it('keeps a lone article or ordinary names', () => {
    expect(initialOf('The')).toBe('T');
    expect(initialOf('Quartermaster Vel')).toBe('Q');
    expect(initialOf('  grull-rep ')).toBe('G');
    expect(initialOf('')).toBe('');
  });
});
