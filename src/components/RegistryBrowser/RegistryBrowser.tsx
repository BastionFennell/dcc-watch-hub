import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { EntityKind } from '../../data/types';
import { useShow } from '../../data/ShowContext';
import { useRegistryIndex } from '../../data/RegistryIndexContext';
import { orderedEpisodes } from '../../data/show';
import type { RegistryScope } from '../../engine/registry';
import {
  matchesRegistryQuery,
  parseRegistryScope,
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
 * Nothing here is playhead-aware: the panel is publication-scoped, so a seek
 * behind it changes the strip and leaves this exactly as it was (R3 scenario 5).
 */
export function RegistryBrowser({
  currentEpisodeId,
  focusId,
  onSeek,
  onShare,
}: RegistryBrowserProps) {
  const { show } = useShow();
  const { index, load } = useRegistryIndex();

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
    // jsdom has no layout, so it has no scrollIntoView.
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'start' });
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

      {/* The archive is being pulled in the background; the video never stopped. */}
      {ready ? null : (
        <p className={styles.loading} data-testid="registry-browser-loading">
          {copy.registryLoading}
        </p>
      )}

      {ready && index.missingEpisodes.length > 0 ? (
        <div data-testid="registry-missing" data-count={index.missingEpisodes.length}>
          <SystemNotice>
            <p>{copy.registryMissing(index.missingEpisodes.length)}</p>
          </SystemNotice>
        </div>
      ) : null}

      {ready && sections.length === 0 ? (
        <p className={styles.empty} data-testid="registry-empty">
          {copy.registryNoMatch}
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
