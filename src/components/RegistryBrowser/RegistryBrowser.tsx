import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { EntityKind, EpisodeData } from '../../data/types';
import { useShow } from '../../data/ShowContext';
import { useRegistry } from '../../data/RegistryContext';
import { useRegistryIndex } from '../../data/RegistryIndexContext';
import { orderedEpisodes } from '../../data/show';
import type { RegistryScope } from '../../engine/registry';
import {
  matchesRegistryQuery,
  parseRegistryScope,
  registryIndexAt,
  registrySections,
  scopeParam,
  scopeRegistry,
} from '../../engine/registry';
import { RegistryEntry } from '../RegistryEntry/RegistryEntry';
import { RegistryToolbar } from '../RegistryToolbar/RegistryToolbar';
import { SystemNotice } from '../SystemNotice/SystemNotice';
import { copy } from '../../copy';
import styles from './RegistryBrowser.module.css';

export interface RegistryBrowserProps {
  /** The episode being watched: the default scope, and which appearances seek. */
  currentEpisodeId: number;
  /**
   * The current episode's data, straight from the page — `null` while its file
   * is still landing, because the panel opens without waiting for it (R3
   * scenario 4). The shared index loads lazily over the network, but the page
   * already holds *this* episode, so laying it over the cached map makes the
   * panel correct the moment it opens; the earlier episodes fill in underneath
   * when they arrive.
   */
  currentEpisode: EpisodeData | null;
  /** The playhead. The current episode's contribution stops here (R4-FR-651). */
  t: number;
  /** Open the panel on this entity, expanded and scrolled to (R3-FR-643). */
  focusId?: string;
  /** Seeks the broadcast to an appearance in the current episode. */
  onSeek(t: number): void;
  /** Copies a link to that moment; never seeks (004 FR-306). */
  onShare(t: number): void;
}

/**
 * The System Registry beside the broadcast (007 R3, R3-FR-641).
 *
 * The same archive the `/registry` page shows — same index, same toolbar, same
 * entries — in the rail's narrow column, so a viewer can read about an entity
 * without stopping the video. Two things differ from the page, both because the
 * broadcast is still running next to it:
 *
 * - the default scope is "through this episode", not the whole archive, so the
 *   panel opens on what this viewer has reached;
 * - the scope lives here rather than in the URL (R3-FR-641) — changing it must
 *   not navigate, because navigating would take the stage with it.
 *
 * Revision 4 adds the third: the current episode follows the playhead
 * (R4-FR-651). Earlier episodes are published history and read whole, but this
 * one is being watched, so it contributes only the beats that have elapsed —
 * recomputed from `(episode, t)` on every render like everything else below the
 * stage, which makes a scrub backwards correct for free (constitution I).
 */
export function RegistryBrowser({
  currentEpisodeId,
  currentEpisode,
  t,
  focusId,
  onSeek,
  onShare,
}: RegistryBrowserProps) {
  const { show } = useShow();
  const { registry, loading: registryLoading } = useRegistry();
  const { episodes, load } = useRegistryIndex();

  // The first thing the panel does on open; idempotent, so re-opening is free.
  useEffect(() => {
    load();
  }, [load]);

  const [scope, setScope] = useState<RegistryScope>(() => ({
    kind: 'through',
    episodeId: currentEpisodeId,
  }));
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<ReadonlySet<EntityKind>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
    focusId === undefined ? new Set() : new Set([focusId]),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Which `focusId` has already been honoured, so a scroll happens once. */
  const focused = useRef<string | null>(null);

  const toggleEntry = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleKind = useCallback((kind: EntityKind) => {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const changeScope = useCallback(
    (value: string) => {
      if (show === null) return;
      setScope(parseRegistryScope(value, show));
    },
    [show],
  );

  /*
   * The index, rebuilt every render (it is a few hundred events; no memo). The
   * cached map is whatever has landed so far, with the page's own copy of the
   * current episode laid over it — clipped to the playhead by `registryIndexAt`.
   * Until the rest of the archive arrives, `archived` is false and the episodes
   * the show lists but the map lacks are reported as "still indexing" rather
   * than as failures.
   */
  const archived = episodes !== null;
  const inputs = new Map(episodes ?? []);
  if (currentEpisode !== null) inputs.set(currentEpisodeId, currentEpisode);
  const index =
    show === null || registryLoading
      ? null
      : registryIndexAt(show, registry, inputs, currentEpisodeId, t);

  const ready = show !== null && index !== null;
  const scoped = ready ? scopeRegistry(index.entries, scope, show) : [];

  /*
   * The record's "Open in the Registry" lands here (R3 scenario 3): the entry is
   * expanded and brought into view — but only once the index has arrived, since
   * before that there is no element to scroll to.
   */
  useEffect(() => {
    if (focusId === undefined || !ready || focused.current === focusId) return;
    focused.current = focusId;
    setExpanded((prev) => new Set(prev).add(focusId));
    // Found by attribute rather than by selector: an entity id is author data
    // and need not be a valid CSS identifier.
    const element = [
      ...(containerRef.current?.querySelectorAll('[data-testid="registry-entry"]') ?? []),
    ].find((node) => node.getAttribute('data-npc') === focusId);
    // Scroll only the panel's own body: `scrollIntoView` would also move the document
    // (and the stage) under the viewer. jsdom has no layout, so guard on the numbers.
    if (element instanceof HTMLElement) {
      const scroller = element.closest<HTMLElement>('[data-testid="rail-panel-body"]');
      if (scroller && Number.isFinite(element.offsetTop) && Number.isFinite(scroller.offsetTop)) {
        scroller.scrollTop = Math.max(0, element.offsetTop - scroller.offsetTop - 8);
      }
    }
  }, [focusId, ready]);

  const metas = show === null ? [] : orderedEpisodes(show);
  const episodeTitles = new Map(metas.map((meta) => [meta.id, meta.title]));

  const visible = scoped.filter(
    (entry) =>
      (kinds.size === 0 || kinds.has(entry.entity.kind)) && matchesRegistryQuery(entry, query),
  );
  const sections = show === null ? [] : registrySections(visible, scope, show);

  // Counts read the whole scope, not the search inside it (as on the page).
  const kindCounts = new Map<EntityKind, number>();
  for (const entry of scoped) {
    kindCounts.set(entry.entity.kind, (kindCounts.get(entry.entity.kind) ?? 0) + 1);
  }

  const param = scopeParam(scope);
  const fullHref = `/registry${param === null ? '' : `?scope=${param}`}${
    focusId === undefined ? '' : `#${focusId}`
  }`;

  return (
    <div className={styles.browser} data-testid="registry-browser" ref={containerRef}>
      {ready && index.entries.length > 0 ? (
        <RegistryToolbar
          episodes={metas}
          scope={scope}
          onScopeChange={changeScope}
          query={query}
          onQueryChange={setQuery}
          kinds={kinds}
          onToggleKind={toggleKind}
          counts={kindCounts}
          compact
        />
      ) : null}

      {/* The other episodes are being pulled in the background; the video never
          stopped, and this episode is already listed above. */}
      {ready && archived ? null : (
        <p className={styles.loading} data-testid="registry-browser-loading">
          {copy.registryLoading}
        </p>
      )}

      {ready && archived && index.missingEpisodes.length > 0 ? (
        <div data-testid="registry-missing" data-count={index.missingEpisodes.length}>
          <SystemNotice>
            <p>{copy.registryMissing(index.missingEpisodes.length)}</p>
          </SystemNotice>
        </div>
      ) : null}

      {ready && archived && sections.length === 0 ? (
        <p className={styles.empty} data-testid="registry-empty">
          {/* Nothing filtered away and nothing aired yet reads as the strip's standby line. */}
          {query.trim() === '' && kinds.size === 0 ? copy.encounterEmpty : copy.registryNoMatch}
        </p>
      ) : null}

      {sections.length === 0 ? null : (
        <div className={styles.sections}>
          {sections.map((section) => (
            <section
              key={section.episodeId}
              className={styles.section}
              data-testid={`registry-section-${section.episodeId}`}
              aria-labelledby={`registry-browser-section-${section.episodeId}`}
            >
              <div className={styles.bar}>
                <h3
                  id={`registry-browser-section-${section.episodeId}`}
                  className={styles.barTitle}
                >
                  {copy.registryEpisodeSection(section.episodeId, section.title)}
                </h3>
                <span className={styles.barCount}>
                  {copy.registryCount(section.entries.length)}
                </span>
              </div>
              <div className={styles.entries}>
                {section.entries.map((entry) => (
                  <RegistryEntry
                    key={entry.entity.id}
                    entry={entry}
                    episodeTitles={episodeTitles}
                    expanded={expanded.has(entry.entity.id)}
                    onToggle={toggleEntry}
                    target={entry.entity.id === focusId}
                    currentEpisodeId={currentEpisodeId}
                    onSeek={onSeek}
                    onShare={onShare}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/*
        The way out, at the bottom where it belongs: the whole page, at whatever
        scope the panel is showing (R3 scenario 3). It is the only link in here —
        everything above either seeks or expands, and so keeps the video running.
      */}
      <p className={styles.footer}>
        <Link className={styles.full} data-testid="registry-browser-full" to={fullHref}>
          {copy.registryOpenFull}
        </Link>
      </p>
    </div>
  );
}

export default RegistryBrowser;
