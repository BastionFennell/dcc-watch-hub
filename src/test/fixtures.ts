/**
 * Tiny in-memory show + episode used by every test. Deliberately small enough to
 * reason about by hand, but rich enough to exercise the time-truth invariants:
 * clustered achievements (60/61/62), a below-25% HP drop, a status add + remove,
 * a 20 s sponsor, a chapter, a map reveal, and one unknown event type.
 */
import type { EpisodeData, Show } from '../data/types';
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
  };
}

/** Raw (unnormalized) episode data, as it would sit on disk. */
export function makeEpisodeRaw(episodeId = 1): unknown {
  return {
    episodeId,
    initialState: {
      party: [
        crawler('stuntman', 'The Stuntman', 3, 24, 'Dungeon Crawler Danny', 'Danny'),
        crawler('psychic', 'The Psychic', 3, 20, 'Signal', 'Rae'),
        crawler('harry', 'Harry', 2, 22, 'Harry', 'Marcus'),
        crawler('xo', 'X.O.', 1, 18, 'X.O.', 'Jules'),
        crawler('actress', 'The Actress', 3, 21, 'Understudy', 'Nia'),
      ],
      partyRank: null,
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
      { t: 80, type: 'rank', scope: 'party', rank: 61 },
      { t: 90, type: 'map_reveal', cells: [[3, 2], [4, 2]], label: 'The Meat District' },
      { t: 100, type: 'future_type', payload: 'must never render' },
      { t: 110, type: 'sponsor', text: 'This death brought to you by Grull Industries.', durationSec: 20 },
      { t: 120, type: 'chapter', label: 'The Hoarder Fight', kind: 'boss' },
      { t: 130, type: 'status', actor: 'psychic', add: ['Poisoned'], remove: [] },
      { t: 140, type: 'status', actor: 'psychic', add: [], remove: ['Poisoned'] },
      { t: 150, type: 'inventory', actor: 'harry', add: ['Torch'], remove: ['Enchanted Crowbar'] },
      { t: 160, type: 'note', text: 'The System declines to comment.' },
      { t: 170, type: 'hp', actor: 'harry', current: 20, max: 22 },
    ],
  };
}

export function makeEpisode(episodeId = 1): EpisodeData {
  return normalizeEpisode(makeEpisodeRaw(episodeId));
}
