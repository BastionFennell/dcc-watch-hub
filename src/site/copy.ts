/**
 * Marketing copy (011). Plain voice: the System speaks only inside a SystemBox,
 * and these strings are what a stranger reads on the way in.
 *
 * `src/copy.ts` stays the hub's voice; this file is the front door's, so a
 * change to one never disturbs the other. Wave B appends to the end of this
 * object, exactly as the hub's copy file is extended.
 */
export const siteCopy = {
  // The gated call to action (011 §2.1). Before `hubLiveAt` the only place to
  // watch is YouTube; after it, the System feed opens.
  watchOnYouTube: 'Watch on YouTube',
  openSystemFeed: 'Open the System feed',

  // The head every prerendered route starts from, before its own <Seo> (if it
  // has one) overwrites it. The show's own `title` / `pitch` win when present.
  defaultTitle: 'Dungeon Crawl Cast',
  defaultDescription: 'A Dungeon Crawler Carl actual play.',

  /* ------------------------------------------------ Wave B (011 §3, §4, §6) */

  /** The brand, spelled once. */
  siteName: 'Dungeon Crawl Cast',

  /*
   * Header and footer navigation. Plain words on purpose: a stranger arriving
   * from a short has not met the System yet, so "Watch" is not the defect here
   * that "Dashboard" would be inside the hub (constitution VIII vs III).
   */
  siteNavLabel: 'Site',
  navWatch: 'Watch',
  navCrawlers: 'Crawlers',
  navCommunity: 'Community',

  // --- home hero
  heroEyebrow: 'A Dungeon Crawler Carl actual play',
  browseEveryEpisode: 'Browse every episode',
  /** Shown on an episode whose feed has not opened yet (011 §3.2). */
  countdownChip: (left: string) => `System feed unlocks in ${left}`,

  // --- home sections
  latestEpisodeTitle: 'Latest episode',
  meetTheCrawlersTitle: 'Meet the crawlers',
  meetTheCrawlersLead: 'Five people from the same film crew, and one very bad Tuesday.',
  newcomerTitle: 'New to Dungeon Crawler Carl?',
  newcomerBody:
    'It is a book series about an apocalyptic game show with a cat who takes it personally. You do not need to have read a word of it to watch this.',
  newcomerLink: 'Start with the primer on YouTube',
  discordTitle: 'Join the Discord',
  discordBody: 'Floor theories, crawler talk, and the schedule before anyone else gets it.',
  discordCta: 'Open the Discord',

  // --- footer
  footerDisclaimer: 'Not affiliated with Matt Dinniman or Renegade Game Studios.',
  footerRights: '© Dungeon Crawl Cast',

  // --- /watch
  watchTitle: 'Every episode',
  watchLead: 'The whole descent, filed by floor, newest first.',
  /** A floor the party has not reached yet (011 §3.2). */
  emptyFloor: (floor: number) => `Floor ${floor} - the descent continues.`,
  floorLabel: (floor: number) => `Floor ${floor}`,
  episodeLabel: (id: number) => `Episode ${id}`,

  // --- /crawlers
  crawlersTitle: 'The crawlers',
  crawlersLead: 'Five contestants, one production company, no exit.',
  filterAll: 'All',
  filterLabel: 'Filter by status',
  /** The authored `status` field, as a pill (011 §2.2). */
  statusLabel: {
    alive: 'Alive',
    dead: 'Dead',
    fused: 'Fused',
    unknown: 'Unknown',
  } as const,
  /** The live line under a crawler: "Level 2 · 4/6 HB · Floor 1" (011 §5). */
  statusLine: (level: number, current: number, max: number, floor: number) =>
    `Level ${level} · ${current}/${max} HB · Floor ${floor}`,
  levelPill: (level: number) => `Lv ${level}`,

  // --- /crawlers/:id
  conceptTitle: 'The concept',
  pocketsTitle: 'What was in their pockets when the world ended',
  entryAchievementTitle: 'Entry achievement',
  /** The achievement box's footer line. */
  reward: (box: string, item: string) => `Reward: ${box} → ${item}`,
  playerTitle: 'The player',
  appearsInTitle: 'Appears in',
  prevCrawler: 'Previous crawler',
  nextCrawler: 'Next crawler',

  // --- /community
  communityTitle: 'Find the show',
  communityLead: 'One link for every bio, and the room where the crawl gets argued about.',
  supportTitle: 'How to support the show',
  supportBody:
    'Subscribe on YouTube so the algorithm stops pretending we are not here, send one episode to one person who would like it, and come argue about the floor in the Discord. That is the whole ask.',

  // --- platforms (the social row shows only the ones show.json carries)
  platform: {
    youtube: 'YouTube',
    discord: 'Discord',
    tiktok: 'TikTok',
    bluesky: 'Bluesky',
    instagram: 'Instagram',
  } as const,

  // --- media
  playTrailer: 'Play the trailer',
  playLabel: (title: string) => `Play ${title}`,

  // --- share images and per-page heads
  ogSiteImage: '/og/site.png',
  ogCrawlerImage: (id: string) => `/og/crawler-${id}.png`,
  ogEpisodeImage: (id: number) => `/og/ep${id}.png`,
  pageTitle: (page: string) => `${page} · Dungeon Crawl Cast`,
  watchDescription: 'Every episode of Dungeon Crawl Cast, filed by floor.',
  crawlersDescription: 'The five crawlers of Dungeon Crawl Cast, and the players behind them.',
  crawlerDescription: (name: string, concept: string) => `${name}. ${concept}`,
  communityDescription:
    'Discord, YouTube and everywhere else Dungeon Crawl Cast turns up, plus how often new crawls land.',
} as const;
