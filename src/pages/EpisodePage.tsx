import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useShow } from '../data/ShowContext';
import { fetchEpisode } from '../data/load';
import { findEpisode, prevNext } from '../data/show';
import type { EpisodeData, EpisodeMeta } from '../data/types';
import { reduceTo } from '../engine/reducer';
import {
  activeSponsor,
  activeToast,
  crawlerDossier,
  feedItems,
  mapCells,
  mapLabels,
  partyFrames,
  rankSeries,
  recentlyRevealed,
  timelineMarkers,
} from '../engine/selectors';
import type { TimeSource } from '../playback/TimeSource';
import { usePlayhead } from '../playback/usePlayhead';
import { useResume } from '../playback/useResume';
import { usePanel } from '../hooks/usePanel';
import { VideoStage } from '../components/VideoStage/VideoStage';
import { AchievementToast } from '../components/AchievementToast/AchievementToast';
import { MiniMapBadge } from '../components/MiniMapBadge/MiniMapBadge';
import { NextEpisodeCard } from '../components/NextEpisodeCard/NextEpisodeCard';
import { EventTimeline } from '../components/EventTimeline/EventTimeline';
import { PartyRail } from '../components/PartyRail/PartyRail';
import { EventFeed } from '../components/EventFeed/EventFeed';
import { RailPanel } from '../components/RailPanel/RailPanel';
import { CrawlerDossier } from '../components/CrawlerDossier/CrawlerDossier';
import { FloorMap } from '../components/FloorMap/FloorMap';
import { ResumeCard } from '../components/ResumeCard/ResumeCard';
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
  const { t, ended } = playhead;
  // Viewer state, not overlay state: which record is open. Resets per episode.
  const panelApi = usePanel(meta?.id);
  const { panel } = panelApi;
  // DEV only: `?panel=dossier:<id>` or `?panel=map` opens a panel on load (screenshots, manual QA).
  const [searchParams] = useSearchParams();
  const devPanel = import.meta.env.DEV ? searchParams.get('panel') : null;
  const partyLoaded = episode !== null;
  useEffect(() => {
    if (!devPanel || !partyLoaded) return;
    if (devPanel === 'map') panelApi.open({ kind: 'map' }, null);
    else if (devPanel.startsWith('dossier:')) panelApi.open({ kind: 'dossier', crawlerId: devPanel.slice(8) }, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per episode load
  }, [devPanel, partyLoaded, meta?.id]);
  // Persisted playhead only, never overlay state (constitution I, FR-133).
  const resume = useResume(meta, source, playhead);

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
  const sponsor = episode ? activeSponsor(episode.events, t, party) : null;
  // A pinned sponsor is not repeated in the list; it rejoins the feed when its window closes.
  const listed = sponsor ? items.filter((item) => item.id !== sponsor.id) : items;
  const toast = episode ? activeToast(episode.events, t, party) : null;
  const markers = episode ? timelineMarkers(episode.events, meta.durationSec, party) : [];
  const cells = state ? mapCells(state) : null;
  const recent = episode ? recentlyRevealed(episode.events, t) : EMPTY_CELLS;
  const partyRank = episode ? rankSeries(episode.events, t, 'party').current : null;
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
      partyRank={partyRank}
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
  function railSlot(episodeMeta: EpisodeMeta) {
    switch (panel.kind) {
      case 'dossier':
        // No dossier means no episode data behind it: the feed carries the
        // System's unavailable notice (spec Edge Cases).
        if (!dossier) return feed;
        return (
          <RailPanel
            kicker={copy.dossierKicker}
            title={copy.dossierTitle(dossier.name)}
            onClose={panelApi.close}
          >
            <CrawlerDossier dossier={dossier} meta={episodeMeta} />
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
      <h1 className="sr-only">{meta.title}</h1>
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
          {railSlot(meta)}
        </aside>
      </div>
    </div>
  );
}

export default EpisodePage;
