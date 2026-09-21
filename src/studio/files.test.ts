// @vitest-environment jsdom
/**
 * T1012 - the file paths in and out, against jsdom stubs. jsdom has neither
 * `URL.createObjectURL` nor a directory picker, which is exactly the shape of
 * the browsers that do not support them either.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataFolderHandle } from './files';
import { canPickFolder, downloadJson, openJsonFile, pickDataFolder, writeToFolder } from './files';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('downloadJson', () => {
  it('clicks an anchor with an object URL and cleans up after itself', () => {
    vi.useFakeTimers();
    const created: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob.type);
        return 'blob:studio/1';
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });

    const clicks: { href: string; download: string }[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreate(tag);
      if (tag === 'a') {
        (element as HTMLAnchorElement).click = () => {
          const anchor = element as HTMLAnchorElement;
          clicks.push({ href: anchor.href, download: anchor.download });
        };
      }
      return element;
    });

    expect(downloadJson('ep1.json', '{"a":1}\n')).toBe(true);
    expect(created).toEqual(['application/json']);
    expect(clicks).toEqual([{ href: 'blob:studio/1', download: 'ep1.json' }]);
    expect(document.querySelector('a')).toBeNull();

    vi.runAllTimers();
    expect(revoked).toEqual(['blob:studio/1']);
    vi.useRealTimers();
  });

  it('says no when the browser has no object URLs', () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: undefined });
    expect(downloadJson('ep1.json', '{}')).toBe(false);
  });
});

describe('openJsonFile', () => {
  /** Drives the transient input the moment it is clicked. */
  function withInput(act: (input: HTMLInputElement) => void): void {
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreate(tag);
      if (tag === 'input') {
        (element as HTMLInputElement).click = () => {
          setTimeout(() => act(element as HTMLInputElement), 0);
        };
      }
      return element;
    });
  }

  it('resolves with the picked file text', async () => {
    withInput((input) => {
      Object.defineProperty(input, 'files', {
        value: [{ name: 'ep2.json', text: () => Promise.resolve('{"episodeId":2}') }],
      });
      input.dispatchEvent(new Event('change'));
    });

    await expect(openJsonFile()).resolves.toEqual({
      name: 'ep2.json',
      text: '{"episodeId":2}',
    });
    expect(document.querySelector('input')).toBeNull();
  });

  it('resolves null when the dialog is cancelled', async () => {
    withInput((input) => input.dispatchEvent(new Event('cancel')));
    await expect(openJsonFile()).resolves.toBeNull();
  });

  it('resolves null when the change carries no file', async () => {
    withInput((input) => {
      Object.defineProperty(input, 'files', { value: [] });
      input.dispatchEvent(new Event('change'));
    });
    await expect(openJsonFile()).resolves.toBeNull();
  });

  it('rejects when the file cannot be read', async () => {
    withInput((input) => {
      Object.defineProperty(input, 'files', {
        value: [{ name: 'ep2.json', text: () => Promise.reject(new Error('unreadable')) }],
      });
      input.dispatchEvent(new Event('change'));
    });
    await expect(openJsonFile()).rejects.toThrow('unreadable');
  });
});

describe('the data folder', () => {
  it('is hidden where the API is missing', async () => {
    expect(canPickFolder()).toBe(false);
    await expect(pickDataFolder()).resolves.toBeNull();
  });

  it('is offered where the API exists', async () => {
    const handle = { name: 'data' } as DataFolderHandle;
    const picker = vi.fn(() => Promise.resolve(handle));
    vi.stubGlobal('showDirectoryPicker', picker);
    expect(canPickFolder()).toBe(true);
    await expect(pickDataFolder()).resolves.toBe(handle);
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('treats a cancelled picker as no choice, and passes a refusal on', async () => {
    vi.stubGlobal('showDirectoryPicker', () =>
      Promise.reject(new DOMException('cancelled', 'AbortError')),
    );
    await expect(pickDataFolder()).resolves.toBeNull();

    vi.stubGlobal('showDirectoryPicker', () =>
      Promise.reject(new DOMException('denied', 'NotAllowedError')),
    );
    await expect(pickDataFolder()).rejects.toThrow('denied');
  });

  it('writes a file into the picked folder and closes the stream', async () => {
    const written: string[] = [];
    let closed = false;
    const handle: DataFolderHandle = {
      getFileHandle: (name, options) => {
        expect(name).toBe('ep1.json');
        expect(options).toEqual({ create: true });
        return Promise.resolve({
          createWritable: () =>
            Promise.resolve({
              write: (data: string | Blob) => {
                written.push(String(data));
                return Promise.resolve();
              },
              close: () => {
                closed = true;
                return Promise.resolve();
              },
            }),
        });
      },
    };

    await writeToFolder(handle, 'ep1.json', '{"episodeId":1}\n');
    expect(written).toEqual(['{"episodeId":1}\n']);
    expect(closed).toBe(true);
  });

  it('closes the stream even when the write fails', async () => {
    let closed = false;
    const handle: DataFolderHandle = {
      getFileHandle: () =>
        Promise.resolve({
          createWritable: () =>
            Promise.resolve({
              write: () => Promise.reject(new Error('disk full')),
              close: () => {
                closed = true;
                return Promise.resolve();
              },
            }),
        }),
    };
    await expect(writeToFolder(handle, 'ep1.json', '{}')).rejects.toThrow('disk full');
    expect(closed).toBe(true);
  });
});
