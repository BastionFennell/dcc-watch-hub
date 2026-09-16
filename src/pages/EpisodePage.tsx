import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShow } from '../data/ShowContext';
import { fetchEpisode } from '../data/load';
import { findEpisode, prevNext } from '../data/show';
import type { EpisodeData } from '../data/types';
import { reduceTo } from '../engine/reducer';
import {
  activeSponsor,
  activeToast,
  crawlerDossier,
  crawlerGlance,
  feedItems,
  logItems,
  mapCells,
  mapLabels,
  partyFrames,
  recentlyRevealed,
  timelineMarkers,
} from '../engine/selectors';
import type { TimeSource } from '../playback/TimeSource';
import { formatTime } from '../engine/time';
import { usePlayhead } from '../playback/usePlayhead';
import { useDeepLink } from '../playback/useDeepLink';
import { useResume } from '../playback/useResume';
import { usePanel } from '../hooks/usePanel';
import { loadLogOpen, saveLogOpen } from '../prefs/logOpen';
import { useShare } from '../share/useShare';
import { VideoStage } from '../components/VideoStage/VideoStage';
import { AchievementToast } from '../components/AchievementToast/AchievementToast';
import { MiniMapBadge } from '../components/MiniMapBadge/MiniMapBadge';
import { NextEpisodeCard } from '../components/NextEpisodeCard/NextEpisodeCard';
import { EventTimeline } from '../components/EventTimeline/EventTimeline';
import { PartyRail } from '../components/PartyRail/PartyRail';
import { EventFeed } from '../components/EventFeed/EventFeed';
import { EpisodeLog } from '../components/EpisodeLog/EpisodeLog';
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
 * on every render — no memoization, no incremental patching, so a seek in either
 * direction is automatically correct (constitution I, FR-001/002/003).
 */
export function EpisodePage() {
  const { id } = useParams();
  const { show } = useShow();

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
   * stage, or `null`. Never persisted and never derived from events — the
   * record's *content* is derived; this is only what the viewer asked to see.
   */
  const [record, setRecord] = useState<string | null>(null);
  /** The "Open full record" button, so the dialog can hand focus back (FR-210). */
  const recordTrigger = useRef<HTMLElement | null>(null);
  // DEV only: `?panel=dossier:<id>` or `?panel=map` opens a panel on load (screenshots, manual QA).
  const [searchParams] = useSearchParams();
  const devPanel = import.meta.env.DEV ? searchParams.get('panel') : null;
  const devRecord = import.meta.env.DEV && searchParams.get('record') === '1';
  const devRecordOpened = useRef(false);
  const partyLoaded = episode !== null;
  useEffect(() => {
    if (!devPanel || !partyLoaded) return;
    if (devPanel === 'map') panelApi.open({ kind: 'map' }, null);
    else if (devPanel.startsWith('dossier:')) panelApi.open({ kind: 'dossier', crawlerId: devPanel.slice(8) }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per episode load
  }, [devPanel, partyLoaded, meta?.id]);

  // The record cannot outlive the glance card that opened it: closing the panel,
  // or switching to another crawler or to the map, closes it too (FR-213).
  useEffect(() => {
    if (record !== null && (panel.kind !== 'dossier' || panel.crawlerId !== record)) setRecord(null);
  }, [panel, record]);

  // A new episode always opens ambient — no panel (usePanel) and no record (US2 scenario 7).
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

  useEffect(() => {
    if (meta) document.title = copy.pageTitle(meta.title);
  }, [meta]);

  // The stage destroys its own source on unmount; this covers a source swap.
  useEffect(() => () => source?.destroy(), [source]);

  if (!validId) return <NotFoundPage />;
  if (!show) return null;
  if (!meta) return <NotFoundPage />;

  const party = episode ? episode.initialState.party : EMPTY_PARTY;
  const state = episode ? reduceTo(episode, t) : null;
  const frames = state && episode ? partyFrames(state, episode.events, t) : [];
  const items = episode ? feedItems(episode.events, t, 8, party) : [];
  // The whole elapsed transcript, oldest first — the feed's eight rows are a
  // window onto this (005 FR-401).
  const log = episode ? logItems(episode.events, t, party) : [];
  const sponsor = episode ? activeSponsor(episode.events, t, party) : null;
  // A pinned sponsor is not repeated in the list; it rejoins the feed when its window closes.
  const listed = sponsor ? items.filter((item) => item.id !== sponsor.id) : items;
  const toast = episode ? activeToast(episode.events, t, party) : null;
  const markers = episode ? timelineMarkers(episode.events, meta.durationSec, party) : [];
  const cells = state ? mapCells(state) : null;
  const recent = episode ? recentlyRevealed(episode.events, t) : EMPTY_CELLS;
  const { next } = prevNext(show, meta.id);

  // The dossier, like everything else, is derived at render time — a seek in
  // either direction is correct with no extra work (constitution I, FR-103).
  const dossier =
    panel.kind === 'dossier' && state && episode
      ? crawlerDossier(state, episode.events, t, panel.crawlerId, party)
      : null;

  const feed = (
    <EventFeed
      items={listed}
      sponsor={sponsor}
      t={t}
      onSeek={(sec) => source?.seek(sec)}
      onShare={(sec) => void share.share(sec)}
      notice={
        failed ? (
          <SystemNotice tone="error">{copy.feedUnavailable}</SystemNotice>
        ) : !episode ? (
          <p className={styles.loading}>{copy.feedLoading}</p>
        ) : null
      }
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
            <CrawlerGlance
              glance={crawlerGlance(dossier)}
              onOpenRecord={(trigger) => {
                recordTrigger.current = trigger;
                setRecord(dossier.id);
              }}
            />
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
            <FloorMap
              cells={cells}
              recent={recent}
              labels={mapLabels(episode.events, t)}
              floor={cells.floor}
            />
          </RailPanel>
        );
      default:
        return feed;
    }
  }

  return (
    <div className={styles.page} data-ended={ended ? 'true' : undefined}>
      <div className={styles.grid}>
        <div className={styles.main}>
          <VideoStage key={meta.id} meta={meta} t={t} onSource={setSource}>
            <AchievementToast toast={toast} />
            {cells ? (
              <MiniMapBadge
                cells={cells}
                recent={recent}
                expanded={panel.kind === 'map'}
                onActivate={(element) => panelApi.toggle({ kind: 'map' }, element)}
              />
            ) : null}
            {resume.pending ? (
              <ResumeCard
                t={resume.pending.t}
                onRejoin={resume.rejoin}
                onStartOver={resume.startOver}
              />
            ) : null}
            {ended ? (
              <div className={styles.endedOverlay}>
                <NextEpisodeCard next={next} />
              </div>
            ) : null}
          </VideoStage>

          {/*
            The caption row (review 0.11/0.13, T340). It used to sit inside the
            stage, where the host's own control bar covered it and the episode
            title never appeared at all. Out here it is legible at every width,
            and its left half is the page's one `<h1>`.
          */}
          <div className={styles.captionBlock}>
            <div className={styles.captionRow} data-testid="stage-caption-row">
              <h1 className={styles.captionTitle}>
                {copy.captionLeft(meta.id, meta.floor, meta.title)}
              </h1>
              <div className={styles.captionRight}>
                <span
                  className={styles.captionTime}
                  data-testid="stage-caption-time"
                >
                  {formatTime(t)}
                </span>
                {/* "Share this moment", beside the time it is about (004 FR-302). */}
                <ShareButton
                  testId="share-moment"
                  onClick={() => void share.share(t)}
                />
              </div>
            </div>
            {/*
              The confirmation sits directly under the row that raised it. Its
              live region is always mounted and weightless until it has
              something to say, so the stage above never moves (T407).
            */}
            <ShareNotice status={share.status} url={share.url} onDismiss={share.dismiss} />
          </div>

          <EventTimeline
            markers={markers}
            t={t}
            durationSec={meta.durationSec}
            onSeek={(sec) => source?.seek(sec)}
          />

          <PartyRail
            frames={frames}
            activeId={panel.kind === 'dossier' ? panel.crawlerId : null}
            onActivate={(id, element) =>
              panelApi.toggle({ kind: 'dossier', crawlerId: id }, element)
            }
          />
        </div>

        <aside className={styles.rail} data-panel={panel.kind}>
          {railSlot()}
        </aside>
      </div>

      {/*
        The broadcast log (005 US1/US2). It sits after the grid, so on desktop it
        is a full-width block under the rail and on a phone it is simply last —
        and opening it appends below rather than moving the stage (FR-400/405).
      */}
      <div className={styles.log}>
        <EpisodeLog
          items={log}
          party={party}
          t={t}
          playing={playing}
          onSeek={(sec) => source?.seek(sec)}
          onShare={(sec) => void share.share(sec)}
          initialOpen={logOpen}
          onOpenChange={saveLogOpen}
        />
      </div>

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
