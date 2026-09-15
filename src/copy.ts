/**
 * Every user-facing string, in the System's voice.
 *
 * Constitution Principle III: generic web-app copy ("Dashboard", "Home", "Ads") is a defect.
 * Keeping the strings in one file makes the spot-check of SC-011 a single read.
 *
 * Later waves APPEND new keys at the end of this object to keep merges trivial.
 */
export const copy = {
  // Identity
  siteTitle: 'Dungeon Crawl Cast',
  systemFeedPill: 'System feed',
  systemLabel: 'The System',
  systemTag: 'SYSTEM',

  // Archive / hub
  archiveKicker: 'RECAP EPISODES',
  archiveTitle: 'Broadcast archive',
  archiveLead:
    'Every recap episode the System has cleared for galactic broadcast, filed by floor.',
  episodeShort: (id: number) => `Ep ${id}`,
  floorLabel: (floor: number) => `Floor ${floor}`,

  // Header
  episodes: 'Episodes',
  youtube: 'YouTube',
  discord: 'Discord',
  menu: 'Menu',
  prevEpisode: 'Previous recap episode',
  nextEpisode: 'Next recap episode',
  episodeLabel: (season: number, floor: number, episode: number) =>
    `S${season} · Floor ${floor} · Episode ${episode}`,
  skipToContent: 'Skip to the broadcast',

  // Feed
  feedHeader: (time: string) => `Event feed · synced ${time}`,
  feedFooter: 'scrubbing rewinds the feed',
  sponsored: 'Sponsored',
  sponsoredTag: 'SPONSORED',
  newAchievementTag: 'NEW ACHIEVEMENT',
  labels: {
    system_message: 'The System',
    achievement: 'Achievement',
    loot: 'Loot',
    hp: 'Vitals',
    level_up: 'Level up',
    rank: 'Rank',
    map_reveal: 'Map',
    sponsor: 'Sponsored',
    chapter: 'Chapter',
    status: 'Status',
    inventory: 'Inventory',
    note: 'Note',
  } as const,

  // Stage
  nextEpisodeCard: 'Next recap episode →',
  returnToArchive: 'Return to the broadcast archive',
  stageFloor: (floor: number) => `Floor ${floor}`,
  sectorsRevealed: (revealed: number, total: number) =>
    `${revealed} of ${total} sectors revealed`,

  // Loading and failure states — still the System talking
  feedLoading: 'The System is compiling this recap.',
  feedUnavailable: 'Feed unavailable. The System is recalibrating.',
  archiveUnavailable: 'The broadcast archive is unreachable. The System is recalibrating.',
  retry: 'Request the archive again',
  notFoundTitle: 'No such recap episode exists in the archive.',
  notFoundBody:
    'The System has no record of that broadcast. It may never have been cleared for transmission.',

  /** Feed sentence templates. The System narrates; it does not label. */
  feedText: {
    achievement: (actor: string, title: string, desc?: string) =>
      desc ? `${actor} earns ${title} — ${desc}` : `${actor} earns ${title}`,
    loot: (actor: string, item: string, source?: string) =>
      source ? `${actor} opens a ${source} → ${item}` : `${actor} claims ${item}`,
    hp: (actor: string, current: number, max: number) =>
      `${actor} holding at ${current}/${max} HP`,
    levelUp: (actor: string, level: number) => `${actor} reaches Lv ${level}`,
    rankParty: (rank: number) => `Party climbs to #${rank} overall`,
    rankCrawler: (actor: string, rank: number) => `${actor} climbs to #${rank} overall`,
    mapReveal: (count: number, label?: string) =>
      label
        ? `New neighborhood revealed: ${label}`
        : `${count} new sector${count === 1 ? '' : 's'} revealed`,
    status: (actor: string, add: string[], remove: string[]) => {
      const parts: string[] = [];
      if (add.length > 0) parts.push(`takes on ${add.join(', ')}`);
      if (remove.length > 0) parts.push(`sheds ${remove.join(', ')}`);
      return `${actor} ${parts.length > 0 ? parts.join(' and ') : 'is unchanged'}`;
    },
    inventory: (actor: string, add: string[], remove: string[]) => {
      const parts: string[] = [];
      if (add.length > 0) parts.push(`stows ${add.join(', ')}`);
      if (remove.length > 0) parts.push(`loses ${remove.join(', ')}`);
      return `${actor} ${parts.length > 0 ? parts.join(' and ') : 'carries on'}`;
    },
    chapter: (label: string) => label,
    markerLevelUp: (actor: string, level: number) => `${actor} reaches Lv ${level}`,
    stageCaption: (episodeId: number, floor: number, time: string) =>
      `Ep ${episodeId} · Floor ${floor} · ${time}`,
  },

  /* --- appended by T025–T029 (archive navigation) --- */

  /** Document title suffix: the show is always the broadcaster. */
  pageTitle: (name: string) => `${name} · Dungeon Crawl Cast`,
  archiveLoading: 'The System is retrieving the broadcast archive.',

  /* --- appended by T019–T024 (party rail, event feed, stage) --- */

  partyRailLabel: 'Crawler status',
  feedLabel: 'System event feed',
  levelShort: (level: number) => `Lv ${level}`,
  hpValue: (current: number, max: number) => `${current}/${max}`,
  hpAria: (current: number, max: number) => `${current} of ${max} HP`,
  stageLabel: (title: string) => `Broadcast: ${title}`,

  /** Dev-only scrubber (research R14); never reaches a viewer. */
  fakeStageLabel: 'Simulated broadcast — dev scrubber',
  fakeStagePlay: 'Play',
  fakeStagePause: 'Pause',
  fakeStageScrub: 'Scrub the broadcast',

  /* --- appended by T030–T035 (timeline, toast, minimap) --- */

  /** The marker bar under the stage; each marker names itself (FR-040/041). */
  timelineLabel: 'Episode timeline',

  /* --- polish pass (post-review) --- */

  /** Markers keep their kind and time but hide their label until the playhead reaches them (time-truth). */
  markerKinds: {
    boss: 'Boss encounter',
    loot: 'Loot drop',
    achievement: 'Achievement',
    levelup: 'Level up',
    story: 'Story beat',
  },
  markerUpcoming: (kind: string, time: string) => `${kind} at ${time}`,
  unfiledFloor: 'Unfiled transmissions',
  broadcastUnavailable: 'The broadcast relay is unreachable. The System is recalibrating.',
} as const;

export type Copy = typeof copy;
