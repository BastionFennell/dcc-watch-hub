import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { EntityKind } from '../data/types';
import { useShow } from '../data/ShowContext';
import { useRegistry } from '../data/RegistryContext';
import { useRegistryIndex } from '../data/RegistryIndexContext';
import { orderedEpisodes } from '../data/show';
import type { RegistryScope } from '../engine/registry';
import {
  matchesRegistryQuery,
  parseRegistryScope,
  registrySections,
  scopeParam,
  scopeRegistry,
} from '../engine/registry';
import { RegistryEntry } from '../components/RegistryEntry/RegistryEntry';
import { RegistryToolbar } from '../components/RegistryToolbar/RegistryToolbar';
import { SystemNotice } from '../components/SystemNotice/SystemNotice';
import { HubHead } from '../site/pages/lazy';
import { copy } from '../copy';
import styles from './RegistryPage.module.css';

const ALL_SCOPE: RegistryScope = { kind: 'all' };

/**
 * The System Registry (FR-620..FR-622): every entity the archive has published,
 * filed under the episode it first appears in.
 *
 * It is deliberately *not* playhead-aware and not device-aware - it reads the
 * show, the registry and every episode file, and shows what was published
 * (FR-621). An episode that will not load costs its beats and is named in a
 * notice; everything else still renders (US2 scenario 6).
 *
 * Since revision 3 the episode files come from `RegistryIndexProvider`, which
 * this page asks to load on mount and the rail panel asks on open - whoever
 * arrives first pays for the fetches and the other reads the cache (R3-FR-644).
 */
export function RegistryPage() {
  const { show } = useShow();
  const { registry, loading: registryLoading } = useRegistry();
  const { index, load } = useRegistryIndex();
  const { hash } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<ReadonlySet<EntityKind>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  // The whole point of the page: ask for the index the moment it opens.
  useEffect(() => {
    load();
  }, [load]);

  /*
   * The scope is URL state, not component state (R2-FR-631): the view is
   * shareable, the back button works, and an unreadable `?scope=` opens the
   * whole archive rather than an error page.
   */
  const scope = show === null ? ALL_SCOPE : parseRegistryScope(params.get('scope'), show);

  /*
   * Written by hand rather than through `setSearchParams`, which navigates to
   * "?<params>" and so drops the hash - and the hash is what keeps a named
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

  // Everything downstream - search, chips, counts, sections - reads the scoped
  // list, so narrowing the scope narrows the whole page at once (R2 scenario 2).
  const scoped =
    show === null || index === null ? [] : scopeRegistry(index.entries, scope, show);

  const targetId = hash.startsWith('#') ? decodeURIComponent(hash.slice(1)) : '';
  const seeded = useRef<string | null>(null);
  const presentIds = scoped.map((entry) => entry.entity.id).join(',');

  /*
   * `/registry#<id>` opens that entry and scrolls to it, but only once the data
   * has landed - before that there is no element to scroll to (US2 scenario 5).
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

  /*
   * The Codex is client-rendered like the rest of the hub, so its head is
   * written after boot rather than prerendered (011 T1126). <Seo> replaces the
   * effect that used to set document.title: React 19 hoists the <title>.
   */
  const head = (
    <>
      <Suspense fallback={null}>
        <HubHead kind="codex" />
      </Suspense>
    <div className={styles.head}>
      <p className={styles.kicker}>{copy.registryKicker}</p>
      <h1 className={styles.title}>{copy.registryTitle}</h1>
      <p className={styles.lead}>{copy.registryLead}</p>
    </div>
    </>
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

  if (index === null) {
    return (
      <div className={styles.page} data-testid="registry">
        {head}
        <SystemNotice>
          <p>{copy.registryLoading}</p>
        </SystemNotice>
      </div>
    );
  }

  const visible = scoped.filter(
    (entry) =>
      (kinds.size === 0 || kinds.has(entry.entity.kind)) && matchesRegistryQuery(entry, query),
  );

  const metas = orderedEpisodes(show);
  const episodeTitles = new Map(metas.map((meta) => [meta.id, meta.title]));
  // Sections follow broadcast order and only exist where something lands in
  // them: an episode that debuts nobody has no section at all.
  const sections = registrySections(visible, scope, show);

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
        <RegistryToolbar
          episodes={metas}
          scope={scope}
          onScopeChange={setScope}
          query={query}
          onQueryChange={setQuery}
          kinds={kinds}
          onToggleKind={toggleKind}
          counts={kindCounts}
        />
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
          {sections.map((section) => (
            <section
              key={section.episodeId}
              className={styles.section}
              data-testid={`registry-section-${section.episodeId}`}
              aria-labelledby={`registry-section-title-${section.episodeId}`}
            >
              <div className={styles.bar}>
                <h2
                  id={`registry-section-title-${section.episodeId}`}
                  className={styles.barTitle}
                >
                  {copy.registryEpisodeSection(section.episodeId, section.title)}
                </h2>
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
