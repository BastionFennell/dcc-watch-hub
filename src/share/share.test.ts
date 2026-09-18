/**
 * T404 - the moment URL and the delivery ladder (research R3/R4/R6).
 * Framework-free and DOM-free: every capability arrives as a stub.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ShareEnv } from './share';
import { deliver, momentUrl } from './share';

const ORIGIN = 'https://dcc.example';

describe('momentUrl', () => {
  it('builds an absolute link at the site root', () => {
    expect(momentUrl({ origin: ORIGIN, base: '/', episodeId: 1, t: 156 })).toBe(
      `${ORIGIN}/ep/1?t=156`,
    );
  });

  it('keeps a project base path (GitHub Pages)', () => {
    expect(
      momentUrl({ origin: ORIGIN, base: '/dcc-watch-hub/', episodeId: 2, t: 0 }),
    ).toBe(`${ORIGIN}/dcc-watch-hub/ep/2?t=0`);
  });

  it('normalizes a base without its trailing slash', () => {
    expect(momentUrl({ origin: ORIGIN, base: '/dcc-watch-hub', episodeId: 2, t: 9 })).toBe(
      `${ORIGIN}/dcc-watch-hub/ep/2?t=9`,
    );
    expect(momentUrl({ origin: ORIGIN, base: '', episodeId: 2, t: 9 })).toBe(
      `${ORIGIN}/ep/2?t=9`,
    );
  });

  it('floors the moment to a whole second', () => {
    expect(momentUrl({ origin: ORIGIN, base: '/', episodeId: 1, t: 156.94 })).toBe(
      `${ORIGIN}/ep/1?t=156`,
    );
  });

  it('never carries the dev flags (FR-305)', () => {
    const url = momentUrl({ origin: ORIGIN, base: '/', episodeId: 1, t: 156 });
    expect(url).not.toContain('fake');
    expect(url).not.toContain('panel');
    expect(url).not.toContain('record');
  });
});

describe('deliver', () => {
  const URL_ = `${ORIGIN}/ep/1?t=156`;
  const TITLE = 'Episode 1 - 2:36';

  function env(overrides: Partial<ShareEnv> = {}): ShareEnv {
    return {
      share: vi.fn().mockResolvedValue(undefined),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      preferShare: false,
      ...overrides,
    };
  }

  it('copies on a desktop even when a share sheet exists', async () => {
    const e = env();
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('copied');
    expect(e.share).not.toHaveBeenCalled();
    expect(e.clipboard?.writeText).toHaveBeenCalledWith(URL_);
  });

  it('opens the share sheet on a phone, with the link and the title', async () => {
    const e = env({ preferShare: true });
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('shared');
    expect(e.share).toHaveBeenCalledWith({ title: TITLE, url: URL_ });
    expect(e.clipboard?.writeText).not.toHaveBeenCalled();
  });

  it('is silent when the viewer dismisses the sheet (US2 scenario 3)', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const e = env({ preferShare: true, share: vi.fn().mockRejectedValue(abort) });
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('cancelled');
    // A dismissal is an answer: nothing lands on the clipboard behind the viewer's back.
    expect(e.clipboard?.writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the sheet fails for any other reason', async () => {
    const e = env({ preferShare: true, share: vi.fn().mockRejectedValue(new Error('nope')) });
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('copied');
    expect(e.clipboard?.writeText).toHaveBeenCalledWith(URL_);
  });

  it('shows the link when the clipboard refuses (FR-304)', async () => {
    const e = env({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('shown');
  });

  it('shows the link when there is no clipboard at all', async () => {
    await expect(deliver(URL_, TITLE, { preferShare: false })).resolves.toBe('shown');
  });

  it('skips a missing share sheet even on a phone', async () => {
    const e = env({ preferShare: true, share: undefined });
    await expect(deliver(URL_, TITLE, e)).resolves.toBe('copied');
  });

  it('never throws, whatever the platform does', async () => {
    const hostile: ShareEnv = {
      preferShare: true,
      share: vi.fn().mockRejectedValue('a string, not an error'),
      clipboard: {
        writeText: vi.fn(() => {
          throw new Error('synchronous explosion');
        }),
      },
    };
    await expect(deliver(URL_, TITLE, hostile)).resolves.toBe('shown');
  });
});
