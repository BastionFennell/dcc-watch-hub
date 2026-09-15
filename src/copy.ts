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
    skill: 'Skill',
    class: 'Class',
    hotlist: 'Hotlist',
    equip: 'Equip',
    unequip: 'Unequip',
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
    /* --- v2 event types (FR-112) --- */
    skill: (actor: string, name: string, rank?: number) =>
      rank === undefined
        ? `${actor} logs the skill ${name}`
        : `${actor} logs ${name} at rank ${rank}`,
    classChange: (actor: string, cls: string) => `${actor} is classed: ${cls}`,
    hotlist: (actor: string, add: string[], remove: string[]) => {
      const parts: string[] = [];
      if (add.length > 0) parts.push(`adds ${add.join(', ')} to the Hotlist`);
      if (remove.length > 0) parts.push(`clears ${remove.join(', ')} from the Hotlist`);
      return `${actor} ${parts.length > 0 ? parts.join(' and ') : 'leaves the Hotlist alone'}`;
    },
    /* --- 003 revision 2 event types (R2-FR-220) --- */
    equip: (actor: string, slot: string, item: string) => `${actor} equips ${item} (${slot})`,
    unequip: (actor: string, slot: string, item?: string) =>
      item === undefined
        ? `${actor} clears the ${slot} slot`
        : `${actor} stows ${item} (${slot})`,
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
  timelineScrubHint: 'Jump to any point in the broadcast',

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

  /* --- v2 --- */

  /** Panels (FR-100..FR-104). One rail slot, one close control. */
  panelClose: 'Close',

  /**
   * Crawler sheet copy (FR-110/111). Since 003 the rail's kicker is
   * `glanceKicker` and the dialog's is `recordKicker`; the title is shared.
   */
  dossierTitle: (name: string) => `${name} — System record`,
  dossierSections: {
    vitals: 'VITALS',
    debuffs: 'DEBUFFS',
    stats: 'STATS',
    hotlist: 'HOTLIST',
    skills: 'SKILLS',
    inventory: 'INVENTORY',
    achievements: 'ACHIEVEMENTS',
    history: 'HISTORY',
    equipped: 'EQUIPPED',
    gear: 'GEAR',
    latestAchievement: 'LATEST ACHIEVEMENT',
    recent: 'RECENT MOMENTS',
  } as const,
  sheetLabels: {
    race: 'Race',
    pronouns: 'Pronouns',
    crawlerNumber: 'Crawler #',
    level: 'Level',
    class: 'Class',
    floor: 'Floor',
    player: 'Player',
    handle: 'Handle',
  } as const,
  statLabels: {
    str: 'STR',
    int: 'INT',
    con: 'CON',
    dex: 'DEX',
    cha: 'CHA',
  } as const,
  /** Empty states: the System never leaves a section blank, it files it as empty. */
  dossierEmpty: {
    debuffs: 'No debuffs on record.',
    stats: 'Stats unfiled.',
    hotlist: 'Hotlist empty.',
    skills: 'No skills logged.',
    inventory: 'Nothing carried.',
    achievements: 'No achievements yet.',
    history: 'No moments logged.',
    equipped: 'Nothing equipped.',
    gearSlot: '—',
  } as const,
  unranked: 'Unranked',
  unclassed: 'Unclassed',
  rankCurrent: 'Current',
  rankBest: 'Best',
  rankValue: (rank: number) => `#${rank}`,
  /** Sparkline text alternative (FR-140, SC-104). */
  sparklineSummary: (from: number, to: number, count: number, best: number) =>
    `Rank moved from #${from} to #${to} across ${count} update${count === 1 ? '' : 's'}; best #${best}`,
  skillRank: (rank: number) => `Rank ${rank}`,

  /** Expanded floor map (FR-120..FR-122). */
  mapKicker: 'SYSTEM CARTOGRAPHY',
  mapTitle: (floor: number) => `Floor ${floor}`,
  mapZoomIn: 'Zoom in',
  mapZoomOut: 'Zoom out',
  mapFit: 'Fit',
  /*
   * The badge's accessible name opens with its visible text ("Floor 1"), which
   * WCAG 2.5.3 Label in Name requires and axe flags otherwise (T131).
   */
  mapTriggerLabel: (floor: number) => `Floor ${floor} — open the floor map`,
  /** Names the focusable map viewport and states its keys (T131). */
  mapViewportLabel: 'Floor map — drag or arrow keys to pan, + and − or scroll to zoom, 0 to fit',
  mapPointerHint: 'Drag to pan · scroll or double-click to zoom · Fit resets',
  mapZoomReadout: (zoom: number) => `${Math.round(zoom * 100)}%`,
  mapSummary: (revealed: number, total: number, labels: number) =>
    `${revealed} of ${total} sectors revealed, ${labels} neighborhood${labels === 1 ? '' : 's'} named`,

  /** Resume (FR-130..FR-133). The System keeps your place; it does not nag. */
  resumeKicker: 'BROADCAST BOOKMARK',
  resumeTitle: (time: string) => `Rejoin at ${time}?`,
  resumeBody: 'The System has your place marked.',
  resumeRejoin: 'Rejoin the broadcast',
  resumeStartOver: 'Start from the beginning',

  /** Party rank line in the feed header (FR-141). */
  partyRankLine: (rank: number) => `Party rank #${rank}`,

  /* --- 003 crawler record --- */

  /** The rail card (FR-200): a glance, not the whole sheet. */
  glanceKicker: 'CRAWLER GLANCE',
  openRecord: 'Open full record',
  /** Ledger cells are plain values today; they stay in copy so the voice can change. */
  ledgerCount: (n: number) => `${n}`,
  ledgerNewest: (text: string) => text,
  /** Stands in for a history row the crawler has not earned yet (research R4). */
  historyPlaceholder: '—',

  /** The full record dialog (FR-210). */
  recordKicker: 'CRAWLER RECORD',
  recordTitle: (name: string) => `${name} — full record`,
  /** Debuff chips past the card's two-row cap. */
  debuffsMore: (n: number) => `+${n}`,

  /* --- 003 revision 2 --- */

  /** One row per worn slot on the sheet and on the glance card (R2-FR-220). */
  gearSlotLabels: {
    head: 'Head',
    torso: 'Torso',
    arms: 'Arms',
    hands: 'Hands',
    legs: 'Legs',
    feet: 'Feet',
    accessory: 'Accessory',
  } as const,

  /** The record's MMO hotbar: ten numbered slots, then the overflow marker (R2-FR-221). */
  hotbarSlot: (n: number) => `${n}`,
  hotbarOverflow: (n: number) => `+${n}`,

  /** Tile grids cap at eight; the rest live behind a list view (R2-FR-222/223). */
  viewAll: (n: number) => `View all (${n})`,
  backToRecord: 'Back to record',
  recordListTitle: (name: string, category: string) => `${name} — ${category}`,

  /** The full-figure art column (R2-FR-224). */
  artAlt: (name: string) => `${name}, full figure`,
} as const;

export type Copy = typeof copy;
