/**
 * Tiny in-memory show + episode used by every test. Deliberately small enough to
 * reason about by hand, but rich enough to exercise the time-truth invariants:
 * clustered achievements (60/61/62), a below-25% HP drop, a status add + remove,
 * a 20 s sponsor, a chapter, a map reveal, and one unknown event type.
 *
 * v2 adds the facts data-model §5 pins down, at times that leave every v1
 * assertion true: Harry's rank at 100/150/200 (4188 → 3012 → 3550),
 * X.O.'s skill upsert at 80 and 160, Harry's class at 95, his hotlist at 105
 * and 165, a second labeled reveal at 175 ("The Rot Market"), and optional
 * sheet fields on the party (Harry carries the full set).
 *
 * 003 revision 2 adds gear and art (data-model "Revision 2 additions"): Harry
 * starts with the crowbar in `hands`, equips a torso item at 152 and an
 * accessory at 153, drops the crowbar at 168 and takes a torch at 169; X.O.
 * logs nine skills by 200 (so the record's eight-tile grid overflows); Harry's
 * hotlist reaches eleven entries at 210 (so the ten-slot hotbar overflows);
 * Harry and The Actress carry `art`, the other three fall back to the bust.
 */
import type { Crawler, EpisodeData, Show } from '../data/types';
import { normalizeEpisode } from '../data/validate';

export function makeShow(): Show {
  return {
    title: 'Dungeon Crawl Cast',
    seasons: [
      {
        season: 1,
        floors: [
          { floor: 1, label: 'Floor 1', episodes: [1, 2] },
          { floor: 2, label: 'Floor 2', episodes: [3] },
        ],
      },
    ],
    episodes: [
      {
        id: 1,
        title: 'Episode 1 — The World Dungeon',
        youtubeId: 'M7lc1UVf-VE',
        floor: 1,
        durationSec: 240,
        dataUrl: '/data/ep1.json',
      },
      {
        id: 2,
        title: 'Episode 2 — The Meat District',
        youtubeId: 'M7lc1UVf-VE',
        floor: 1,
        durationSec: 240,
        dataUrl: '/data/ep2.json',
      },
      {
        id: 3,
        title: 'Episode 3 — Descent',
        youtubeId: 'M7lc1UVf-VE',
        floor: 2,
        durationSec: 240,
        dataUrl: '/data/ep3.json',
      },
    ],
    links: {
      youtube: 'https://www.youtube.com/@DungeonCrawlCast',
      discord: 'https://discord.gg/REPLACE_ME',
    },
  };
}

function crawler(
  id: string,
  name: string,
  level: number,
  max: number,
  handle = '',
  player = '',
  /** Optional v2 sheet fields (data-model §5); v1 crawlers simply omit them. */
  sheet: Partial<Crawler> = {},
) {
  return {
    id,
    name,
    handle,
    player,
    level,
    hp: { current: max, max },
    portrait: `/img/crawlers/${id}.svg`,
    class: null,
    inventory: [] as string[],
    rank: null,
    ...sheet,
  };
}

/** Raw (unnormalized) episode data, as it would sit on disk. */
export function makeEpisodeRaw(episodeId = 1): unknown {
  return {
    episodeId,
    initialState: {
      party: [
        crawler('stuntman', 'The Stuntman', 3, 24, 'Dungeon Crawler Danny', 'Danny', {
          race: 'Human',
          pronouns: 'he/him',
        }),
        crawler('psychic', 'The Psychic', 3, 20, 'Signal', 'Rae', {
          race: 'Human',
          pronouns: 'she/her',
        }),
        crawler('harry', 'Harry', 2, 22, 'Harry', 'Marcus', {
          race: 'Human',
          pronouns: 'he/him',
          crawlerNumber: '10,491,201',
          stats: { str: 5, int: 6, con: 6, dex: 7, cha: 4 },
          hotlist: [],
          skills: [{ name: 'Powerful Strike', rank: 1 }],
          gear: { hands: 'Enchanted Crowbar' },
          art: '/img/crawlers/harry-art.svg',
        }),
        crawler('xo', 'X.O.', 1, 18, 'X.O.', 'Jules', {
          race: 'Crocodilian',
          pronouns: 'they/them',
        }),
        crawler('actress', 'The Actress', 3, 21, 'Understudy', 'Nia', {
          race: 'Human',
          pronouns: 'she/her',
          art: '/img/crawlers/actress-art.svg',
        }),
      ],
      map: { floor: 1, grid: { cols: 12, rows: 8 }, revealed: [] },
    },
    events: [
      { t: 12, type: 'system_message', text: 'Attention crawlers. The broadcast is live.' },
      { t: 30, type: 'loot', actor: 'harry', item: 'Enchanted Crowbar', source: 'Bronze Box' },
      { t: 45, type: 'hp', actor: 'harry', current: 4, max: 22 },
      { t: 60, type: 'achievement', actor: 'harry', title: 'Gate Crasher', desc: 'Ten mobs, one door.' },
      { t: 61, type: 'achievement', actor: 'xo', title: 'Understudy', desc: 'Survived the opener.' },
      { t: 62, type: 'achievement', actor: 'stuntman', title: 'Stunt Double', desc: 'Took the hit.' },
      { t: 70, type: 'level_up', actor: 'xo', level: 2 },
      { t: 80, type: 'skill', actor: 'xo', name: 'Understudy Strike', rank: 1 },
      { t: 85, type: 'skill', actor: 'xo', name: 'Cold Read', rank: 3 },
      { t: 90, type: 'skill', actor: 'xo', name: 'Tail Whip', rank: 4 },
      { t: 90, type: 'map_reveal', cells: [[3, 2], [4, 2]], label: 'The Meat District' },
      { t: 95, type: 'class', actor: 'harry', class: 'Compensated Anarchist' },
      { t: 100, type: 'future_type', payload: 'must never render' },
      { t: 100, type: 'rank', actor: 'harry', rank: 4188 },
      { t: 105, type: 'hotlist', actor: 'harry', add: ['Door'], remove: [] },
      { t: 110, type: 'sponsor', text: 'This death brought to you by Grull Industries.', durationSec: 20 },
      { t: 115, type: 'skill', actor: 'xo', name: 'Quartermaster Eye', rank: 5 },
      { t: 120, type: 'chapter', label: 'The Hoarder Fight', kind: 'boss' },
      { t: 125, type: 'skill', actor: 'xo', name: 'Scale Guard', rank: 6 },
      { t: 130, type: 'status', actor: 'psychic', add: ['Poisoned'], remove: [] },
      { t: 135, type: 'skill', actor: 'xo', name: 'Deep Breath', rank: 7 },
      { t: 140, type: 'status', actor: 'psychic', add: [], remove: ['Poisoned'] },
      { t: 140, type: 'skill', actor: 'xo', name: 'Death Roll', rank: 8 },
      { t: 145, type: 'skill', actor: 'xo', name: 'Ledger Sense', rank: 9 },
      { t: 148, type: 'skill', actor: 'xo', name: 'Swamp Step' },
      { t: 150, type: 'inventory', actor: 'harry', add: ['Torch'], remove: ['Enchanted Crowbar'] },
      { t: 150, type: 'rank', actor: 'harry', rank: 3012 },
      { t: 152, type: 'equip', actor: 'harry', slot: 'torso', item: 'Patched Jacket' },
      { t: 153, type: 'equip', actor: 'harry', slot: 'accessory', item: 'Lucky Rabbit Foot' },
      { t: 160, type: 'note', text: 'The System declines to comment.' },
      { t: 160, type: 'skill', actor: 'xo', name: 'Understudy Strike', rank: 2 },
      { t: 165, type: 'hotlist', actor: 'harry', add: ['Crowbar'], remove: ['Door'] },
      { t: 168, type: 'unequip', actor: 'harry', slot: 'hands' },
      { t: 169, type: 'equip', actor: 'harry', slot: 'hands', item: 'Torch' },
      { t: 170, type: 'hp', actor: 'harry', current: 20, max: 22 },
      { t: 175, type: 'map_reveal', cells: [[6, 5], [6, 6], [7, 5]], label: 'The Rot Market' },
      { t: 200, type: 'rank', actor: 'harry', rank: 3550 },
      {
        t: 210,
        type: 'hotlist',
        actor: 'harry',
        add: [
          'The Hoarder',
          'Bronze Box Runner',
          'The Doorway',
          'Quadrant C',
          'The Rot Market',
          'Signal Tower',
          'The Meat District',
          'Grull Industries',
          'The Understudy',
          'Floor Two',
        ],
        remove: [],
      },
    ],
  };
}

export function makeEpisode(episodeId = 1): EpisodeData {
  return normalizeEpisode(makeEpisodeRaw(episodeId));
}
