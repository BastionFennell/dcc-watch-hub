// @vitest-environment jsdom
/**
 * T1003 - the transport extension on the production adapter (010).
 *
 * The IFrame API never loads here: `loadYouTubeApi` is mocked with a player
 * double that records the commands it is given, which is the only way to prove
 * that nothing is called before `onReady`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTransport } from './TimeSource';
import { YouTubeTimeSource } from './YouTubeTimeSource';

interface PlayerEvents {
  onReady: () => void;
  onStateChange: (event: { data: number }) => void;
  onError: (event: { data: number }) => void;
}

interface PlayerDouble {
  events: PlayerEvents;
  calls: string[];
  state: number;
  duration: number;
  rate: number;
  currentTime: number;
}

const { players, api } = vi.hoisted(() => {
  const players: PlayerDouble[] = [];

  class PlayerMock {
    events: PlayerEvents;
    calls: string[] = [];
    state = -1;
    duration = 0;
    rate = 1;
    currentTime = 0;

    constructor(_host: unknown, opts: { events: PlayerEvents }) {
      this.events = opts.events;
      players.push(this as unknown as PlayerDouble);
    }

    playVideo(): void {
      this.calls.push('playVideo');
      this.state = 1;
    }

    pauseVideo(): void {
      this.calls.push('pauseVideo');
      this.state = 2;
    }

    getPlayerState(): number {
      return this.state;
    }

    getDuration(): number {
      return this.duration;
    }

    setPlaybackRate(rate: number): void {
      this.calls.push(`setPlaybackRate:${rate}`);
      this.rate = rate;
    }

    getPlaybackRate(): number {
      return this.rate;
    }

    getCurrentTime(): number {
      return this.currentTime;
    }

    seekTo(t: number): void {
      this.calls.push(`seekTo:${t}`);
      this.currentTime = t;
    }

    destroy(): void {
      this.calls.push('destroy');
    }
  }

  return { players, api: { Player: PlayerMock } };
});

vi.mock('./loadYouTubeApi', () => ({
  loadYouTubeApi: () => Promise.resolve(api),
}));

/** Lets the adapter's `loadYouTubeApi().then(...)` run. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function mount(): Promise<{ source: YouTubeTimeSource; player: PlayerDouble }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const source = new YouTubeTimeSource(container, 'aqz-KE-bpKQ');
  await flush();
  return { source, player: players[players.length - 1] };
}

describe('YouTubeTimeSource transport (010)', () => {
  beforeEach(() => {
    players.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('satisfies the Transport type guard', async () => {
    const { source } = await mount();
    expect(hasTransport(source)).toBe(true);
    source.destroy();
  });

  it('sends no command to a player that is not ready', async () => {
    const { source, player } = await mount();
    source.play();
    source.pause();
    expect(player.calls).toEqual([]);
    expect(source.isPaused()).toBe(true);
    expect(source.getDuration()).toBeNull();
    source.destroy();
  });

  it('plays, pauses and reads the player state once ready', async () => {
    const { source, player } = await mount();
    player.events.onReady();

    source.play();
    expect(player.calls).toContain('playVideo');
    player.events.onStateChange({ data: 1 });
    expect(source.isPaused()).toBe(false);

    // Buffering is still "running": the author has not stopped the video.
    player.state = 3;
    expect(source.isPaused()).toBe(false);

    source.pause();
    expect(player.calls).toContain('pauseVideo');
    expect(source.isPaused()).toBe(true);
    source.destroy();
  });

  it('reports the duration, treating the host 0 as "not known yet"', async () => {
    const { source, player } = await mount();
    player.events.onReady();
    expect(source.getDuration()).toBeNull();
    player.duration = 635;
    expect(source.getDuration()).toBe(635);
    source.destroy();
    expect(source.getDuration()).toBeNull();
  });

  it('remembers a rate set before onReady and applies it there', async () => {
    const { source, player } = await mount();
    source.setRate(1.5);
    expect(player.calls).toEqual([]);
    expect(source.getRate()).toBe(1.5);

    player.events.onReady();
    expect(player.calls).toContain('setPlaybackRate:1.5');
    expect(source.getRate()).toBe(1.5);

    source.setRate(2);
    expect(player.rate).toBe(2);
    source.setRate(0);
    source.setRate(Number.NaN);
    expect(source.getRate()).toBe(2);
    source.destroy();
  });
});
