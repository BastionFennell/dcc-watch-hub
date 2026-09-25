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
 *
 * 007 adds the registry `makeRegistry()` and the `npc` events data-model "Fixture
 * facts" pins down (112 met grull-rep, 118 met hoarder, 122 update unlock lair,
 * 135 seen quartermaster, 140 met unknown-id, 185 update unlock weakness, 195
 * defeated hoarder) - all past t = 100, so every earlier feed count still holds.
 */
import type {
  Crawler,
  CrawlerRoster,
  DossierFile,
  EpisodeData,
  Registry,
  Show,
  SpellRegistry,
  StatusFile,
} from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { quietBody, quietTitle } from '../site/dossier/quiet';

export function makeShow(): Show {
  return {
    title: 'Dungeon Crawl Cast',
    // 011: the front door's copy. The hub ignores all three.
    tagline: 'Heart and chaos in the World Dungeon.',
    pitch: 'Five people from a film crew. One apocalypse.',
    cadence: 'New crawls every other week.',
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
        title: 'Episode 1 - The World Dungeon',
        youtubeId: 'M7lc1UVf-VE',
        floor: 1,
        durationSec: 240,
        dataUrl: '/data/ep1.json',
      },
      {
        id: 2,
        title: 'Episode 2 - The Meat District',
        youtubeId: 'M7lc1UVf-VE',
        floor: 1,
        durationSec: 240,
        dataUrl: '/data/ep2.json',
      },
      {
        id: 3,
        title: 'Episode 3 - Descent',
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
    registryUrl: '/data/npcs.json',
    spellsUrl: '/data/spells.json',
  };
}

function crawler(
  id: string,
  name: string,
  level: number,
  /** HB slots on the bar - ten for everyone (author, 2026-09-25). */
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
        crawler('stuntman', 'The Stuntman', 3, 10, 'Dungeon Crawler Danny', 'Danny', {
          race: 'Human',
          pronouns: 'he/him',
        }),
        /*
         * 008 revision 2: the one crawler whose sheet carries structure. Harry
         * keeps the plain string entries every earlier test asserts on, so the
         * two shapes are exercised side by side in the same episode.
         */
        crawler('psychic', 'The Psychic', 3, 10, 'Signal', 'Rae', {
          race: 'Human',
          pronouns: 'she/her',
          /*
           * 009: the one fixture crawler whose sheet writes the mana box. She has
           * no stats at all, so the rule would give her no pool - the explicit box
           * winning over that is the precedence the model promises. Harry has INT
           * and no box, so he exercises the derivation; everyone else has neither
           * and reads 0/0, which is how the strip learns to hide.
           */
          mana: { current: 5, max: 5 },
          hotlist: [
            {
              name: 'Mana Draught',
              qty: 5,
              desc: 'Restores your Mana in full when you spend an Action to drink one.',
            },
          ],
          spells: [
            {
              name: 'Second Sight',
              rank: 2,
              mana: 3,
              desc: 'Read the room one beat before it happens.',
            },
          ],
        }),
        crawler('harry', 'Harry', 2, 10, 'Harry', 'Marcus', {
          race: 'Human',
          pronouns: 'he/him',
          crawlerNumber: '10,491,201',
          stats: { str: 5, int: 6, con: 6, dex: 7, cha: 4 },
          hotlist: [],
          skills: [{ name: 'Powerful Strike', rank: 1 }],
          gear: { hands: 'Enchanted Crowbar' },
          art: '/img/crawlers/harry-art.svg',
        }),
        crawler('xo', 'X.O.', 1, 10, 'X.O.', 'Jules', {
          race: 'Crocodilian',
          pronouns: 'they/them',
        }),
        crawler('actress', 'The Actress', 3, 10, 'Understudy', 'Nia', {
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
      { t: 45, type: 'hp', actor: 'harry', current: 2, max: 10 },
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
      { t: 112, type: 'npc', id: 'grull-rep', action: 'met' },
      { t: 115, type: 'skill', actor: 'xo', name: 'Quartermaster Eye', rank: 5 },
      {
        t: 118,
        type: 'npc',
        id: 'hoarder',
        action: 'met',
        note: 'Something is stacking crates in Quadrant C.',
      },
      { t: 120, type: 'chapter', label: 'The Hoarder Fight', kind: 'boss' },
      { t: 122, type: 'npc', id: 'hoarder', action: 'update', unlock: ['lair'] },
      { t: 125, type: 'skill', actor: 'xo', name: 'Scale Guard', rank: 6 },
      { t: 130, type: 'status', actor: 'psychic', add: ['Poisoned'], remove: [] },
      { t: 135, type: 'npc', id: 'quartermaster', action: 'seen' },
      { t: 135, type: 'skill', actor: 'xo', name: 'Deep Breath', rank: 7 },
      { t: 140, type: 'status', actor: 'psychic', add: [], remove: ['Poisoned'] },
      { t: 140, type: 'npc', id: 'unknown-id', action: 'met' },
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
      { t: 170, type: 'hp', actor: 'harry', current: 9, max: 10 },
      // 009: a dip that leaves the pool alone (no `max`), then a full restore.
      { t: 171, type: 'mana', actor: 'psychic', current: 2 },
      { t: 172, type: 'mana', actor: 'psychic', current: 5, max: 5 },
      { t: 175, type: 'map_reveal', cells: [[6, 5], [6, 6], [7, 5]], label: 'The Rot Market' },
      { t: 185, type: 'npc', id: 'hoarder', action: 'update', unlock: ['weakness'], note: 'It cannot see red.' },
      { t: 195, type: 'npc', id: 'hoarder', action: 'defeated' },
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

/**
 * The show-level entity registry the fixture episode's `npc` events point at
 * (007 data-model "Fixture facts"): a boss with two facts, a vendor with none
 * (so the record's empty-facts line has something to say), and an ally with one.
 * `unknown-id` at t = 140 is deliberately absent - it is the missing-entity case.
 */
export function makeRegistry(): Registry {
  return {
    entities: [
      {
        id: 'hoarder',
        name: 'The Hoarder',
        kind: 'boss',
        floor: 1,
        portrait: '/img/npcs/hoarder.svg',
        aliases: ['The Crate King'],
        intro: 'Something in Quadrant C has been stacking crates into walls.',
        facts: [
          { id: 'lair', text: 'It nests behind the crate wall it builds.' },
          { id: 'weakness', text: 'It cannot see red.' },
        ],
      },
      {
        id: 'grull-rep',
        name: 'Grull Industries Representative',
        kind: 'vendor',
        floor: 1,
        aliases: ['Grull'],
        intro: 'A licensed window in the wall. It sells, and it watches.',
        facts: [],
      },
      {
        id: 'quartermaster',
        name: 'The Quartermaster',
        kind: 'ally',
        floor: 1,
        intro: 'Keeps the ledger of everything the floor still owes.',
        facts: [{ id: 'debt', text: 'It never forgives a debt; it only defers one.' }],
      },
    ],
  };
}

/**
 * A two-spell stand-in for the book (008 revision 4). `mending-light` carries
 * every optional field the tooltip can print - aliases, Interrupt, a duration, a
 * limitation, a cooldown and an upgrade - and `cinder-snap` is the plain attack
 * case with a damage type, an AI Favor, Base Damage and no upgrades at all.
 */
export function makeSpells(): SpellRegistry {
  return {
    spells: [
      {
        id: 'mending-light',
        name: 'Mending Light',
        aliases: ['Mend'],
        quote: 'Still breathing. Impressive.',
        kind: 'passive',
        interrupt: true,
        manaCost: 2,
        range: 'Self only',
        duration: '5 seconds',
        limitations: 'Rank 1 maximum',
        cooldown: '10 minutes',
        description: 'Heal 2 HB slots.',
        upgrades: [{ rank: 5, text: 'Heal 3 HB slots instead.' }],
        roll: [1, 40],
        page: 38,
      },
      {
        id: 'cinder-snap',
        name: 'Cinder Snap',
        kind: 'attack',
        damageType: 'Fire',
        areaOfEffect: true,
        manaCost: 7,
        range: 'Melee',
        aiFavor: 1,
        description: 'Brilliant flame leaps from your fingers.',
        baseDamage: '1d4 + Int Fire',
        upgrades: [],
        roll: [41, 100],
        page: 38,
      },
    ],
  };
}

/* ------------------------------------------------- front door (011) */

/**
 * A two-crawler roster whose ids match the fixture party (`stuntman`, `harry`),
 * so `status.json` joins onto it the way the real files do.
 */
export function makeCrawlers(): CrawlerRoster {
  return {
    crawlers: [
      {
        id: 'stuntman',
        name: 'The Stuntman',
        characterName: 'Ronald Hudson',
        handle: 'Dungeon Crawler Ronald',
        pronouns: 'he/him',
        player: { name: 'Danny', pronouns: 'he/him', bio: 'Two sentences about Danny.' },
        concept: 'Thrill-seeking stunt performer.',
        pockets: ['A roll of gaffer tape', 'Half a protein bar'],
        entryAchievement: {
          title: 'Method Acting',
          text: 'You committed to the bit.',
          box: 'Golden Monster Box',
          item: 'Liquid Latex',
          reward: 'Inside is a bottle of Liquid Latex.',
        },
        art: { bust: '/img/crawlers/stuntman.svg', full: '/img/crawlers/stuntman-art.png' },
      },
      {
        id: 'harry',
        name: 'Harry',
        characterName: 'Harold Wallace',
        handle: 'Dungeon Crawler Harry',
        pronouns: 'she/her',
        // The unwritten crawler: every optional field empty, so a test can ask
        // what the page renders when the author has not filled it in (011 R2).
        player: { name: 'Marcus' },
        concept: '',
        pockets: [],
        art: { bust: '/img/crawlers/harry.svg' },
      },
    ],
  };
}

/** The generated live status for the roster above. */
export function makeStatus(): StatusFile {
  return {
    generatedAt: '2026-09-01T00:00:00.000Z',
    episodeId: 1,
    crawlers: {
      stuntman: { level: 3, hp: { current: 8, max: 10 }, floor: 1, lastEpisodeId: 1 },
      harry: { level: 2, hp: { current: 10, max: 10 }, floor: 1, lastEpisodeId: 1 },
    },
  };
}

/**
 * A compiled dossier for the roster above (012): three aired episodes, one
 * card each, with the shapes the panel has to handle side by side - an update
 * on camera, a generated quiet card, and an update filed off camera. Nobody
 * dies here; the death cases are built in the tests that are about death, so
 * every other test's fixture stays free of the words.
 */
export function makeDossier(id = 'stuntman'): DossierFile {
  return {
    id,
    generatedAt: '2026-09-01T00:00:00.000Z',
    updates: [
      {
        episode: 1,
        floor: 1,
        kind: 'update',
        onCamera: true,
        title: 'Ronald breaks the fall and the arm',
        body: 'He goes under the ceiling to prove a point about doorways.',
        chips: ['UNPAID STUNT DOUBLE'],
        level: 1,
        condition: 'alive',
      },
      {
        episode: 2,
        floor: 1,
        kind: 'quiet',
        onCamera: false,
        title: quietTitle,
        body: quietBody('Ronald Hudson'),
        chips: [],
        level: 2,
        condition: 'alive',
      },
      {
        episode: 3,
        floor: 2,
        kind: 'update',
        onCamera: false,
        title: 'Ronald rigs the descent from the landing above',
        body: 'The Stuntman spends the episode out of frame and on a rope.',
        chips: ['RANK 520'],
        level: 3,
        condition: 'alive',
      },
    ],
  };
}
