/**
 * Getting a file in and out of the browser (010, FR-1009 / FR-1010).
 *
 * Two paths, both local and both explicit (constitution VII, "local only"):
 * a download that always works, and - in Chromium - the File System Access API
 * so the author can pick `public/data/` once and save straight into the repo.
 *
 * The File System Access types are declared here rather than pulled from a
 * dependency (constitution IV): only the three calls the Studio makes are
 * typed, and every one of them is feature-detected before it is used.
 */

/* --------------------------------------------- File System Access (local) */

interface WritableFileStreamLike {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}

interface DataFileHandle {
  createWritable(): Promise<WritableFileStreamLike>;
}

/** A directory the author picked. Opaque; only `getFileHandle` is used. */
export interface DataFolderHandle {
  name?: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<DataFileHandle>;
}

interface FolderPickerWindow {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DataFolderHandle>;
}

function pickerWindow(): FolderPickerWindow | null {
  try {
    return (globalThis as unknown as FolderPickerWindow) ?? null;
  } catch {
    return null;
  }
}

/** True when "save to data folder" can be offered at all. Hide it otherwise. */
export function canPickFolder(): boolean {
  return typeof pickerWindow()?.showDirectoryPicker === 'function';
}

/**
 * Asks for a folder with write access. `null` when the author cancelled or the
 * browser has no picker; anything else the API throws is passed on, because a
 * permission refusal is worth showing.
 */
export async function pickDataFolder(): Promise<DataFolderHandle | null> {
  const picker = pickerWindow()?.showDirectoryPicker;
  if (typeof picker !== 'function') return null;
  try {
    return await picker({ mode: 'readwrite' });
  } catch (cause) {
    // AbortError is the author closing the dialog: not a failure.
    if (cause instanceof DOMException && cause.name === 'AbortError') return null;
    throw cause;
  }
}

/** Writes (or creates) `name` inside a folder the author already picked. */
export async function writeToFolder(
  handle: DataFolderHandle,
  name: string,
  text: string,
): Promise<void> {
  const file = await handle.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}

/* ----------------------------------------------------- download and open */

function documentOrNull(): Document | null {
  try {
    return globalThis.document ?? null;
  } catch {
    return null;
  }
}

/**
 * Hands `text` to the browser as a download named `name`. An object URL and an
 * anchor: no dependency, and no navigation away from the editor.
 */
export function downloadJson(name: string, text: string): boolean {
  const doc = documentOrNull();
  if (doc === null || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  doc.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Safari needs the URL to outlive the click by a tick.
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    }, 0);
  }
  return true;
}

export interface OpenedFile {
  name: string;
  text: string;
}

/**
 * Opens a JSON file through a transient `<input type="file">`. Resolves with
 * the file's text, or `null` when the author picked nothing.
 */
export function openJsonFile(): Promise<OpenedFile | null> {
  const doc = documentOrNull();
  if (doc === null) return Promise.resolve(null);

  return new Promise<OpenedFile | null>((resolve, reject) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    let settled = false;
    const finish = (value: OpenedFile | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file === undefined) {
        finish(null);
        return;
      }
      file
        .text()
        .then((text) => finish({ name: file.name, text }))
        .catch((cause: unknown) => {
          if (settled) return;
          settled = true;
          input.remove();
          reject(cause instanceof Error ? cause : new Error(String(cause)));
        });
    });

    doc.body.appendChild(input);
    input.click();
  });
}
