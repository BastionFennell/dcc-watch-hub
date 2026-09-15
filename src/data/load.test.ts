import { describe, expect, it } from 'vitest';
import { joinBase } from './load';

describe('joinBase', () => {
  it('leaves root-based deploys untouched', () => {
    expect(joinBase('/', '/data/ep1.json')).toBe('/data/ep1.json');
  });

  it('prefixes a sub-path deploy base', () => {
    expect(joinBase('/dcc-watch-hub/', '/data/ep1.json')).toBe('/dcc-watch-hub/data/ep1.json');
    expect(joinBase('/dcc-watch-hub', '/data/ep1.json')).toBe('/dcc-watch-hub/data/ep1.json');
  });

  it('leaves absolute URLs untouched', () => {
    expect(joinBase('/dcc-watch-hub/', 'https://cdn.example/data/ep1.json')).toBe(
      'https://cdn.example/data/ep1.json',
    );
  });

  it('leaves relative URLs untouched', () => {
    expect(joinBase('/dcc-watch-hub/', 'data/ep1.json')).toBe('data/ep1.json');
  });
});
