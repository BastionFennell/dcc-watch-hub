// @vitest-environment jsdom
/**
 * `readEmbedded()` needs a DOM, so it gets a file of its own: the rest of
 * `load.test.ts` runs in the node environment on purpose.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMBEDDED_ID, readEmbedded } from './load';
import { makeCrawlers, makeDossier, makeShow, makeStatus } from '../test/fixtures';

function embed(text: string): void {
  const script = document.createElement('script');
  script.id = EMBEDDED_ID;
  script.type = 'application/json';
  script.textContent = text;
  document.body.appendChild(script);
}

afterEach(() => {
  document.getElementById(EMBEDDED_ID)?.remove();
});

describe('readEmbedded', () => {
  it('returns null when the page carries no payload', () => {
    expect(readEmbedded()).toBeNull();
  });

  it('parses the prerenderer payload', () => {
    const payload = {
      route: '/crawlers/stuntman',
      show: makeShow(),
      crawlers: makeCrawlers(),
      status: makeStatus(),
    };
    embed(JSON.stringify(payload));
    const embedded = readEmbedded();
    expect(embedded?.route).toBe('/crawlers/stuntman');
    expect(embedded?.show).toEqual(makeShow());
    expect(embedded?.crawlers).toEqual(makeCrawlers());
    expect(embedded?.status).toEqual(makeStatus());
  });

  /* 012: the crawler route carries its crawler's dossier and nobody else's. */
  it('hands the dossier through unread, like every other blob', () => {
    embed(
      JSON.stringify({
        route: '/crawlers/stuntman',
        show: makeShow(),
        crawlers: makeCrawlers(),
        status: null,
        dossier: makeDossier('stuntman'),
      }),
    );
    expect(readEmbedded()?.dossier).toEqual(makeDossier('stuntman'));
  });

  it('reads a pre-012 payload, and every non-crawler route, as no dossier', () => {
    embed(JSON.stringify({ route: '/', show: makeShow(), crawlers: makeCrawlers(), status: null }));
    expect(readEmbedded()?.dossier).toBeNull();
  });

  it('accepts a payload with no status file, without warning about it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    embed(JSON.stringify({ route: '/', show: makeShow(), crawlers: makeCrawlers(), status: null }));
    expect(readEmbedded()?.status).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  /*
   * A payload we cannot read is the same as no payload: the providers fetch,
   * and the page works. It is not worth a line in the console - nor the bytes
   * in the viewer's entry chunk, which every hub page pays for too.
   */
  it('survives a malformed blob: null, no throw, no noise', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    embed('{ not json');
    expect(readEmbedded()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('survives a payload that is not an object, or has no route', () => {
    embed('[1, 2, 3]');
    expect(readEmbedded()).toBeNull();
    document.getElementById(EMBEDDED_ID)?.remove();
    embed('{"show": {}}');
    expect(readEmbedded()).toBeNull();
  });

  it('treats an empty script as no payload', () => {
    embed('   ');
    expect(readEmbedded()).toBeNull();
  });
});
