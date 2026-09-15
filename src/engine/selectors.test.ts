import { describe, expect, it } from 'vitest';
import {
  GEAR_SLOT_ORDER,
  activeSponsor,
  crawlerDossier,
  crawlerGlance,
  crawlerHistory,
  hotbarSlots,
  activeToast,
  elapsed,
  feedItems,
  hpSegments,
  mapCells,
  mapLabels,
  partyFrames,
  rankSeries,
  recentlyRevealed,
  stageCaption,
  timelineMarkers,
} from './selectors';
import { reduceTo } from './reducer';
import { copy } from '../copy';
import { formatTime } from './time';
import { normalizeEpisode } from '../data/validate';
import type { EpisodeData } from '../data/types';
import { makeEpisode, makeEpisodeRaw, makeShow } from '../test/fixtures';

const episode = makeEpisode();
const party = episode.initialState.party;
const meta = makeShow().episodes[0];

function withEvents(events: unknown[]): EpisodeData {
  const raw = makeEpisodeRaw() as { events: unknown[] };
  return normalizeEpisode({ ...raw, events });
}

describe('formatTime', () => {
  it('formats mm:ss under an hour and h:mm:ss at or past it', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(61)).toBe('1:01');
    expect(formatTime(599.9)).toBe('9:59');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('elapsed', () => {
  it('returns only events at or before the playhead', () => {
    expect(elapsed(episode.events, 0)).toHaveLength(0);
    expect(elapsed(episode.events, 45).every((e) => e.t <= 45)).toBe(true);
  });
});

describe('feedItems', () => {
  it('is empty at t = 0', () => {
    expect(feedItems(episode.events, 0, 8, party)).toEqual([]);
  });

  it('shows elapsed events newest first', () => {
    const items = feedItems(episode.events, 45, 8, party);
    expect(items.map((i) => i.t)).toEqual([45, 30, 12]);
    expect(items[0].kind).toBe('hp');
  });

  it('caps at n and grows forward / shrinks backward', () => {
    const forward = feedItems(episode.events, 200, 8, party);
    expect(forward).toHaveLength(8);
    const backward = feedItems(episode.events, 62, 8, party);
    expect(backward.length).toBeLessThan(forward.length + 1);
    expect(backward.map((i) => i.t)).toEqual([62, 61, 60, 45, 30, 12]);
  });

  it('never includes an unknown event type', () => {
    const items = feedItems(episode.events, 235, 100, party);
    // The fixture's forward-compatibility event shares t = 100 with a rank event,
    // so identify it by its index (the FeedItem id), not by its time.
    const unknownIds = episode.events
      .map((event, index) => (event.type === 'unknown' ? index : -1))
      .filter((index) => index !== -1);
    expect(unknownIds.length).toBeGreaterThan(0);
    expect(items.some((item) => unknownIds.includes(item.id))).toBe(false);
  });

  it('never shows an event before its t (checked at every event boundary)', () => {
    for (const event of episode.events) {
      const before = feedItems(episode.events, event.t - 0.001, 100, party);
      const at = feedItems(episode.events, event.t, 100, party);
      expect(before.some((i) => i.t === event.t)).toBe(false);
      if (event.type !== 'unknown') {
        expect(at.some((i) => i.t === event.t)).toBe(true);
      }
    }
  });

  it('resolves actor names and keeps ids stable across seeks', () => {
    const late = feedItems(episode.events, 235, 100, party).find((i) => i.t === 30);
    const early = feedItems(episode.events, 30, 100, party).find((i) => i.t === 30);
    expect(late?.id).toBe(early?.id);
    expect(late?.text).toContain('Harry');
    expect(late?.label).toBe('Loot');
  });
});

describe('partyFrames', () => {
  it('reflects the state at the playhead', () => {
    const t = 0;
    const frames = partyFrames(reduceTo(episode, t), episode.events, t);
    expect(frames).toHaveLength(5);
    expect(frames.every((f) => f.statuses.length === 0)).toBe(true);
    expect(frames.every((f) => !f.danger)).toBe(true);
  });

  it('flags danger below 25% and clears it when HP recovers', () => {
    const low = partyFrames(reduceTo(episode, 46), episode.events, 46);
    expect(low.find((f) => f.id === 'harry')?.danger).toBe(true);
    expect(low.find((f) => f.id === 'harry')?.pct).toBe(18);
    const recovered = partyFrames(reduceTo(episode, 171), episode.events, 171);
    expect(recovered.find((f) => f.id === 'harry')?.danger).toBe(false);
  });

  it('pulses for 1.2 s after a level_up and not before it', () => {
    const before = partyFrames(reduceTo(episode, 69.9), episode.events, 69.9);
    expect(before.find((f) => f.id === 'xo')?.levelUpPulse).toBe(false);
    const during = partyFrames(reduceTo(episode, 70.5), episode.events, 70.5);
    expect(during.find((f) => f.id === 'xo')?.levelUpPulse).toBe(true);
    expect(during.find((f) => f.id === 'xo')?.level).toBe(2);
    const after = partyFrames(reduceTo(episode, 71.3), episode.events, 71.3);
    expect(after.find((f) => f.id === 'xo')?.levelUpPulse).toBe(false);
  });

  it('shows a status pip only between its add and remove', () => {
    const pip = (t: number) =>
      partyFrames(reduceTo(episode, t), episode.events, t).find((f) => f.id === 'psychic')
        ?.statuses ?? [];
    expect(pip(129.999)).toEqual([]);
    expect(pip(130)).toEqual(['Poisoned']);
    expect(pip(139.999)).toEqual(['Poisoned']);
    expect(pip(140)).toEqual([]);
  });
});

describe('activeToast', () => {
  const clustered = withEvents([
    { t: 300, type: 'achievement', actor: 'harry', title: 'First' },
    { t: 301, type: 'achievement', actor: 'xo', title: 'Second' },
    { t: 302, type: 'achievement', actor: 'stuntman', title: 'Third' },
  ]);

  it('queues clustered achievements FIFO, one at a time', () => {
    const at = (t: number) => activeToast(clustered.events, t, party)?.title ?? null;
    expect(at(299.999)).toBeNull();
    expect(at(300)).toBe('First');
    expect(at(305.999)).toBe('First');
    expect(at(306)).toBe('Second');
    expect(at(311.999)).toBe('Second');
    expect(at(312)).toBe('Third');
    expect(at(317.999)).toBe('Third');
    expect(at(318)).toBeNull();
  });

  it('exposes the computed window', () => {
    const toast = activeToast(clustered.events, 307, party);
    expect(toast).toMatchObject({ start: 306, end: 312 });
  });

  it('rebuilds after a backward seek', () => {
    expect(activeToast(clustered.events, 313, party)?.title).toBe('Third');
    expect(activeToast(clustered.events, 301, party)?.title).toBe('First');
  });

  it('carries the fixture cluster at 60/61/62', () => {
    expect(activeToast(episode.events, 60, party)?.title).toBe('Gate Crasher');
    expect(activeToast(episode.events, 65.9, party)?.title).toBe('Gate Crasher');
    expect(activeToast(episode.events, 66, party)?.title).toBe('Understudy');
    expect(activeToast(episode.events, 78, party)).toBeNull();
    expect(activeToast(episode.events, 59, party)).toBeNull();
  });
});

describe('activeSponsor', () => {
  it('is pinned only inside its window', () => {
    expect(activeSponsor(episode.events, 109.999, party)).toBeNull();
    expect(activeSponsor(episode.events, 110, party)?.kind).toBe('sponsor');
    expect(activeSponsor(episode.events, 129.999, party)).not.toBeNull();
    expect(activeSponsor(episode.events, 130, party)).toBeNull();
  });

  it('picks the latest sponsor when windows overlap', () => {
    const overlapping = withEvents([
      { t: 10, type: 'sponsor', text: 'First sponsor', durationSec: 60 },
      { t: 20, type: 'sponsor', text: 'Second sponsor', durationSec: 60 },
    ]);
    expect(activeSponsor(overlapping.events, 30, party)?.text).toBe('Second sponsor');
  });
});

describe('timelineMarkers', () => {
  it('marks chapters, achievements, and level-ups at t / duration', () => {
    const markers = timelineMarkers(episode.events, 240, party);
    expect(markers.map((m) => m.kind)).toEqual([
      'achievement',
      'achievement',
      'achievement',
      'levelup',
      'boss',
    ]);
    const boss = markers.find((m) => m.kind === 'boss');
    expect(boss?.pos).toBeCloseTo(0.5, 5);
    expect(boss?.color).toBe('var(--marker-boss)');
    expect(markers.find((m) => m.kind === 'levelup')?.label).toBe('X.O. reaches Lv 2');
  });

  it('falls back to the story color for an unknown chapter kind', () => {
    const odd = withEvents([{ t: 10, type: 'chapter', label: 'Mystery', kind: 'interlude' }]);
    const [marker] = timelineMarkers(odd.events, 240, party);
    expect(marker.kind).toBe('story');
    expect(marker.color).toBe('var(--marker-story)');
  });

  it('clamps positions into 0..1', () => {
    const late = withEvents([{ t: 9999, type: 'chapter', label: 'Past the end', kind: 'story' }]);
    expect(timelineMarkers(late.events, 240, party)[0].pos).toBe(1);
  });
});

describe('mapCells', () => {
  it('reveals cells only after their event', () => {
    expect(mapCells(reduceTo(episode, 89.999)).revealed.size).toBe(0);
    const after = mapCells(reduceTo(episode, 90));
    expect(after.revealed.has('3,2')).toBe(true);
    expect(after.revealed.has('4,2')).toBe(true);
    expect(after.total).toBe(96);
    expect(after.floor).toBe(1);
  });
});

describe('stageCaption', () => {
  it('reads Ep n · Floor n · time', () => {
    expect(stageCaption(meta, 2482)).toBe('Ep 1 · Floor 1 · 41:22');
  });
});

describe('recentlyRevealed', () => {
  it('is empty before the reveal and inside a backward seek', () => {
    expect(recentlyRevealed(episode.events, 0).size).toBe(0);
    expect(recentlyRevealed(episode.events, 89.999).size).toBe(0);
    expect(recentlyRevealed(episode.events, 50).size).toBe(0);
  });

  it('holds the revealed cells for the window after the event', () => {
    const atReveal = recentlyRevealed(episode.events, 90);
    expect([...atReveal].sort()).toEqual(['3,2', '4,2']);
    expect(recentlyRevealed(episode.events, 94.999).size).toBe(2);
  });

  it('drops them once the window closes, while the cells stay revealed', () => {
    expect(recentlyRevealed(episode.events, 95).size).toBe(0);
    expect(recentlyRevealed(episode.events, 200).size).toBe(0);
    // Two cells from the reveal at 90, three more from the reveal at 175.
    expect(mapCells(reduceTo(episode, 200)).revealed.size).toBe(5);
  });

  it('honours a custom window', () => {
    expect(recentlyRevealed(episode.events, 91, 1).size).toBe(0);
    expect(recentlyRevealed(episode.events, 91, 2).size).toBe(2);
  });

  it('merges overlapping reveals and ignores unknown event types', () => {
    const overlapping = withEvents([
      { t: 10, type: 'map_reveal', cells: [[0, 0]] },
      { t: 12, type: 'map_reveal', cells: [[0, 1], [0, 0]] },
      { t: 12, type: 'future_type', payload: 'must never render' },
    ]);
    expect([...recentlyRevealed(overlapping.events, 12)].sort()).toEqual(['0,0', '0,1']);
    // The first window has closed at 15.5; the second still covers both of its cells.
    expect([...recentlyRevealed(overlapping.events, 15.5)].sort()).toEqual(['0,0', '0,1']);
    expect(recentlyRevealed(overlapping.events, 17).size).toBe(0);
  });
});

/* ---------------------------------------------------------- v2 selectors */

describe('feed items for the v2 event types', () => {
  it('labels and narrates skill, class and hotlist', () => {
    const items = feedItems(episode.events, 200, 100, party);
    const find = (kind: string, t: number) =>
      items.find((item) => item.kind === kind && item.t === t);

    expect(find('skill', 80)).toMatchObject({
      label: copy.labels.skill,
      text: copy.feedText.skill('X.O.', 'Understudy Strike', 1),
      actorName: 'X.O.',
    });
    expect(find('class', 95)).toMatchObject({
      label: copy.labels.class,
      text: copy.feedText.classChange('Harry', 'Compensated Anarchist'),
    });
    expect(find('hotlist', 165)).toMatchObject({
      label: copy.labels.hotlist,
      text: copy.feedText.hotlist('Harry', ['Crowbar'], ['Door']),
    });
  });
});

describe('crawlerHistory', () => {
  it('is empty at t = 0 and for an actor with nothing logged', () => {
    expect(crawlerHistory(episode.events, 0, 'harry', party)).toEqual([]);
    expect(crawlerHistory(episode.events, 200, 'actress', party)).toEqual([]);
  });

  it('returns only that crawler’s elapsed events, newest first and uncapped', () => {
    const history = crawlerHistory(episode.events, 200, 'harry', party);
    expect(history.map((item) => item.t)).toEqual([
      200, 170, 169, 168, 165, 153, 152, 150, 150, 105, 100, 95, 60, 45, 30,
    ]);
    expect(history.length).toBeGreaterThan(8);
    expect(history.every((item) => item.actorName === 'Harry')).toBe(true);
  });

  it('shrinks on a backward seek and never carries a party-scoped event', () => {
    expect(crawlerHistory(episode.events, 60, 'harry', party).map((item) => item.t)).toEqual([
      60, 45, 30,
    ]);
    // The party rank at 80 belongs to nobody.
    expect(
      crawlerHistory(episode.events, 200, 'harry', party).some(
        (item) => item.kind === 'rank' && item.t === 80,
      ),
    ).toBe(false);
  });

  it('ignores unknown event types', () => {
    expect(
      crawlerHistory(episode.events, 200, 'harry', party).some((item) => item.t === 100 && item.kind !== 'rank'),
    ).toBe(false);
  });
});

describe('rankSeries', () => {
  it('has no points, current or best before the first rank event', () => {
    expect(rankSeries(episode.events, 99, { actor: 'harry' })).toEqual({
      points: [],
      current: null,
      best: null,
    });
  });

  it('plots one point per elapsed crawler rank event, with current and best', () => {
    const at200 = rankSeries(episode.events, 200, { actor: 'harry' });
    expect(at200.points).toEqual([
      { t: 100, rank: 4188 },
      { t: 150, rank: 3012 },
      { t: 200, rank: 3550 },
    ]);
    expect(at200.current).toBe(3550);
    expect(at200.best).toBe(3012);
  });

  it('rewinds with the playhead', () => {
    const at120 = rankSeries(episode.events, 120, { actor: 'harry' });
    expect(at120.points).toHaveLength(1);
    expect(at120.current).toBe(4188);
    expect(at120.best).toBe(4188);
  });

  it('reads party-scoped events under the party scope only', () => {
    expect(rankSeries(episode.events, 200, 'party')).toEqual({
      points: [{ t: 80, rank: 61 }],
      current: 61,
      best: 61,
    });
    expect(rankSeries(episode.events, 79, 'party').current).toBeNull();
    expect(rankSeries(episode.events, 200, { actor: 'xo' }).points).toEqual([]);
  });
});

describe('hpSegments', () => {
  it('fills all ten segments at full health and none at zero', () => {
    expect(hpSegments({ current: 22, max: 22 })).toEqual({ filled: 10, pct: 100 });
    expect(hpSegments({ current: 0, max: 22 })).toEqual({ filled: 0, pct: 0 });
  });

  it('rounds up, so any surviving crawler keeps a segment', () => {
    expect(hpSegments({ current: 1, max: 22 }).filled).toBe(1);
    expect(hpSegments({ current: 4, max: 22 })).toEqual({ filled: 2, pct: 18 });
    expect(hpSegments({ current: 11, max: 22 })).toEqual({ filled: 5, pct: 50 });
    expect(hpSegments({ current: 12, max: 22 }).filled).toBe(6);
  });

  it('clamps nonsense instead of throwing', () => {
    expect(hpSegments({ current: 99, max: 22 })).toEqual({ filled: 10, pct: 100 });
    expect(hpSegments({ current: -5, max: 22 })).toEqual({ filled: 0, pct: 0 });
    // A zero max is impossible per the schema; treat it like partyFrames does (max → 1).
    expect(hpSegments({ current: 5, max: 0 })).toEqual({ filled: 10, pct: 100 });
  });
});

describe('crawlerDossier', () => {
  const dossierAt = (t: number, id = 'harry') =>
    crawlerDossier(reduceTo(episode, t), episode.events, t, id, party);

  it('is null for an actor the episode does not know', () => {
    expect(crawlerDossier(reduceTo(episode, 200), episode.events, 200, 'ghost', party)).toBeNull();
  });

  it('carries the sheet header, vitals and stats as of the playhead', () => {
    const dossier = dossierAt(200);
    expect(dossier).toMatchObject({
      id: 'harry',
      name: 'Harry',
      handle: 'Harry',
      player: 'Marcus',
      race: 'Human',
      pronouns: 'he/him',
      crawlerNumber: '10,491,201',
      level: 2,
      class: 'Compensated Anarchist',
      floor: 1,
      stats: { str: 5, int: 6, con: 6, dex: 7, cha: 4 },
    });
    expect(dossier?.hp).toEqual({ current: 20, max: 22, filled: 10, pct: 91 });
    expect(dossier?.rank.current).toBe(3550);
  });

  it('is unclassed and unranked before those events elapse', () => {
    const dossier = dossierAt(90);
    expect(dossier?.class).toBeNull();
    expect(dossier?.rank.points).toEqual([]);
    expect(dossier?.hp).toMatchObject({ current: 4, filled: 2 });
  });

  it('lists hotlist, skills, inventory and achievements as of t', () => {
    expect(dossierAt(110)?.hotlist).toEqual(['Door']);
    expect(dossierAt(200)?.hotlist).toEqual(['Crowbar']);
    expect(dossierAt(200)?.skills).toEqual([{ name: 'Powerful Strike', rank: 1 }]);
    // X.O. logs nine skills by 200; the first one is upserted to rank 2 at 160.
    expect(dossierAt(200, 'xo')?.skills).toHaveLength(9);
    expect(dossierAt(200, 'xo')?.skills[0]).toEqual({ name: 'Understudy Strike', rank: 2 });
    expect(dossierAt(100, 'xo')?.skills[0]).toEqual({ name: 'Understudy Strike', rank: 1 });
    expect(dossierAt(200)?.achievements).toEqual([
      { title: 'Gate Crasher', desc: 'Ten mobs, one door.', t: 60 },
    ]);
    expect(dossierAt(59)?.achievements).toEqual([]);
  });

  it('removes what has not been earned yet on a backward seek', () => {
    // Harry loots the crowbar at 30 and trades it for a torch at 150.
    expect(dossierAt(40)?.inventory).toEqual(['Enchanted Crowbar']);
    expect(dossierAt(200)?.inventory).toEqual(['Torch']);
    expect(dossierAt(20)?.inventory).toEqual([]);
    expect(dossierAt(20)?.history).toEqual([]);
  });

  it('reports debuffs from the crawler’s statuses', () => {
    expect(dossierAt(135, 'psychic')?.debuffs).toEqual(['Poisoned']);
    expect(dossierAt(145, 'psychic')?.debuffs).toEqual([]);
  });

  it('omits sheet fields the data does not carry', () => {
    const dossier = dossierAt(200, 'xo');
    expect(dossier?.stats).toBeUndefined();
    expect(dossier?.crawlerNumber).toBeUndefined();
    expect(dossier?.race).toBe('Crocodilian');
  });
});

describe('mapLabels', () => {
  it('labels nothing before the first labeled reveal', () => {
    expect(mapLabels(episode.events, 89)).toEqual([]);
  });

  it('places one label at the centroid of its cells', () => {
    expect(mapLabels(episode.events, 100)).toEqual([
      { label: 'The Meat District', row: 3.5, col: 2, cells: 2 },
    ]);
  });

  it('adds later labels in first-reveal order and drops them on a backward seek', () => {
    const at180 = mapLabels(episode.events, 180);
    expect(at180.map((entry) => entry.label)).toEqual(['The Meat District', 'The Rot Market']);
    expect(at180[1].row).toBeCloseTo(6.333, 3);
    expect(at180[1].col).toBeCloseTo(5.333, 3);
    expect(at180[1].cells).toBe(3);
    expect(mapLabels(episode.events, 174)).toHaveLength(1);
  });

  it('merges reveals that share a label over the union of their cells', () => {
    const shared = withEvents([
      { t: 10, type: 'map_reveal', cells: [[0, 0], [0, 2]], label: 'The Sump' },
      { t: 20, type: 'map_reveal', cells: [[0, 2], [2, 2]], label: 'The Sump' },
      { t: 30, type: 'map_reveal', cells: [[5, 5]] },
    ]);
    expect(mapLabels(shared.events, 20)).toEqual([
      { label: 'The Sump', row: 2 / 3, col: 4 / 3, cells: 3 },
    ]);
    // An unlabeled reveal contributes nothing.
    expect(mapLabels(shared.events, 30)).toHaveLength(1);
  });
});

describe('crawlerGlance', () => {
  const glanceAt = (t: number, id = 'harry') => {
    const dossier = crawlerDossier(reduceTo(episode, t), episode.events, t, id, party);
    if (dossier === null) throw new Error(`no dossier for ${id} at ${t}`);
    return crawlerGlance(dossier);
  };

  it('carries the header, vitals and rank straight from the dossier', () => {
    const glance = glanceAt(200);
    expect(glance).toMatchObject({
      id: 'harry',
      name: 'Harry',
      handle: 'Harry',
      player: 'Marcus',
      portrait: '/img/crawlers/harry.svg',
      class: 'Compensated Anarchist',
      level: 2,
      debuffs: [],
    });
    expect(glance.hp).toEqual({ current: 20, max: 22, filled: 10, pct: 91 });
    expect(glance.rank.current).toBe(3550);
    expect(glance.rank.best).toBe(3012);
  });

  it('reduces each list to a count and its newest entry', () => {
    // Harry at 200: hotlist ['Crowbar'] (Door cleared at 165), inventory
    // ['Torch'] (the crowbar traded at 150), one skill, one achievement.
    expect(glanceAt(200).ledger).toEqual({
      hotlist: { count: 1, newest: { text: 'Crowbar' } },
      skills: { count: 1, newest: { text: 'Powerful Strike · Rank 1' } },
      inventory: { count: 1, newest: { text: 'Torch' } },
      achievements: { count: 1, newest: { text: 'Gate Crasher', t: 60 } },
    });
  });

  it('follows a backward seek: the hotlist is the Door again at 110', () => {
    expect(glanceAt(110).ledger.hotlist).toEqual({ count: 1, newest: { text: 'Door' } });
    expect(glanceAt(110).ledger.inventory).toEqual({
      count: 1,
      newest: { text: 'Enchanted Crowbar' },
    });
  });

  it('omits `newest` for a list nothing has landed in yet', () => {
    const glance = glanceAt(20);
    expect(glance.ledger.hotlist).toEqual({ count: 0 });
    expect(glance.ledger.inventory).toEqual({ count: 0 });
    expect(glance.ledger.achievements).toEqual({ count: 0 });
    expect(glance.ledger.hotlist.newest).toBeUndefined();
    // The sheet's initial skills are not events; they are there from t=0.
    expect(glance.ledger.skills).toEqual({
      count: 1,
      newest: { text: 'Powerful Strike · Rank 1' },
    });
    expect(glance.recentHistory).toEqual([]);
  });

  it('suffixes a skill rank only when the entry carries one', () => {
    // The ledger is deprecated (R2 wave 2 deletes it) but still derived here.
    expect(glanceAt(160, 'xo').ledger.skills).toEqual({
      count: 9,
      newest: { text: 'Swamp Step' },
    });
    expect(glanceAt(90, 'xo').ledger.skills).toEqual({
      count: 3,
      newest: { text: 'Tail Whip · Rank 4' },
    });
    expect(glanceAt(79, 'xo').ledger.skills).toEqual({ count: 0 });
  });

  it('keeps at most the three newest history moments, newest first', () => {
    const history = glanceAt(200).recentHistory;
    expect(history).toHaveLength(3);
    expect(history.map((item) => item.t)).toEqual([200, 170, 169]);
    expect(history[0].kind).toBe('rank');
    // Harry's first moment is the loot at 30; before that there is nothing.
    expect(glanceAt(40).recentHistory.map((item) => item.t)).toEqual([30]);
  });

  it('is unranked before the first rank event elapses', () => {
    const glance = glanceAt(90);
    expect(glance.rank).toEqual({ points: [], current: null, best: null });
  });

  it('reports debuffs as the dossier does', () => {
    expect(glanceAt(135, 'psychic').debuffs).toEqual(['Poisoned']);
    expect(glanceAt(145, 'psychic').debuffs).toEqual([]);
  });
});

/* ------------------------------------------------------- 003 revision 2 */

describe('feed items for the gear event types', () => {
  it('labels and narrates equip and unequip', () => {
    const items = feedItems(episode.events, 170, 8, party);
    const equip = items.find((item) => item.kind === 'equip' && item.t === 152);
    expect(equip?.label).toBe(copy.labels.equip);
    expect(equip?.text).toBe(
      copy.feedText.equip('Harry', copy.gearSlotLabels.torso, 'Patched Jacket'),
    );
    expect(equip?.actorName).toBe('Harry');

    const unequip = items.find((item) => item.kind === 'unequip');
    expect(unequip?.label).toBe(copy.labels.unequip);
    expect(unequip?.text).toBe(copy.feedText.unequip('Harry', copy.gearSlotLabels.hands));
  });

  it('names the item on an accessory unequip', () => {
    const custom = withEvents([
      {
        t: 10,
        type: 'unequip',
        actor: 'harry',
        slot: 'accessory',
        item: 'Lucky Rabbit Foot',
      },
    ]);
    expect(feedItems(custom.events, 10, 8, party)[0].text).toBe(
      copy.feedText.unequip('Harry', copy.gearSlotLabels.accessory, 'Lucky Rabbit Foot'),
    );
  });
});

describe('crawlerDossier — gear and art', () => {
  const dossierAt = (t: number, id = 'harry') =>
    crawlerDossier(reduceTo(episode, t), episode.events, t, id, party);

  it('carries the worn gear as of the playhead', () => {
    expect(dossierAt(151)?.gear).toMatchObject({ hands: 'Enchanted Crowbar', torso: null });
    expect(dossierAt(200)?.gear).toEqual({
      head: null,
      torso: 'Patched Jacket',
      arms: null,
      hands: 'Torch',
      legs: null,
      feet: null,
      accessories: ['Lucky Rabbit Foot'],
    });
  });

  it('carries `art` only for the crawlers that have it', () => {
    expect(dossierAt(200)?.art).toBe('/img/crawlers/harry-art.svg');
    expect(dossierAt(200, 'actress')?.art).toBe('/img/crawlers/actress-art.svg');
    expect(dossierAt(200, 'xo')?.art).toBeUndefined();
    expect(dossierAt(200, 'xo')).not.toHaveProperty('art');
  });
});

describe('GEAR_SLOT_ORDER', () => {
  it('is the sheet order, accessories last', () => {
    expect([...GEAR_SLOT_ORDER]).toEqual([
      'head',
      'torso',
      'arms',
      'hands',
      'legs',
      'feet',
      'accessory',
    ]);
  });
});

describe('hotbarSlots', () => {
  it('pads an empty hotlist to ten empty slots', () => {
    expect(hotbarSlots([])).toEqual({ slots: Array(10).fill(null), overflow: 0 });
  });

  it('fills slots in order and leaves the rest dim', () => {
    const { slots, overflow } = hotbarSlots(['The Hoarder', 'The Doorway']);
    expect(slots.slice(0, 2)).toEqual(['The Hoarder', 'The Doorway']);
    expect(slots.slice(2).every((slot) => slot === null)).toBe(true);
    expect(slots).toHaveLength(10);
    expect(overflow).toBe(0);
  });

  it('counts everything past the tenth slot', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Mark ${i + 1}`);
    const { slots, overflow } = hotbarSlots(many);
    expect(slots).toEqual(many.slice(0, 10));
    expect(overflow).toBe(3);
  });

  it('honours a custom slot count', () => {
    expect(hotbarSlots(['a', 'b', 'c'], 2)).toEqual({ slots: ['a', 'b'], overflow: 1 });
  });

  it('reads the fixture: Harry overflows the bar at 210', () => {
    const at200 = reduceTo(episode, 200).party.find((crawler) => crawler.id === 'harry');
    expect(hotbarSlots(at200?.hotlist ?? [])).toMatchObject({ overflow: 0 });
    const at210 = reduceTo(episode, 210).party.find((crawler) => crawler.id === 'harry');
    expect(at210?.hotlist).toHaveLength(11);
    expect(hotbarSlots(at210?.hotlist ?? []).overflow).toBe(1);
  });
});

describe('crawlerGlance — equipped and latest achievement', () => {
  const glanceAt = (t: number, id = 'harry') => {
    const dossier = crawlerDossier(reduceTo(episode, t), episode.events, t, id, party);
    if (dossier === null) throw new Error(`no dossier for ${id} at ${t}`);
    return crawlerGlance(dossier);
  };

  it('lists worn gear in sheet order with accessories expanded', () => {
    expect(glanceAt(200).equipped).toEqual([
      { slot: 'torso', item: 'Patched Jacket' },
      { slot: 'hands', item: 'Torch' },
      { slot: 'accessory', item: 'Lucky Rabbit Foot' },
    ]);
  });

  it('follows the playhead, forwards and back', () => {
    expect(glanceAt(20).equipped).toEqual([{ slot: 'hands', item: 'Enchanted Crowbar' }]);
    expect(glanceAt(168).equipped).toEqual([
      { slot: 'torso', item: 'Patched Jacket' },
      { slot: 'accessory', item: 'Lucky Rabbit Foot' },
    ]);
    // A crawler who never equips anything shows nothing at all.
    expect(glanceAt(200, 'xo').equipped).toEqual([]);
  });

  it('carries the newest achievement with its time, and none before the first', () => {
    expect(glanceAt(200).latestAchievement).toEqual({
      title: 'Gate Crasher',
      desc: 'Ten mobs, one door.',
      t: 60,
    });
    expect(glanceAt(59).latestAchievement).toBeUndefined();
    expect(glanceAt(59)).not.toHaveProperty('latestAchievement');
    expect(glanceAt(62, 'stuntman').latestAchievement?.title).toBe('Stunt Double');
  });
});
