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
    /* --- appended by 007 (FR-612): every entity row is filed as an Entity. --- */
    npc: 'Entity',
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
    /* --- appended by 007 (research R2): the System narrates an encounter --- */
    npcMet: (name: string, note?: string) =>
      note ? `${name} enters the broadcast — ${note}` : `${name} enters the broadcast`,
    npcSeen: (name: string, note?: string) =>
      note ? `${name} is sighted — ${note}` : `${name} is sighted`,
    /** An update carries its note as the amendment itself, so it is never appended. */
    npcUpdate: (name: string, note?: string) =>
      note ? `${name}: ${note}` : `The System amends its file on ${name}`,
    npcDefeated: (name: string, note?: string) =>
      note ? `${name} is no more — ${note}` : `${name} is no more`,
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

  /* --- 003 crawler record --- */

  /** The rail card (FR-200): a glance, not the whole sheet. */
  glanceKicker: 'CRAWLER GLANCE',
  openRecord: 'Open full record',

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

  /* --- 003 revision 2, wave 3 (glance card polish: T338, T343, T344) --- */

  /**
   * The player behind the crawler, spelled out (review 0.8): "Harry · played by
   * Marcus" reads as a credit instead of two names that look like a duplicate.
   */
  playedBy: (player: string) => `played by ${player}`,
  /**
   * The screen-reader half of a "·" separator (review 0.7): the dot itself is
   * aria-hidden, and this sits beside it so the accessible name is "Harry,
   * played by Marcus" and not "Harryplayed by Marcus".
   */
  srSeparator: ', ',

  /** Mono caps label before the sheet's ten-segment strip (review 1.3, T344). */
  hpLabel: 'HP',
  /** Mono caps label before the rank numbers (review 1.4, T343). */
  rankLabel: 'RANK',
  /**
   * Movement since the previous rank point (T343). A positive delta means the
   * rank number fell, which is an improvement, so it points up.
   */
  rankDelta: (delta: number) =>
    `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('en-US')}`,
  /** Worn slots past the glance card's seven-row cap. */
  equippedMore: (n: number) => `+${n}`,

  /* --- 003 revision 2, wave 3 (record: T324) --- */

  /**
   * The gear section's last row holds a list, so the sheet spells it plural;
   * `gearSlotLabels.accessory` stays singular for one worn item (R2 US2.3).
   */
  gearAccessoriesLabel: 'Accessories',

  /* --- 003 revision 2, wave 3 (empty states, caption row, feed seek: T335/T340/T342) --- */

  /** The feed before the first event has elapsed (review 0.3, T335). */
  feedStandby: 'Standing by. The System reports when the broadcast begins.',
  /** The floor map before the first reveal (review 0.4, T335). */
  mapEmpty: 'No sectors charted yet.',

  /**
   * The caption row between the stage and the timeline (review 0.11/0.13, T340).
   * The episode title is finally visible, so this line is the page's `<h1>`.
   */
  captionLeft: (episodeId: number, floor: number, title: string) =>
    `Ep ${episodeId} · Floor ${floor} — ${title}`,

  /** A feed row is a seek control; its accessible name leads with the moment (T342). */
  feedSeek: (time: string, text: string) => `${time} ${text}`,

  /* --- 003 revision 2, wave 3 (record polish: T330) --- */

  /**
   * A hotbar slot names itself (T330). The visible name is clamped to two
   * lines inside a ~80 px key, so the slot carries the whole thing for
   * assistive tech — and an empty key says it is empty instead of reading as a
   * stray digit.
   */
  hotbarSlotAria: (n: number, name: string) => `Slot ${n}, ${name}`,
  hotbarSlotEmptyAria: (n: number) => `Slot ${n}, empty`,

  /* --- appended by 004 (deep links + share: T404) --- */

  /** The caption row's control: the viewer marks a moment, the System files it. */
  shareMoment: 'Share this moment',
  /** The same control on a feed row, which already names its own time. */
  shareRow: (time: string) => `Share the moment at ${time}`,
  /** The three outcomes of a share, in the System's voice (research R5). */
  shareCopied: 'Moment marked. The link is on your clipboard.',
  shareShared: 'Moment marked.',
  shareShown: 'Moment marked. Copy the link below.',
  /** The native share sheet's title: the episode, then the moment. */
  shareTitle: (episodeTitle: string, time: string) => `${episodeTitle} — ${time}`,
  /** Names the read-only field the fallback notice offers (FR-304). */
  shareUrlLabel: 'Link to this moment',
  /** Dismisses the notice by hand. */
  shareDismiss: 'Dismiss',

  /* --- appended by 005 (broadcast log: T503) --- */

  /** The collapsible section under the party rail (FR-400). */
  logTitle: 'Broadcast log',
  /** The bar’s elapsed count, in the System’s voice (FR-403). */
  logCount: (n: number) => `${n} moment${n === 1 ? '' : 's'} on the log`,
  /** The same count once a filter is on: how much of the log is showing. */
  logCountFiltered: (n: number, m: number) =>
    `${n} of ${m} moment${m === 1 ? '' : 's'}`,
  /** The toggle, named for what it will do next. */
  logOpen: 'Open the log',
  logClose: 'Close the log',
  /** The two chip groups (FR-402). */
  logFiltersTypes: 'Types',
  logFiltersCrawlers: 'Crawlers',
  /** Resets every chip. */
  logClear: 'Clear',
  /** Re-arms the list’s auto-scroll after the viewer has read back (FR-404). */
  logFollow: 'Follow the broadcast',
  /** The log is not empty — the filter is (US2 scenario 4). */
  logNoMatch: 'Nothing on the log matches.',

  /* --- appended by 006 (mobile pass: phone tabs, T604) --- */

  /** Names the phone tab strip that carries the four panes (FR-502). */
  tabsLabel: 'Broadcast panels',
  /** The four panes, in strip order. */
  tabFeed: 'Feed',
  tabParty: 'Party',
  tabMap: 'Map',
  tabLog: 'Log',

  /* --- appended by 006 (mobile pass: mini-player, T602) --- */

  /** The phone mini-player's return control (FR-501). */
  miniReturn: 'Return to the stage',

  /* --- appended by 006 (mobile pass: bottom sheet, T606) --- */

  /** How the phone sheet's grab handle is dismissed, announced in its header (FR-504). */
  sheetHandle: 'Drag down to close',

  /* --- appended by 007 (NPC encounters + System Registry: T707) --- */

  /** The three kinds the author fixed; the labels are the System's, not the code's. */
  kindLabels: {
    boss: 'Boss',
    vendor: 'Vendor / Guide',
    ally: 'Ally / Faction',
  } as const,

  /** The Encountered strip under the party rail (FR-610). */
  encounterTitle: 'ENCOUNTERED',
  encounterEmpty: 'No entities tagged yet.',

  /** The entity record in the rail panel / phone sheet (FR-611). */
  npcKicker: 'ENTITY RECORD',
  npcFacts: 'FACTS',
  npcFactsEmpty: 'The System has released nothing further.',
  npcMoments: 'MOMENTS',
  npcDefeated: 'DEFEATED',
  npcActive: 'ACTIVE',
  npcOpenRegistry: 'Open in the Registry',

  /** The fifth phone tab, which exists only when the show has a registry. */
  tabNpcs: 'NPCs',

  /** The glossary at /registry (FR-620): everything published, by episode. */
  registry: 'Registry',
  registryTitle: 'System Registry',
  registryKicker: 'ENTITY RECORDS',
  registryLead:
    'Every entity the System has filed across the broadcast archive, in the order the galaxy met them.',
  registrySearch: 'Search the Registry',
  registryNoMatch: 'The Registry has no such entity.',
  registryMissing: (n: number) =>
    `${n} recap episode${n === 1 ? '' : 's'} could not be indexed.`,
  registryEpisodeSection: (n: number, title: string) => `Episode ${n} — ${title}`,
  /** Tags a fact with the episode that released it. */
  registryFactTag: (n: number) => `Ep ${n}`,

  /* --- appended by 007 (System Registry page: T713) --- */

  /** While the page is pulling the show, the registry and every episode file. */
  registryLoading: 'The System is indexing the archive.',
  /** The show declares no registry, or the file could not be read (spec edge case). */
  registryUnavailable: 'The Registry has not been transmitted.',
  /** Names the kind chip group for a screen reader. */
  registryKinds: 'Filter by kind',
  /** How many entities a section holds. */
  registryCount: (n: number) => `${n} ${n === 1 ? 'entity' : 'entities'}`,
  /** The expanded entry's second block; the first reuses `npcFacts` ("FACTS"). */
  registryAppearances: 'APPEARANCES',
  /** What an appearance was, in one word, beside its timecode. */
  registryActions: {
    met: 'Met',
    seen: 'Sighted',
    update: 'Amended',
    defeated: 'Defeated',
  } as const,
  /** Closes an entry that does not survive the archive. */
  registryDefeatedIn: (n: number) => `Defeated in episode ${n}.`,
} as const;

export type Copy = typeof copy;
