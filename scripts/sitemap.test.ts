/**
 * The sitemap is the one place a wrong base URL is invisible until a crawler
 * indexes the wrong host, so both halves of it get a test.
 */
import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap, canonicalBase } from './sitemap.mjs';

describe('canonicalBase', () => {
  it('defaults to the registered domain at the root', () => {
    expect(canonicalBase(undefined, undefined)).toBe('https://dungeoncrawlcast.com');
    expect(canonicalBase('', '/')).toBe('https://dungeoncrawlcast.com');
  });

  it('honours VITE_SITE_URL and strips its trailing slash', () => {
    expect(canonicalBase('https://dcc.example/', '/')).toBe('https://dcc.example');
  });

  it('includes a sub-path deploy base', () => {
    expect(canonicalBase('https://user.github.io', '/dcc-watch-hub/')).toBe(
      'https://user.github.io/dcc-watch-hub',
    );
  });
});

describe('buildSitemap', () => {
  const routes = ['/', '/watch', '/crawlers', '/crawlers/harry'];

  it('lists every route under the base, in order', () => {
    const xml = buildSitemap(routes, 'https://dungeoncrawlcast.com');
    expect(xml.split('\n').filter((line) => line.includes('<loc>'))).toEqual([
      '  <url><loc>https://dungeoncrawlcast.com/</loc></url>',
      '  <url><loc>https://dungeoncrawlcast.com/watch</loc></url>',
      '  <url><loc>https://dungeoncrawlcast.com/crawlers</loc></url>',
      '  <url><loc>https://dungeoncrawlcast.com/crawlers/harry</loc></url>',
    ]);
  });

  it('is a well-formed document with the sitemap namespace', () => {
    const xml = buildSitemap(routes, 'https://dcc.example/dcc-watch-hub');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml).toContain('<loc>https://dcc.example/dcc-watch-hub/watch</loc>');
  });

  it('escapes what XML cannot carry raw', () => {
    expect(buildSitemap(['/a&b'], 'https://x.example')).toContain('<loc>https://x.example/a&amp;b</loc>');
  });
});

describe('buildRobots', () => {
  it('allows everything and points at the sitemap', () => {
    expect(buildRobots('https://dungeoncrawlcast.com')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://dungeoncrawlcast.com/sitemap.xml\n',
    );
  });
});
