/**
 * Hydrate only when the markup on the page is the markup for this route.
 */
import { describe, expect, it } from 'vitest';
import { normalizePath, shouldHydrate, stripBase } from './boot';
import type { Embedded } from './data/types';

function payload(route: string): Embedded {
  return { route, show: {}, crawlers: {}, status: null };
}

describe('normalizePath', () => {
  it('drops trailing slashes and keeps the root', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('///')).toBe('/');
    expect(normalizePath('/crawlers/')).toBe('/crawlers');
    expect(normalizePath('/crawlers')).toBe('/crawlers');
    expect(normalizePath('crawlers')).toBe('/crawlers');
  });
});

describe('stripBase', () => {
  it('is a no-op at the root base', () => {
    expect(stripBase('/crawlers/harry', '/')).toBe('/crawlers/harry');
  });

  it('removes a sub-path deploy base', () => {
    expect(stripBase('/dcc-watch-hub/crawlers/harry', '/dcc-watch-hub/')).toBe('/crawlers/harry');
    expect(stripBase('/dcc-watch-hub/', '/dcc-watch-hub/')).toBe('/');
    expect(stripBase('/dcc-watch-hub', '/dcc-watch-hub/')).toBe('/');
  });

  it('leaves a path that is not under the base alone', () => {
    expect(stripBase('/other/page', '/dcc-watch-hub/')).toBe('/other/page');
    // A prefix that is not a path segment is not the base.
    expect(stripBase('/dcc-watch-hub-two/x', '/dcc-watch-hub/')).toBe('/dcc-watch-hub-two/x');
  });
});

describe('shouldHydrate', () => {
  it('hydrates a page prerendered for this exact route', () => {
    expect(shouldHydrate(payload('/crawlers/harry'), '/crawlers/harry', '/')).toBe(true);
    expect(shouldHydrate(payload('/'), '/', '/')).toBe(true);
  });

  it('ignores a trailing slash on either side', () => {
    expect(shouldHydrate(payload('/crawlers/'), '/crawlers', '/')).toBe(true);
    expect(shouldHydrate(payload('/crawlers'), '/crawlers/', '/')).toBe(true);
  });

  it('accounts for the deploy base', () => {
    expect(shouldHydrate(payload('/watch'), '/dcc-watch-hub/watch', '/dcc-watch-hub/')).toBe(true);
    expect(shouldHydrate(payload('/'), '/dcc-watch-hub/', '/dcc-watch-hub/')).toBe(true);
  });

  it('renders fresh when the page carries no payload', () => {
    expect(shouldHydrate(null, '/ep/3', '/')).toBe(false);
  });

  it('renders fresh when the payload belongs to another route', () => {
    expect(shouldHydrate(payload('/'), '/ep/3', '/')).toBe(false);
    expect(shouldHydrate(payload('/crawlers/harry'), '/crawlers/mimi', '/')).toBe(false);
  });
});
