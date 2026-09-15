import { describe, expect, it } from 'vitest';
import {
  activeSponsor,
  activeToast,
  elapsed,
  feedItems,
  mapCells,
  partyFrames,
  stageCaption,
  timelineMarkers,
} from './selectors';
import { reduceTo } from './reducer';
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
    expect(items.some((i) => i.t === 100)).toBe(false);
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
