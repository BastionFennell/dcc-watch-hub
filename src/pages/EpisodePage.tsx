import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShow } from '../data/ShowContext';
import { useRegistry } from '../data/RegistryContext';
import { fetchEpisode } from '../data/load';
import { findEpisode, prevNext } from '../data/show';
import type { EpisodeData } from '../data/types';
import { reduceTo } from '../engine/reducer';
import {
  activeSponsor,
  activeToast,
  crawlerDossier,
  crawlerGlance,
  encounteredNpcs,
  feedItems,
  logItems,
  mapCells,
  mapLabels,
  npcRecord,
  partyFrames,
  recentlyRevealed,
  timelineMarkers,
} from '../engine/selectors';
import { spellIndex } from '../engine/spells';
import type { TimeSource } from '../playback/TimeSource';
import { formatTime } from '../engine/time';
import { usePlayhead } from '../playback/usePlayhead';
import { useDeepLink } from '../playback/useDeepLink';
import { useResume } from '../playback/useResume';
import { usePanel } from '../hooks/usePanel';
import { useIsPhone } from '../hooks/useIsPhone';
import { useMiniPlayer } from '../hooks/useMiniPlayer';
import { loadLogOpen, saveLogOpen } from '../prefs/logOpen';
import { useShare } from '../share/useShare';
import { VideoStage } from '../components/VideoStage/VideoStage';
import { AchievementToast } from '../components/AchievementToast/AchievementToast';
import { MiniMapBadge } from '../components/MiniMapBadge/MiniMapBadge';
import { NextEpisodeCard } from '../components/NextEpisodeCard/NextEpisodeCard';
import { EventTimeline } from '../components/EventTimeline/EventTimeline';
import { PartyRail } from '../components/PartyRail/PartyRail';
import { EncounterRail } from '../components/EncounterRail/EncounterRail';
import { NpcRecord } from '../components/NpcRecord/NpcRecord';
import { RegistryBrowser } from '../components/RegistryBrowser/RegistryBrowser';
import { EventFeed } from '../components/EventFeed/EventFeed';
import { EpisodeLog } from '../components/EpisodeLog/EpisodeLog';
import { MobileTabs } from '../components/MobileTabs/MobileTabs';
import type { MobileTab } from '../components/MobileTabs/MobileTabs';
import { RailPanel } from '../components/RailPanel/RailPanel';
import { CrawlerGlance } from '../components/CrawlerGlance/CrawlerGlance';
import { FullRecordDialog } from '../components/FullRecord/FullRecordDialog';
import { FloorMap } from '../components/FloorMap/FloorMap';
import { ResumeCard } from '../components/ResumeCard/ResumeCard';
import { ShareButton } from '../components/ShareButton/ShareButton';
import { ShareNotice } from '../components/ShareNotice/ShareNotice';
import { SystemNotice } from '../components/SystemNotice/SystemNotice';
import { NotFoundPage } from './NotFoundPage';
import { copy } from '../copy';
import styles from './EpisodePage.module.css';

const EMPTY_PARTY = [] as const;
const EMPTY_CELLS = new Set<string>();

/**
 * The watch page. Everything below the stage is recomputed from `(episode, t)`
 * on every render - no memoization, no incremental patching, so a seek in either
 * direction is automatically correct (constitution I, FR-001/002/003).
 */
export function EpisodePage() {
  const { id } = useParams();
  const { show } = useShow();
  /*
   * The entity registry (007 R1). `null` for a show that declares no
   * `registryUrl` - and for one whose registry failed to load - in which case
   * every piece of NPC chrome below is simply absent and `npc` events still
   * show in the feed under their raw id (spec Edge Cases).
   */
  const { registry, spells } = useRegistry();
  /*
   * The book's spells (008 R4), indexed once. A sheet entry carrying `ref`
   * inherits its name and text from here; without the file (or with a ref it
   * does not carry) the entry falls back to whatever the sheet itself says.
   */
  const spellsById = useMemo(() => spellIndex(spells), [spells]);

  const [source, setSource] = useState<TimeSource | null>(null);
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [failed, setFailed] = useState(false);

  const validId = id !== undefined && /^\d+$/.test(id);
  const episodeId = validId ? Number(id) : Number.NaN;
  const meta = show && validId ? findEpisode(show, episodeId) : undefined;

  const playhead = usePlayhead(source);
  const { t, ended, playing } = playhead;
  // Viewer state, not overlay state: which record is open. Resets per episode.
  const panelApi = usePanel(meta?.id);
  const { panel } = panelApi;
  /*
   * Viewer state as well (data-model.md): which crawler's full record covers the
   * stage, or `null`. Never persisted and never derived from events - the
   * record's *content* is derived; this is only what the viewer asked to see.
   */
  const [record, setRecord] = useState<string | null>(null);
  /** The "Open full record" button, so the dialog can hand focus back (FR-210). */
  const recordTrigger = useRef<HTMLElement | null>(null);
  // DEV only: `?panel=dossier:<id>`, `?panel=npc:<id>`, `?panel=map`,
  // `?panel=registry` or `?panel=registry:<id>` opens a panel on load
  // (screenshots, manual QA).
  const [searchParams] = useSearchParams();
  const devPanel = import.meta.env.DEV ? searchParams.get('panel') : null;
  const devRecord = import.meta.env.DEV && searchParams.get('record') === '1';
  const devRecordOpened = useRef(false);
  const partyLoaded = episode !== null;
  useEffect(() => {
    if (!devPanel || !partyLoaded) return;
    if (devPanel === 'map') panelApi.open({ kind: 'map' }, null);
    else if (devPanel.startsWith('dossier:')) panelApi.open({ kind: 'dossier', crawlerId: devPanel.slice(8) }, null);
    else if (devPanel.startsWith('npc:')) panelApi.open({ kind: 'npc', npcId: devPanel.slice(4) }, null);
    else if (devPanel === 'registry') panelApi.open({ kind: 'registry' }, null);
    else if (devPanel.startsWith('registry:'))
      panelApi.open({ kind: 'registry', focusId: devPanel.slice(9) }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per episode load
  }, [devPanel, partyLoaded, meta?.id]);

  // The record cannot outlive the glance card that opened it: closing the panel,
  // or switching to another crawler or to the map, closes it too (FR-213).
  useEffect(() => {
    if (record !== null && (panel.kind !== 'dossier' || panel.crawlerId !== record)) setRecord(null);
  }, [panel, record]);

  // A new episode always opens ambient - no panel (usePanel) and no record (US2 scenario 7).
  useEffect(() => {
    setRecord(null);
    devRecordOpened.current = false;
  }, [meta?.id]);

  // DEV only: `?panel=dossier:<id>&record=1` opens the record once the panel the
  // flag names is actually open, so a screenshot run lands on the full sheet.
  useEffect(() => {
    if (!devRecord || panel.kind !== 'dossier' || devRecordOpened.current) return;
    devRecordOpened.current = true;
    setRecord(panel.crawlerId);
  }, [devRecord, panel]);
  /*
   * A production deep link (`?t=`) moves the playhead once per visit and wins
   * over the saved position for that visit (004 FR-300/301). Everything below
   * the stage recomputes from the new time like it does after any other seek.
   */
  const { linkedT } = useDeepLink(meta, source);
  // Persisted playhead only, never overlay state (constitution I, FR-133).
  const resume = useResume(meta, source, playhead, undefined, {
    suppressOffer: linkedT !== null,
  });

  /*
   * The log's open/closed state is a viewer preference, read once per mount so a
   * later save cannot re-open it under the viewer (005 FR-400). Constitution I
   * allows it: a boolean about chrome, never overlay state.
   */
  const [logOpen] = useState(loadLogOpen);

  /*
   * The phone layout (006). Viewer state, not overlay state: a media query and
   * an IntersectionObserver, neither of which knows anything about the event
   * log. `phone` false - which is what jsdom and any host without `matchMedia`
   * report - renders exactly the tree every earlier test asserts (FR-505).
   */
  const phone = useIsPhone();
  /*
   * The resume offer and the ended card need the full stage, so either one
   * cancels the mini-player rather than shrinking with it (FR-501).
   */
  const mini = useMiniPlayer({
    enabled: phone,
    cancel: resume.pending !== null || ended,
  });

  /*
   * Sharing a moment (004 US2). Viewer state, not overlay state: a transient
   * System notice with its own short timer (spec Assumptions). It reads the
   * playhead and never moves it (FR-306).
   */
  const share = useShare({ episodeId: meta?.id ?? 0, episodeTitle: meta?.title ?? '' });
  const dismissShare = share.dismiss;
  // A confirmation belongs to the episode it was raised on.
  useEffect(() => {
    dismissShare();
  }, [meta?.id, dismissShare]);

  useEffect(() => {
    if (!meta) return;
    let live = true;
    setEpisode(null);
    setFailed(false);
    fetchEpisode(meta)
      .then((data) => {
        if (live) setEpisode(data);
      })
      .catch(() => {
        // The stage keeps playing; only the overlay is unavailable (spec Edge Cases).
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [meta]);

  const party = episode ? episode.initialState.party : EMPTY_PARTY;
  const state = episode ? reduceTo(episode, t) : null;

  /*
   * An entity record the playhead has rewound past: the party has not met it at
   * this `t`, so there is nothing to show and the panel closes rather than
   * holding a stale record (FR-611, constitution I). Computed above the early
   * returns because the effect that acts on it is a hook.
   */
  const staleRecord =
    panel.kind === 'npc' && state !== null && episode !== null
      ? npcRecord(state, episode.events, registry, panel.npcId) === null
      : false;
  const closePanel = panelApi.close;
  useEffect(() => {
    if (staleRecord) closePanel();
  }, [staleRecord, closePanel]);

  useEffect(() => {
    if (meta) document.title = copy.pageTitle(meta.title);
  }, [meta]);

  // The stage destroys its own source on unmount; this covers a source swap.
  useEffect(() => () => source?.destroy(), [source]);

  if (!validId) return <NotFoundPage />;
  if (!show) return null;
  if (!meta) return <NotFoundPage />;

  // The episode being watched, hoisted out of `meta` so the closures below (the
  // rail panel, the strip, the phone sheet) can carry it into the Registry's
  // scope without re-narrowing (T720).
  const currentEpisodeId = meta.id;

  const frames = state && episode ? partyFrames(state, episode.events, t) : [];
  const items = episode ? feedItems(episode.events, t, 8, party, registry, spellsById) : [];
  // The whole elapsed transcript, oldest first - the feed's eight rows are a
  // window onto this (005 FR-401).
  const log = episode ? logItems(episode.events, t, party, registry, spellsById) : [];
  const sponsor = episode ? activeSponsor(episode.events, t, party) : null;
  // A pinned sponsor is not repeated in the list; it rejoins the feed when its window closes.
  const listed = sponsor ? items.filter((item) => item.id !== sponsor.id) : items;
  const toast = episode ? activeToast(episode.events, t, party) : null;
  const markers = episode ? timelineMarkers(episode.events, meta.durationSec, party) : [];
  const cells = state ? mapCells(state) : null;
  const recent = episode ? recentlyRevealed(episode.events, t) : EMPTY_CELLS;
  // One derivation for both the rail's map panel and the phone's Map tab.
  const labels = episode ? mapLabels(episode.events, t) : [];
  const { next } = prevNext(show, meta.id);
  /*
   * The Encountered strip (FR-610): newest first, and empty - standby line and
   * all - until the first `npc` event elapses. Without a registry there is
   * nothing to name, so the strip and the phone's NPCs tab do not exist at all.
   */
  const encounters = state ? encounteredNpcs(state, registry) : [];

  // The dossier, like everything else, is derived at render time - a seek in
  // either direction is correct with no extra work (constitution I, FR-103).
  const dossier =
    panel.kind === 'dossier' && state && episode
      ? crawlerDossier(state, episode.events, t, panel.crawlerId, party, spellsById)
      : null;

  /** The open entity record, derived at render time like everything else. */
  const entity =
    panel.kind === 'npc' && state && episode
      ? npcRecord(state, episode.events, registry, panel.npcId, party, t)
      : null;

  /**
   * No episode data behind the overlay: the System says so once, wherever the
   * viewer is looking - the feed, or the phone's Map tab (spec Edge Cases).
   */
  const notice = failed ? (
    <SystemNotice tone="error">{copy.feedUnavailable}</SystemNotice>
  ) : !episode ? (
    <p className={styles.loading}>{copy.feedLoading}</p>
  ) : null;

  const feed = (
    <EventFeed
      items={listed}
      sponsor={sponsor}
      t={t}
      onSeek={(sec) => source?.seek(sec)}
      onShare={(sec) => void share.share(sec)}
      notice={notice}
    />
  );

  /**
   * The glance card the dossier panel carries, in the rail on desktop and in the
   * bottom sheet on a phone - one card, one "Open full record" trigger (FR-504).
   */
  const glanceCard = dossier ? (
    <CrawlerGlance
      glance={crawlerGlance(dossier)}
      onOpenRecord={(trigger) => {
        recordTrigger.current = trigger;
        setRecord(dossier.id);
      }}
    />
  ) : null;

  /**
   * The open entity record, in the rail on desktop and in the sheet on a phone
   * - one component, one "Open in the Registry" trigger. That trigger opens the
   * Registry panel rather than leaving the episode (R3 scenario 3), and hands
   * focus return to the strip chip that opened this record, which is still on
   * screen behind the panel.
   */
  const entityRecord = entity ? (
    <NpcRecord
      record={entity}
      episodeId={currentEpisodeId}
      onSeek={(sec) => source?.seek(sec)}
      onShare={(sec) => void share.share(sec)}
      onOpenRegistry={(entityId) => {
        const chip = document.querySelector<HTMLElement>(
          `[data-panel-trigger="npc:${entityId}"]`,
        );
        panelApi.open({ kind: 'registry', focusId: entityId }, chip);
      }}
    />
  ) : null;

  /**
   * The Registry panel's contents. Its two controls are the only things in it
   * that touch the broadcast, and both are explicit: a moment in this episode
   * seeks, and the share icon copies its link (R3-FR-642).
   *
   * It is handed this episode and the playhead, so its current-episode half
   * follows the broadcast the way the strip does (R4-FR-651) while the earlier
   * episodes it pulls for itself stay whole.
   */
  const registryBrowser = (
    <RegistryBrowser
      currentEpisodeId={currentEpisodeId}
      currentEpisode={episode}
      t={t}
      focusId={panel.kind === 'registry' ? panel.focusId : undefined}
      onSeek={(sec) => source?.seek(sec)}
      onShare={(sec) => void share.share(sec)}
    />
  );

  /** The rail hosts exactly one of: feed (default), dossier, map (FR-100). */
  function railSlot() {
    switch (panel.kind) {
      case 'dossier':
        // No dossier means no episode data behind it: the feed carries the
        // System's unavailable notice (spec Edge Cases).
        if (!dossier) return feed;
        return (
          <RailPanel
            kicker={copy.glanceKicker}
            title={copy.dossierTitle(dossier.name)}
            onClose={panelApi.close}
          >
            {glanceCard}
          </RailPanel>
        );
      case 'npc':
        // As with the dossier: nothing to show means no episode data behind it.
        // An entity the playhead has rewound past closes the panel instead
        // (the effect above), so this is only ever the loading case.
        if (!entity) return feed;
        return (
          <RailPanel kicker={copy.npcKicker} title={entity.name} onClose={panelApi.close}>
            {entityRecord}
          </RailPanel>
        );
      case 'registry':
        /*
         * The whole Registry beside the stage (007 R3). Unlike every other
         * panel it needs no episode data to open - it reads the published
         * archive - so it opens while the episode file is still landing, and
         * opening it neither seeks nor pauses (R3 scenario 4). What this
         * episode contributes arrives with the file, clipped to the playhead.
         */
        return (
          <RailPanel
            kicker={copy.registryPanelKicker}
            title={copy.registryTitle}
            onClose={panelApi.close}
          >
            {registryBrowser}
          </RailPanel>
        );
      case 'map':
        // As with the dossier: no cells means no episode data behind them, so
        // the feed carries the System's unavailable notice (spec Edge Cases).
        if (!cells || !episode) return feed;
        return (
          <RailPanel
            kicker={copy.mapKicker}
            title={copy.mapTitle(cells.floor)}
            onClose={panelApi.close}
          >
            <FloorMap cells={cells} recent={recent} labels={labels} floor={cells.floor} />
          </RailPanel>
        );
      default:
        return feed;
    }
  }

  /* ------------------------------------------------- 006: the phone layout */

  /**
   * The overlays drawn over the player. The minimap badge is not one of them on
   * a phone: the Map tab is the map, and a badge that opens a second one would
   * duplicate it (FR-503).
   */
  const stageOverlays = (
    <>
      <AchievementToast toast={toast} />
      {!phone && cells ? (
        <MiniMapBadge
          cells={cells}
          recent={recent}
          expanded={panel.kind === 'map'}
          onActivate={(element) => panelApi.toggle({ kind: 'map' }, element)}
        />
      ) : null}
      {resume.pending ? (
        <ResumeCard t={resume.pending.t} onRejoin={resume.rejoin} onStartOver={resume.startOver} />
      ) : null}
      {ended ? (
        <div className={styles.endedOverlay}>
          <NextEpisodeCard next={next} />
        </div>
      ) : null}
    </>
  );

  const captionBlock = (
    /*
      The caption row (review 0.11/0.13, T340). It used to sit inside the
      stage, where the host's own control bar covered it and the episode
      title never appeared at all. Out here it is legible at every width,
      and its left half is the page's one `<h1>`.
    */
    <div className={styles.captionBlock}>
      <div className={styles.captionRow} data-testid="stage-caption-row">
        <h1 className={styles.captionTitle}>{copy.captionLeft(meta.id, meta.floor, meta.title)}</h1>
        <div className={styles.captionRight}>
          <span className={styles.captionTime} data-testid="stage-caption-time">
            {formatTime(t)}
          </span>
          {/* "Share this moment", beside the time it is about (004 FR-302). */}
          <ShareButton testId="share-moment" onClick={() => void share.share(t)} />
        </div>
      </div>
      {/*
        The confirmation sits directly under the row that raised it. Its
        live region is always mounted and weightless until it has
        something to say, so the stage above never moves (T407).
      */}
      <ShareNotice status={share.status} url={share.url} onDismiss={share.dismiss} />
    </div>
  );

  const timeline = (
    <EventTimeline
      markers={markers}
      t={t}
      durationSec={meta.durationSec}
      onSeek={(sec) => source?.seek(sec)}
    />
  );

  function partyRail(layout: 'row' | 'grid') {
    return (
      <PartyRail
        frames={frames}
        activeId={panel.kind === 'dossier' ? panel.crawlerId : null}
        onActivate={(id, element) => panelApi.toggle({ kind: 'dossier', crawlerId: id }, element)}
        layout={layout}
      />
    );
  }

  /**
   * The Encountered strip (FR-610). Chips are panel triggers exactly as crawler
   * frames are, so the rail's one slot holds either a dossier or a record.
   */
  function encounterRail(layout: 'row' | 'grid') {
    return (
      <EncounterRail
        encounters={encounters}
        activeId={panel.kind === 'npc' ? panel.npcId : null}
        onActivate={(entityId, element) =>
          panelApi.toggle({ kind: 'npc', npcId: entityId }, element)
        }
        layout={layout}
        onBrowse={(element) => panelApi.toggle({ kind: 'registry' }, element)}
        browsing={panel.kind === 'registry'}
      />
    );
  }

  /**
   * The broadcast log (005 US1/US2). Embedded, it is the Log tab's whole pane:
   * always open, no toggle - the tab is the open/closed control (FR-503).
   */
  function broadcastLog(embedded: boolean) {
    return (
      <EpisodeLog
        items={log}
        party={party}
        t={t}
        playing={playing}
        onSeek={(sec) => source?.seek(sec)}
        onShare={(sec) => void share.share(sec)}
        initialOpen={logOpen}
        onOpenChange={saveLogOpen}
        embedded={embedded}
      />
    );
  }

  /**
   * The four phone panes (FR-503), all fed by the same playhead-derived data the
   * desktop tree uses. The Map pane is the rail panel's floor map inline - with
   * no episode behind it, the System's notice instead (spec Edge Cases).
   */
  function phoneTabs(): MobileTab[] {
    const tabs: MobileTab[] = [
      { id: 'feed', label: copy.tabFeed, content: feed },
      { id: 'party', label: copy.tabParty, content: partyRail('grid') },
      {
        id: 'map',
        label: copy.tabMap,
        content:
          cells && episode ? (
            <section className={styles.mapPane} aria-label={copy.mapTitle(cells.floor)}>
              <FloorMap cells={cells} recent={recent} labels={labels} floor={cells.floor} />
            </section>
          ) : (
            notice
          ),
      },
      { id: 'log', label: copy.tabLog, content: broadcastLog(true) },
    ];
    // The fifth pane exists only for a show that ships a registry (FR-610).
    if (registry) {
      tabs.push({ id: 'npcs', label: copy.tabNpcs, content: encounterRail('grid') });
    }
    return tabs;
  }

  /**
   * On a phone the dossier panel is a bottom sheet over the tabs, with the
   * stage still visible above it (FR-504). The map panel kind cannot happen
   * here - nothing opens it once the badge is gone - so it renders nothing.
   */
  function phoneSheet() {
    if (panel.kind === 'registry') {
      return (
        <RailPanel
          kicker={copy.registryPanelKicker}
          title={copy.registryTitle}
          presentation="sheet"
          onClose={panelApi.close}
        >
          {registryBrowser}
        </RailPanel>
      );
    }
    if (panel.kind === 'npc') {
      if (!entity) return null;
      return (
        <RailPanel
          kicker={copy.npcKicker}
          title={entity.name}
          presentation="sheet"
          onClose={panelApi.close}
        >
          {entityRecord}
        </RailPanel>
      );
    }
    if (panel.kind !== 'dossier' || !dossier) return null;
    return (
      <RailPanel
        kicker={copy.glanceKicker}
        title={copy.dossierTitle(dossier.name)}
        presentation="sheet"
        onClose={panelApi.close}
      >
        {glanceCard}
      </RailPanel>
    );
  }

  if (phone) {
    return (
      <div className={styles.page} data-ended={ended ? 'true' : undefined}>
        <div className={styles.phone}>
          {/*
            The 1 px mark the mini-player watches: a sibling immediately above
            the stage's slot, so "the stage has scrolled up past the header" is
            one observation and never a measurement (FR-500, research R1).
          */}
          <div
            ref={mini.sentinelRef}
            className={styles.sentinel}
            data-testid="stage-sentinel"
            aria-hidden="true"
          />
          <VideoStage
            key={meta.id}
            meta={meta}
            t={t}
            onSource={setSource}
            mini={mini.docked}
            onExitMini={mini.exitMini}
            hideBadge
          >
            {stageOverlays}
          </VideoStage>

          {captionBlock}
          {timeline}

          {/* Feed, party, map and log - one tap apart, under the timeline (FR-502). */}
          <MobileTabs label={copy.tabsLabel} tabs={phoneTabs()} />
        </div>

        {phoneSheet()}

        {dossier ? (
          <FullRecordDialog
            dossier={dossier}
            meta={meta}
            open={record === dossier.id}
            onClose={() => setRecord(null)}
            returnFocusTo={recordTrigger.current}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page} data-ended={ended ? 'true' : undefined}>
      <div className={styles.grid}>
        <div className={styles.main}>
          <VideoStage key={meta.id} meta={meta} t={t} onSource={setSource}>
            {stageOverlays}
          </VideoStage>

          {captionBlock}

          {timeline}

          {partyRail('row')}

          {/* Under the rail, and only for a show with a registry (FR-610). */}
          {registry ? <div className={styles.encounters}>{encounterRail('row')}</div> : null}
        </div>

        <aside className={styles.rail} data-panel={panel.kind}>
          {railSlot()}
        </aside>
      </div>

      {/*
        The broadcast log (005 US1/US2). It sits after the grid, so on desktop it
        is a full-width block under the rail and on a phone it is simply last -
        and opening it appends below rather than moving the stage (FR-400/405).
      */}
      <div className={styles.log}>{broadcastLog(false)}</div>

      {/*
        The one overlay allowed to cover the stage (constitution III, 1.2.0). It
        reads the same `dossier` the glance card does, so a seek behind it flows
        straight through and the dialog never remounts or moves (FR-212).
      */}
      {dossier ? (
        <FullRecordDialog
          dossier={dossier}
          meta={meta}
          open={record === dossier.id}
          onClose={() => setRecord(null)}
          returnFocusTo={recordTrigger.current}
        />
      ) : null}
    </div>
  );
}

export default EpisodePage;
