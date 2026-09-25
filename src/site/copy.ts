/**
 * Marketing copy (011). Plain voice: the System speaks only inside a SystemBox,
 * and these strings are what a stranger reads on the way in.
 *
 * `src/copy.ts` stays the hub's voice; this file is the front door's, so a
 * change to one never disturbs the other. Wave B appends to the end of this
 * object, exactly as the hub's copy file is extended.
 */
import { metaCopy } from './meta';
import { copy } from '../copy';

export const siteCopy = {
  /*
   * The head's vocabulary, kept in its own module so the hub's entry chunk can
   * import those dozen strings without the rest of this file (see meta.ts).
   */
  ...metaCopy,

  // The header's nav labels, which live in the hub's copy file (see there).
  siteNavLabel: copy.siteNavLabel,
  navWatch: copy.navWatch,
  navCrawlers: copy.navCrawlers,
  navCommunity: copy.navCommunity,

  // The gated call to action (011 §2.1). Before `hubLiveAt` the only place to
  // watch is YouTube; after it, the System feed opens.
  watchOnYouTube: 'Watch on YouTube',
  openSystemFeed: 'Watch in the Augmented Viewer',

  /* ------------------------------------------------ Wave B (011 §3, §4, §6) */

  // --- home hero
  heroEyebrow: 'A Dungeon Crawler Carl actual play',
  browseEveryEpisode: 'Browse every episode',
  /** Shown on an episode whose feed has not opened yet (011 §3.2). */
  countdownChip: (left: string) => `Augmented Viewer unlocks in ${left}`,

  // --- home sections
  latestEpisodeTitle: 'Latest episode',
  meetTheCrawlersTitle: 'Meet the crawlers',
  meetTheCrawlersLead: 'Five people from the same film crew, and one very bad Tuesday.',
  newcomerTitle: 'New to Dungeon Crawler Carl?',
  newcomerBody:
    'It is a book series about an apocalyptic game show with a cat who takes it personally. You do not need to have read a word of it to watch this.',
  newcomerLink: 'Start with the primer on YouTube',
  discordTitle: 'Join the Discord',
  discordBody: 'Talk episodes, swap theories, and meet other crawlers.',
  discordCta: 'Open the Discord',

  // --- footer
  /*
   * The footer repeats the header's three links, so it needs a name of its own:
   * two landmarks with the same role and the same accessible name are one axe
   * violation (`landmark-unique`) and, worse, two identical stops in a screen
   * reader's landmark list.
   */
  footerNavLabel: 'Footer',
  footerDisclaimer: 'Not affiliated with Matt Dinniman or Renegade Game Studios.',
  footerRights: '© Dungeon Crawl Cast',

  // --- /watch
  watchTitle: 'Every episode',
  watchLead: 'The whole descent, filed by floor, from the first step down.',
  /** The archive reads oldest first, so it offers the other end (011 R3). */
  jumpToLatest: 'Jump to latest',
  backToTop: 'Back to top',
  /** Marks the newest row, in the row's own mono meta line. */
  latestChip: 'LATEST',
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
  /*
   * The page's one section label, set in mono caps (011 R2). Short on purpose:
   * a signpost over a block of the crawler's own words, not a headline, and a
   * section whose data is empty prints neither the label nor a placeholder.
   * The entry achievement has none - its own kicker is the heading.
   */
  pocketsTitle: 'Pockets',
  /** The achievement's payout line. Rendered with whichever halves exist. */
  reward: (box: string, item: string) => `Reward: ${box} → ${item}`,
  rewardBox: (box: string) => `Reward: ${box}`,
  rewardItem: (item: string) => `Reward: ${item}`,
  /**
   * The System announcing the achievement, in the hub toast's voice but its own
   * words: the toast says a new one just landed, this one has been on the
   * record since the crawl began.
   */
  achievementKicker: 'Achievement unlocked',
  /** The hero's credit. The player's name is bright; the rest is not. */
  playedBy: 'Played by',
  /** The hero's one call to action, on both sides of the `hubLiveAt` gate. */
  startAtEpisodeOne: 'Start at Episode 1',
  prevCrawler: 'Previous crawler',
  nextCrawler: 'Next crawler',

  // --- /community
  communityTitle: 'Keep up with the crawl',
  communityLead: 'Watch new episodes, follow the cast, and join the Dungeon Crawl Cast community.',
  /** The Discord card on /community (the home strip keeps `discordBody`). */
  communityDiscordBody:
    'Talk episodes, swap floor theories, share your favorite moments, and hang out with other crawlers between sessions.',
  followTitle: 'Follow the crawl',
  /** Landmark name for the heading-less closing paragraph. */
  supportAria: 'How to support the show',
  /** Closing paragraph on /community; it has no heading by design (author copy, 2026-09-25). */
  supportBody:
    'If you\'re having fun with the crawl, help us bring a few more people into the dungeon. Subscribe on YouTube, send your favorite episode to a friend, or come hang out with us in Discord. We\'re glad you\'re here.',

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
  watchDescription: 'Every episode of Dungeon Crawl Cast, filed by floor.',
  crawlersDescription: 'The five crawlers of Dungeon Crawl Cast, and the players behind them.',
  /*
   * A crawler whose concept is not written yet still needs a description: the
   * archetype is the one line about them that is always true (011 R2).
   */
  crawlerDescription: (name: string, concept: string, archetype: string) =>
    concept === '' ? `${name} - ${archetype} on Dungeon Crawl Cast.` : `${name}. ${concept}`,
  communityDescription:
    'Discord, YouTube and everywhere else Dungeon Crawl Cast turns up, plus how often new crawls land.',
} as const;
