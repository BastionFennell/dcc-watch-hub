/**
 * `/studio/ep/:id` - the editor (010, T1027).
 *
 * The plan's screen, assembled: the stage, the transport bar, the draft's own
 * marker strip and the live preview down the left; the tabs - Events, Issues,
 * Episode - down the right, with the event form replacing them while it is
 * open.
 *
 * Two rules keep the whole thing honest:
 *  - the page owns the draft and nothing else writes to it. Every edit is a
 *    `DraftAction`, so undo covers all of them (FR-1007);
 *  - everything below the stage is a function of `(draft, t)` - the preview
 *    runs the viewer's own reducer, the list and the markers run the viewer's
 *    own feed selector (constitution I and VII).
 *
 * Hotkeys while the form is open: the page map is reduced to undo, redo and
 * save. Space, J/L, the arrows, E, T, D and Delete are all inert, because the
 * author is typing into fields and half of those are characters. The form
 * itself owns Escape and Cmd/Ctrl+Enter and stops them before they get here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useRegistry } from '../../data/RegistryContext';
import type { TimeSource } from '../../playback/TimeSource';
import { usePlayhead } from '../../playback/usePlayhead';
import { VideoStage } from '../../components/VideoStage/VideoStage';
import { studioCopy } from '../copy';
import type { DraftEvent, RawEvent } from '../draft';
import { findDraftEvent, uid as newUid } from '../draft';
import type { EventType } from '../../data/types';
import { toShowEntry } from '../exporter';
import { feedContext } from '../feedLine';
import { fromEpisodeJson } from '../importer';
import { openJsonFile } from '../files';
import type { StudioRegistries } from '../options';
import { countIssues, issuesFor } from '../validateDraft';
import { useStudioDraft } from '../hooks/useStudioDraft';
import { useStudioExport } from '../hooks/useStudioExport';
import { useStudioHotkeys } from '../hooks/useStudioHotkeys';
import { useTransport } from '../hooks/useTransport';
import { EventForm } from '../components/EventForm';
import { EventList } from '../components/EventList';
import { IssuesPanel } from '../components/IssuesPanel';
import { NewEpisodeDialog } from '../components/NewEpisodeDialog';
import { PartyEditor } from '../components/PartyEditor';
import { PreviewPane } from '../components/PreviewPane';
import { StudioHeader } from '../components/StudioHeader';
import { StudioTimeline } from '../components/StudioTimeline';
import { TransportBar } from '../components/TransportBar';
import styles from './StudioEpisodePage.module.css';

type Tab = 'events' | 'issues' | 'episode';

const TABS: { id: Tab; label: string }[] = [
  { id: 'events', label: studioCopy.list.title },
  { id: 'issues', label: studioCopy.issues.title },
  { id: 'episode', label: studioCopy.episode.title },
];

/** FR-1012: below this the editor does not fit, and says so. */
const MIN_WIDTH = 1000;

function useWideEnough(): boolean {
  const [wide, setWide] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    try {
      return window.matchMedia(`(min-width: ${MIN_WIDTH}px)`).matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return wide;
}

export function StudioEpisodePage() {
  const { id } = useParams();
  const { registry, spells } = useRegistry();
  const [searchParams] = useSearchParams();
  const fake = import.meta.env.DEV && searchParams.get('fake') === '1';

  const { draft, loading, dispatch, canUndo, canRedo, save, flush, storageOk } = useStudioDraft(id);
  const [source, setSource] = useState<TimeSource | null>(null);
  const { t } = usePlayhead(source);
  const transport = useTransport(source);
  const exporter = useStudioExport(draft);
  const wide = useWideEnough();

  const [tab, setTab] = useState<Tab>('events');
  const [selected, setSelected] = useState<string | null>(null);
  /** `null` closed, `'new'` adding, otherwise the uid being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [lastActor, setLastActor] = useState<string | undefined>(undefined);
  const [lastType, setLastType] = useState<EventType | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const addButton = useRef<HTMLDivElement>(null);
  /** Whatever had focus when the form opened; focus goes back there on close. */
  const trigger = useRef<HTMLElement | null>(null);

  const registries: StudioRegistries = useMemo(
    () => ({ npcs: registry, spells }),
    [registry, spells],
  );
  const feed = useMemo(
    () => (draft === null ? null : feedContext(draft, registries)),
    [draft, registries],
  );
  const issues = useMemo(
    () => (draft === null ? [] : issuesFor(draft, registries)),
    [draft, registries],
  );
  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) if (issue.uid !== undefined) set.add(issue.uid);
    return set;
  }, [issues]);

  useEffect(() => {
    if (draft !== null) document.title = `Studio - EP ${draft.meta.id} ${draft.meta.title}`;
  }, [draft]);

  // The stage destroys its own source on unmount; this covers a source swap.
  useEffect(() => () => source?.destroy(), [source]);

  /* --------------------------------------------------------- the form */

  const openForm = useCallback((what: string) => {
    const active = document.activeElement;
    trigger.current =
      active instanceof HTMLElement && active !== document.body
        ? active
        : (addButton.current?.querySelector<HTMLElement>('[data-testid="add-event"]') ?? null);
    setEditing(what);
  }, []);

  const closeForm = useCallback(() => {
    setEditing(null);
    setTab('events');
    // The form does not return focus itself (Wave B): the container does.
    const back = trigger.current;
    trigger.current = null;
    window.setTimeout(() => {
      if (back !== null && back.isConnected) back.focus();
      else addButton.current?.querySelector<HTMLElement>('[data-testid="add-event"]')?.focus();
    }, 0);
  }, []);

  const addAtPlayhead = useCallback(() => {
    if (draft === null) return;
    // US1: marking a moment stops the video, so the author is not chasing it.
    if (transport.available) transport.pause();
    setSelected(null);
    openForm('new');
  }, [draft, transport, openForm]);

  const editEvent = useCallback(
    (eventUid: string) => {
      if (draft === null) return;
      const entry = findDraftEvent(draft, eventUid);
      if (entry === undefined) return;
      setSelected(eventUid);
      transport.seekTo(entry.event.t);
      openForm(eventUid);
    },
    [draft, transport, openForm],
  );

  function onSave(event: RawEvent, opts: { resume: boolean }): void {
    if (draft === null) return;
    if (editing !== null && editing !== 'new') {
      dispatch({ kind: 'updateEvent', uid: editing, event });
      setSelected(editing);
    } else {
      const fresh = newUid();
      dispatch({ kind: 'addEvent', event, uid: fresh });
      setSelected(fresh);
    }
    // Sticky actor and type: the next event usually belongs to the same crawler.
    if (typeof event.actor === 'string' && event.actor !== '') setLastActor(event.actor);
    setLastType(event.type as EventType);
    closeForm();
    if (opts.resume && transport.available) transport.play();
  }

  /* ------------------------------------------------------ row actions */

  const retime = useCallback(
    (eventUid: string) => {
      dispatch({ kind: 'retimeEvent', uid: eventUid, t: Math.round(t) });
      setSelected(eventUid);
    },
    [dispatch, t],
  );

  const duplicate = useCallback(
    (eventUid: string) => {
      const fresh = newUid();
      dispatch({ kind: 'duplicateEvent', uid: eventUid, t: Math.round(t), newUid: fresh });
      setSelected(fresh);
    },
    [dispatch, t],
  );

  const remove = useCallback(
    (eventUid: string) => {
      // No confirmation on purpose: undo is one keystroke away, and a dialog in
      // the middle of a keyboard pass is worse than the mistake (FR-1007).
      dispatch({ kind: 'removeEvent', uid: eventUid });
      setSelected((was) => (was === eventUid ? null : was));
      if (editing === eventUid) closeForm();
    },
    [dispatch, editing, closeForm],
  );

  /* --------------------------------------------------------- import */

  async function importFile(): Promise<void> {
    if (draft === null) return;
    if (draft.events.length > 0 && !window.confirm(studioCopy.header.importConfirm(draft.events.length))) {
      return;
    }
    try {
      const file = await openJsonFile();
      if (file === null) return;
      const { draft: next, warnings } = fromEpisodeJson(file.text, draft.meta);
      dispatch({ kind: 'replaceDraft', draft: next });
      setSelected(null);
      setEditing(null);
      setImportNote(
        [studioCopy.notices.imported(next.events.length), ...warnings].join(' '),
      );
    } catch (cause) {
      setImportNote(
        studioCopy.notices.importFailed(cause instanceof Error ? cause.message : String(cause)),
      );
    }
  }

  /* -------------------------------------------------------- hotkeys */

  const formOpen = editing !== null;

  const saveKey = useCallback(() => {
    flush();
    exporter.primarySave();
  }, [flush, exporter]);

  const hotkeys = useMemo(() => {
    const always = {
      'mod+z': () => dispatch({ kind: 'undo' }),
      'mod+shift+z': () => dispatch({ kind: 'redo' }),
      'mod+s': saveKey,
    };
    if (formOpen) return always;
    return {
      ...always,
      space: () => transport.toggle(),
      j: () => transport.seekBy(-5),
      l: () => transport.seekBy(5),
      arrowleft: () => transport.seekBy(-1),
      arrowright: () => transport.seekBy(1),
      e: () => addAtPlayhead(),
      t: () => {
        if (selected !== null) retime(selected);
      },
      d: () => {
        if (selected !== null) duplicate(selected);
      },
      delete: () => {
        if (selected !== null) remove(selected);
      },
      backspace: () => {
        if (selected !== null) remove(selected);
      },
    };
  }, [
    formOpen,
    saveKey,
    dispatch,
    transport,
    addAtPlayhead,
    selected,
    retime,
    duplicate,
    remove,
  ]);

  useStudioHotkeys(hotkeys, { enabled: draft !== null && wide });

  /* --------------------------------------------------------- render */

  if (loading) {
    return (
      <p className={styles.plain} data-testid="studio-loading">
        {studioCopy.notices.loading}
      </p>
    );
  }

  if (draft === null) {
    // An id with no draft: offer to make it rather than a dead end (T1027).
    const suggested = id !== undefined && /^\d+$/.test(id) ? Number(id) : undefined;
    return (
      <div className={styles.plain} data-testid="studio-unknown">
        <p>{studioCopy.notices.unknownDraft(id ?? '')}</p>
        <p className={styles.plainActions}>
          <button
            type="button"
            className={styles.primary}
            data-testid="create-missing"
            onClick={() => setCreateOpen(true)}
          >
            {studioCopy.notices.unknownDraftCreate}
          </button>
          <Link className={styles.link} to="/studio">
            {studioCopy.notices.unknownDraftHome}
          </Link>
        </p>
        <NewEpisodeDialog
          open={createOpen}
          takenIds={[]}
          suggestedId={suggested}
          onCreate={(created) => {
            setCreateOpen(false);
            dispatch({ kind: 'replaceDraft', draft: created });
          }}
          onClose={() => setCreateOpen(false)}
          returnFocusTo={null}
        />
      </div>
    );
  }

  const counts = countIssues(issues);
  // After the guard above the draft exists, so the context always does too.
  const feedCtx = feed ?? feedContext(draft, registries);
  const entry = toShowEntry(draft);
  const editingEvent: DraftEvent | undefined =
    editing === null || editing === 'new' ? undefined : findDraftEvent(draft, editing);
  const showStage = draft.meta.youtubeId !== '' || fake;

  return (
    <div className={styles.shell} data-testid="studio-episode">
      <StudioHeader
        draft={draft}
        save={save}
        storageOk={storageOk}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => dispatch({ kind: 'undo' })}
        onRedo={() => dispatch({ kind: 'redo' })}
        onImport={() => void importFile()}
        exporter={exporter}
      />

      {importNote === null ? null : (
        <p className={styles.note} data-testid="import-note" role="status">
          {importNote}
          <button type="button" className={styles.link} onClick={() => setImportNote(null)}>
            {studioCopy.notices.dismiss}
          </button>
        </p>
      )}

      {!wide ? (
        <div className={styles.plain} data-testid="too-narrow">
          <p className={styles.narrowTitle}>{studioCopy.notices.narrow}</p>
          <p>{studioCopy.notices.narrowHelp}</p>
          <Link className={styles.link} to="/studio">
            {studioCopy.notices.unknownDraftHome}
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.left}>
            {showStage ? (
              /* Remounted on a change of video id: the host has to reload. */
              <VideoStage key={draft.meta.youtubeId} meta={entry} t={t} onSource={setSource} />
            ) : (
              <p className={styles.noVideo} data-testid="no-video">
                {studioCopy.episode.youtube}
              </p>
            )}

            <div ref={addButton}>
              <TransportBar
                transport={transport}
                t={t}
                durationSec={draft.meta.durationSec}
                onAdd={addAtPlayhead}
              />
            </div>

            <StudioTimeline
              draft={draft}
              feed={feedCtx}
              t={t}
              selectedUid={selected ?? undefined}
              onSeek={(seconds) => transport.seekTo(seconds)}
              onSelect={(eventUid) => setSelected(eventUid)}
            />

            <PreviewPane draft={draft} registries={registries} t={t} />
          </div>

          <aside className={styles.right}>
            {formOpen ? (
              <>
                <EventForm
                key={editingEvent?.uid ?? 'new'}
                draft={draft}
                registries={registries}
                t={t}
                editing={editingEvent}
                lastActor={lastActor}
                lastType={lastType}
                onSave={onSave}
                  onCancel={closeForm}
                />
                <p className={styles.formNote}>{studioCopy.notices.hotkeysWhileFormOpen}</p>
              </>
            ) : (
              <>
                <div className={styles.tabs} role="tablist" aria-label={studioCopy.list.title}>
                  {TABS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      id={`studio-tab-${item.id}`}
                      aria-selected={tab === item.id}
                      aria-controls="studio-tabpanel"
                      className={styles.tab}
                      data-testid={`tab-${item.id}`}
                      data-on={tab === item.id ? 'true' : undefined}
                      onClick={() => setTab(item.id)}
                    >
                      {item.label}
                      {item.id === 'issues' && issues.length > 0 ? (
                        <span
                          className={styles.badge}
                          data-tone={counts.errors > 0 ? 'error' : 'warn'}
                          data-testid="issues-badge"
                        >
                          {issues.length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div
                  className={styles.panel}
                  role="tabpanel"
                  id="studio-tabpanel"
                  aria-labelledby={`studio-tab-${tab}`}
                  tabIndex={-1}
                >
                  {tab === 'events' ? (
                    <EventList
                      draft={draft}
                      feed={feedCtx}
                      t={t}
                      selectedUid={selected ?? undefined}
                      flagged={flagged}
                      onSelect={editEvent}
                      onRetime={retime}
                      onDuplicate={duplicate}
                      onDelete={remove}
                    />
                  ) : tab === 'issues' ? (
                    <IssuesPanel issues={issues} onSelect={editEvent} />
                  ) : (
                    <PartyEditor
                      draft={draft}
                      dispatch={dispatch}
                      playerDuration={transport.duration}
                    />
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

    </div>
  );
}

export default StudioEpisodePage;
