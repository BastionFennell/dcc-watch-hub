/**
 * Getting the episode out of the browser (010, T1024, FR-1009).
 *
 * Three destinations, all local (constitution VII): a download, a folder the
 * author picked once with the File System Access API, and the clipboard for the
 * `show.json` row. The folder handle lives here, for the session only - the API
 * hands out no serializable form of it, and storing one would be a permission
 * the author did not grant twice.
 *
 * `primarySave` is what Cmd/Ctrl+S means: write into the picked folder when
 * there is one, otherwise download. It never *asks* for a folder - a keystroke
 * that opens a native picker is a surprise, so picking is a menu item.
 */
import { useCallback, useRef, useState } from 'react';
import { studioCopy } from '../copy';
import type { StudioDraft } from '../draft';
import { episodeFileName, toEpisodeJson, toShowEntryJson } from '../exporter';
import type { DataFolderHandle } from '../files';
import { canPickFolder, downloadJson, pickDataFolder, writeToFolder } from '../files';

export interface ExportApi {
  /** True where the folder picker exists (Chromium). The menu item hides otherwise. */
  canPickFolder: boolean;
  /** The picked folder's name, or `null` before one is picked. */
  folderName: string | null;
  fileName: string;
  download(): void;
  downloadShowEntry(): void;
  pickFolder(): Promise<void>;
  saveToFolder(): Promise<void>;
  /** Cmd/Ctrl+S: the folder when one is picked, a download when not. */
  primarySave(): void;
  copyShowEntry(): Promise<void>;
  /** The last thing that happened, for the header's notice row. */
  notice: string | null;
  /** Set when the clipboard refused: the header shows it in a selectable box. */
  fallbackText: string | null;
  dismiss(): void;
}

export function useStudioExport(draft: StudioDraft | null): ExportApi {
  const folder = useRef<DataFolderHandle | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  const fileName = draft === null ? 'ep.json' : episodeFileName(draft);

  const dismiss = useCallback(() => {
    setNotice(null);
    setFallbackText(null);
  }, []);

  const download = useCallback(() => {
    if (draft === null) return;
    const name = episodeFileName(draft);
    downloadJson(name, toEpisodeJson(draft));
    setFallbackText(null);
    setNotice(studioCopy.notices.exported(name));
  }, [draft]);

  const downloadShowEntry = useCallback(() => {
    if (draft === null) return;
    downloadJson(`show-entry-ep${draft.meta.id}.json`, toShowEntryJson(draft));
    setFallbackText(null);
    setNotice(studioCopy.notices.exported(`show-entry-ep${draft.meta.id}.json`));
  }, [draft]);

  const writeIntoFolder = useCallback(
    async (handle: DataFolderHandle) => {
      if (draft === null) return;
      const name = episodeFileName(draft);
      try {
        await writeToFolder(handle, name, toEpisodeJson(draft));
        setFallbackText(null);
        setNotice(studioCopy.notices.savedToFolder(name));
      } catch (cause) {
        setNotice(
          studioCopy.notices.folderFailed(cause instanceof Error ? cause.message : String(cause)),
        );
      }
    },
    [draft],
  );

  const pickFolder = useCallback(async () => {
    try {
      const handle = await pickDataFolder();
      if (handle === null) return;
      folder.current = handle;
      setFolderName(handle.name ?? 'the data folder');
      await writeIntoFolder(handle);
    } catch (cause) {
      setNotice(
        studioCopy.notices.folderFailed(cause instanceof Error ? cause.message : String(cause)),
      );
    }
  }, [writeIntoFolder]);

  const saveToFolder = useCallback(async () => {
    if (folder.current === null) {
      await pickFolder();
      return;
    }
    await writeIntoFolder(folder.current);
  }, [pickFolder, writeIntoFolder]);

  const primarySave = useCallback(() => {
    if (folder.current !== null) {
      void writeIntoFolder(folder.current);
      return;
    }
    download();
  }, [download, writeIntoFolder]);

  const copyShowEntry = useCallback(async () => {
    if (draft === null) return;
    const text = toShowEntryJson(draft);
    try {
      const clipboard = navigator.clipboard;
      if (clipboard === undefined) throw new Error('no clipboard');
      await clipboard.writeText(text);
      setFallbackText(null);
      setNotice(studioCopy.notices.copied);
    } catch {
      // Every refusal looks the same from here (permissions, an insecure
      // origin, a browser that has none): show the text and let them copy it.
      setFallbackText(text);
      setNotice(studioCopy.notices.copyFailed);
    }
  }, [draft]);

  return {
    canPickFolder: canPickFolder(),
    folderName,
    fileName,
    download,
    downloadShowEntry,
    pickFolder,
    saveToFolder,
    primarySave,
    copyShowEntry,
    notice,
    fallbackText,
    dismiss,
  };
}

export default useStudioExport;
