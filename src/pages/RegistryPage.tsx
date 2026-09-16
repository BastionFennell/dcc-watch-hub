import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { EntityKind, EpisodeData } from '../data/types';
import { ENTITY_KINDS } from '../data/types';
import { useShow } from '../data/ShowContext';
import { useRegistry } from '../data/RegistryContext';
import { orderedEpisodes } from '../data/show';
import { fetchEpisode } from '../data/load';
import type {
  RegistryEntry as RegistryEntryModel,
  RegistryScope,
} from '../engine/registry';
import { parseRegistryScope, registryIndex, scopeParam, scopeRegistry } from '../engine/registry';
import { RegistryEntry } from '../components/RegistryEntry/RegistryEntry';
import { SystemNotice } from '../components/SystemNotice/SystemNotice';
import { copy } from '../copy';
import styles from './RegistryPage.module.css';

const EMPTY_INDEX = { entries: [] as RegistryEntryModel[], missingEpisodes: [] as number[] };

const ALL_SCOPE: RegistryScope = { kind: 'all' };

/** Case-insensitive substring over the name and every alias (US2 scenario 2). */
function matchesQuery(entry: RegistryEntryModel, query: string): boolean {
  if (query === '') return true;
  const needle = query.toLowerCase();
  if (entry.entity.name.toLowerCase().includes(needle)) return true;
  return (entry.entity.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle));
}

/**
 * The System Registry (FR-620..FR-622): every entity the archive has published,
 * filed under the episode it first appears in.
 *
 * It is deliberately *not* playhead-aware and not device-aware — it reads the
 * show, the registry and every episode file, and shows what was published
 * (FR-621). An episode that will not load costs its beats and is named in a
 * notice; everything else still renders (US2 scenario 6).
 */
export function RegistryPage() {
  const { show } = useShow();
  const { registry, loading: registryLoading } = useRegistry();
  const { hash } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [episodes, setEpisodes] = useState<ReadonlyMap<number, EpisodeData | null> | null>(null);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<ReadonlySet<EntityKind>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    document.title = copy.pageTitle(copy.registryTitle);
  }, []);

  // Every published episode at once: a rejected fetch lands as `null` rather
  // than taking the page down with it (research R5).
  useEffect(() => {
    if (show === null) return;
    let live = true;
    const metas = orderedEpisodes(show);
    void Promise.allSettled(metas.map((meta) => fetchEpisode(meta))).then((results) => {
      if (!live) return;
      const next = new Map<number, EpisodeData | null>();
      results.forEach((result, index) => {
        const meta = metas[index];
        if (meta === undefined) return;
        next.set(meta.id, result.status === 'fulfilled' ? result.value : null);
      });
      setEpisodes(next);
    });
    return () => {
      live = false;
    };
  }, [show]);

  const index =
    show !== null && registry !== null && episodes !== null
      ? registryIndex(show, registry, episodes)
      : EMPTY_INDEX;

  /*
   * The scope is URL state, not component state (R2-FR-631): the view is
   * shareable, the back button works, and an unreadable `?scope=` opens the
   * whole archive rather than an error.
   */
  const scope = show === null ? ALL_SCOPE : parseRegistryScope(params.get('scope'), show);

  /*
   * Written by hand rather than through `setSearchParams`, which navigates to
   * "?<params>" and so drops the hash — and the hash is what keeps a named
   * entry open while the viewer narrows the scope around it.
   */
  const setScope = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params);
      const param = show === null ? null : scopeParam(parseRegistryScope(value, show));
      if (param === null) next.delete('scope');
      else next.set('scope', param);
      const search = next.toString();
      void navigate({ search: search === '' ? '' : `?${search}`, hash }, { replace: false });
    },
    [params, show, hash, navigate],
  );

  // Everything downstream — search, chips, counts, sections — reads the scoped
  // list, so narrowing the scope narrows the whole page at once (R2 scenario 2).
  const scoped = show === null ? index.entries : scopeRegistry(index.entries, scope, show);

  const targetId = hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : '';
  const seeded = useRef<string | null>(null);
  const presentIds = scoped.map((entry) => entry.entity.id).join(',');

  /*
   * `/registry#<id>` opens that entry and scrolls to it, but only once the data
   * has landed — before that there is no element to scroll to (US2 scenario 5).
   */
  useEffect(() => {
    if (targetId === '' || seeded.current === targetId) return;
    if (!presentIds.split(',').includes(targetId)) return;
    seeded.current = targetId;
    setExpanded((prev) => new Set(prev).add(targetId));
    const element = document.getElementById(targetId);
    // jsdom has no layout, so it has no scrollIntoView.
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'start' });
    }
  }, [targetId, presentIds]);

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

  const head = (
    <div className={styles.head}>
      <p className={styles.kicker}>{copy.registryKicker}</p>
      <h1 className={styles.title}>{copy.registryTitle}</h1>
      <p className={styles.lead}>{copy.registryLead}</p>
    </div>
  );

  if (show === null || registryLoading) {
    return (
      <div className={styles.page} data-testid="registry">
        {head}
        <SystemNotice>
          <p>{copy.registryLoading}</p>
        </SystemNotice>
      </div>
    );
  }

  if (registry === null) {
    return (
      <div className={styles.page} data-testid="registry">
        {head}
        <SystemNotice>
          <p>{copy.registryUnavailable}</p>
        </SystemNotice>
      </div>
    );
  }

  if (episodes === null) {
    return (
      <div className={styles.page} data-testid="registry">
        {head}
        <SystemNotice>
          <p>{copy.registryLoading}</p>
        </SystemNotice>
      </div>
    );
  }

  const trimmed = query.trim();
  const visible = scoped.filter(
    (entry) =>
      (kinds.size === 0 || kinds.has(entry.entity.kind)) && matchesQuery(entry, trimmed),
  );

  const metas = orderedEpisodes(show);
  const episodeTitles = new Map(metas.map((meta) => [meta.id, meta.title]));
  /*
   * Which episodes can hold a section at all: every one in "all", those at or
   * before N in "through", and exactly N in "only" — where the cast is filed
   * under the episode being watched rather than under its members' debuts.
   */
  const scopeIndex =
    scope.kind === 'all' ? -1 : metas.findIndex((meta) => meta.id === scope.episodeId);
  const sectionMetas =
    scopeIndex === -1
      ? metas
      : scope.kind === 'through'
        ? metas.slice(0, scopeIndex + 1)
        : metas.slice(scopeIndex, scopeIndex + 1);
  // Sections follow broadcast order and only exist where something lands in
  // them: an episode that debuts nobody has no section at all.
  const sections = sectionMetas
    .map((meta) => ({
      meta,
      entries:
        scope.kind === 'only'
          ? visible
          : visible.filter((entry) => entry.firstEpisode === meta.id),
    }))
    .filter((section) => section.entries.length > 0);

  // Counts read the whole scope, not the search inside it, so a chip says how
  // much this view holds rather than flickering as the search is typed.
  const kindCounts = new Map<EntityKind, number>();
  for (const entry of scoped) {
    kindCounts.set(entry.entity.kind, (kindCounts.get(entry.entity.kind) ?? 0) + 1);
  }

  return (
    <div className={styles.page} data-testid="registry">
      {head}

      {index.entries.length > 0 ? (
        <div className={styles.toolbar}>
          {/*
            The first control, before the search: it decides what there is to
            search. A plain labelled `<select>` — keyboard-first, and the
            platform's own picker on a phone (R2-FR-633).
          */}
          <select
            className={styles.scope}
            data-testid="registry-scope"
            aria-label={copy.registryScope}
            value={scopeParam(scope) ?? 'all'}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">{copy.registryScopeAll}</option>
            <optgroup label={copy.registryScopeGroupThrough}>
              {metas.map((meta) => (
                <option key={`through-${meta.id}`} value={`through-${meta.id}`}>
                  {copy.registryScopeThrough(meta.title)}
                </option>
              ))}
            </optgroup>
            <optgroup label={copy.registryScopeGroupOnly}>
              {metas.map((meta) => (
                <option key={`ep-${meta.id}`} value={`ep-${meta.id}`}>
                  {copy.registryScopeOnly(meta.title)}
                </option>
              ))}
            </optgroup>
          </select>
          <input
            type="search"
            className={styles.search}
            data-testid="registry-search"
            aria-label={copy.registrySearch}
            placeholder={copy.registrySearch}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.chips} role="group" aria-label={copy.registryKinds}>
            {ENTITY_KINDS.filter((kind) => (kindCounts.get(kind) ?? 0) > 0).map((kind) => (
              <button
                key={kind}
                type="button"
                className={styles.chip}
                data-testid={`registry-chip-${kind}`}
                aria-pressed={kinds.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                <span className={styles.chipLabel}>{copy.kindLabels[kind]}</span>
                <span className={styles.chipCount}>{kindCounts.get(kind) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {index.missingEpisodes.length > 0 ? (
        <div data-testid="registry-missing" data-count={index.missingEpisodes.length}>
          <SystemNotice>
            <p>{copy.registryMissing(index.missingEpisodes.length)}</p>
          </SystemNotice>
        </div>
      ) : null}

      {sections.length === 0 ? (
        <p className={styles.empty} data-testid="registry-empty">
          {copy.registryNoMatch}
        </p>
      ) : (
        <div className={styles.sections}>
          {sections.map(({ meta, entries }) => (
            <section
              key={meta.id}
              className={styles.section}
              data-testid={`registry-section-${meta.id}`}
              aria-labelledby={`registry-section-title-${meta.id}`}
            >
              <div className={styles.bar}>
                <h2 id={`registry-section-title-${meta.id}`} className={styles.barTitle}>
                  {copy.registryEpisodeSection(meta.id, meta.title)}
                </h2>
                <span className={styles.barCount}>{copy.registryCount(entries.length)}</span>
              </div>
              <div className={styles.entries}>
                {entries.map((entry) => (
                  <RegistryEntry
                    key={entry.entity.id}
                    entry={entry}
                    episodeTitles={episodeTitles}
                    expanded={expanded.has(entry.entity.id)}
                    onToggle={toggleEntry}
                    target={entry.entity.id === targetId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default RegistryPage;
