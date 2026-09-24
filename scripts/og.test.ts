/**
 * The OG renderer's decisions, without a browser: what it would shoot, and
 * where it looks for a Chrome. The screenshotting itself is a Wave C gate.
 */
import { describe, expect, it } from 'vitest';
import { CHROME_CANDIDATES, findChrome, shotList } from './og.mjs';
import { makeCrawlers, makeShow } from '../src/test/fixtures';

describe('shotList', () => {
  it('is the site card, then one shot per crawler, then one per episode', () => {
    expect(shotList(makeShow(), makeCrawlers())).toEqual([
      { route: '/_og/site', file: 'site.png' },
      { route: '/_og/crawler/stuntman', file: 'crawler-stuntman.png' },
      { route: '/_og/crawler/harry', file: 'crawler-harry.png' },
      { route: '/_og/episode/1', file: 'ep1.png' },
      { route: '/_og/episode/2', file: 'ep2.png' },
      { route: '/_og/episode/3', file: 'ep3.png' },
    ]);
  });

  it('survives missing data, keeping only the data-free site card', () => {
    const site = [{ route: '/_og/site', file: 'site.png' }];
    expect(shotList(null, null)).toEqual(site);
    expect(shotList({ episodes: [{ title: 'no id' }] }, { crawlers: [{ name: 'no id' }] })).toEqual(
      site,
    );
  });
});

describe('findChrome', () => {
  it('prefers CHROME_PATH when it points at something real', async () => {
    await expect(findChrome({ CHROME_PATH: process.execPath })).resolves.toBe(process.execPath);
  });

  it('ignores a CHROME_PATH that does not exist, and answers null with no browser', async () => {
    const found = await findChrome({ CHROME_PATH: '/nope/not-a-chrome' });
    // Either one of the real candidates on this machine, or nothing at all.
    expect(found === null || CHROME_CANDIDATES.includes(found)).toBe(true);
  });

  it('looks in the mac and linux locations, in that order', () => {
    expect(CHROME_CANDIDATES).toEqual([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
    ]);
  });
});
