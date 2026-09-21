// @vitest-environment jsdom
/**
 * T1027 - the editor's shell: the narrow-screen notice, an id with no draft,
 * what the page keys do while the form is open, and Cmd/Ctrl+S.
 *
 * The event authoring itself is covered end to end in `studio.e2e.test.tsx`;
 * this is about the frame around it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { __fakeSources } from '../../components/VideoStage/FakeStage';
import { makeEpisodeRaw } from '../../test/fixtures';
import type { DraftMeta, StudioDraft } from '../draft';
import { draftFromEpisode } from '../draft';
import { saveDraft } from '../storage';
import { studioCopy } from '../copy';
import { StudioEpisodePage } from './StudioEpisodePage';

/*
 * The shield only exists over a real embedded player, so those tests mount the
 * page *without* `?fake=1`. The IFrame API never loads here: `loadYouTubeApi` is
 * mocked with the same kind of player double `YouTubeTimeSource.test.ts` uses,
 * which is enough to prove the shield drives the transport.
 */
const { players, api } = vi.hoisted(() => {
  interface PlayerEvents {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
  }

  const players: {
    events: PlayerEvents;
    calls: string[];
    state: number;
  }[] = [];

  class PlayerMock {
    events: PlayerEvents;
    calls: string[] = [];
    state = -1;

    constructor(_host: unknown, opts: { events: PlayerEvents }) {
      this.events = opts.events;
      players.push(this);
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
      return 600;
    }

    setPlaybackRate(): void {}
    getPlaybackRate(): number {
      return 1;
    }
    getCurrentTime(): number {
      return 0;
    }
    seekTo(): void {}
    destroy(): void {}
  }

  return { players, api: { Player: PlayerMock } };
});

vi.mock('../../playback/loadYouTubeApi', () => ({
  loadYouTubeApi: () => Promise.resolve(api),
}));

/** Mounts on the YouTube host and gets its player to `onReady`. */
async function mountEmbedded() {
  players.length = 0;
  mount('/studio/ep/1');
  await waitFor(() => expect(screen.getByTestId('youtube-stage')).toBeInTheDocument());
  await waitFor(() => expect(players.length).toBe(1));
  await act(async () => {
    players[0].events.onReady();
  });
  return players[0];
}

const META: DraftMeta = {
  id: 1,
  title: 'The Stairs Down',
  youtubeId: 'dQw4w9WgXcQ',
  floor: 6,
  durationSec: 600,
};

function seed(): StudioDraft {
  const draft: StudioDraft = { ...draftFromEpisode(META, makeEpisodeRaw(1)), events: [] };
  saveDraft(draft);
  return draft;
}

function mount(entry = '/studio/ep/1?fake=1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/studio/ep/:id" element={<StudioEpisodePage />} />
        <Route path="/studio" element={<p>drafts</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** jsdom has no matchMedia; the page treats "unknown" as wide (FR-1012). */
function withWidth(wide: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

describe('StudioEpisodePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __fakeSources.length = 0;
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('offers to create an episode the browser has no draft for', async () => {
    mount('/studio/ep/7?fake=1');
    await waitFor(() => expect(screen.getByTestId('studio-unknown')).toBeInTheDocument());
    expect(screen.getByTestId('create-missing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('create-missing'));
    await waitFor(() => expect(screen.getByTestId('new-episode-dialog')).toBeInTheDocument());
    // The number is prefilled from the URL: "there is no draft for 7, make it".
    expect(screen.getByTestId('new-number')).toHaveValue('7');
  });

  it('shows the wider-screen notice instead of the editor below 1000 px', async () => {
    seed();
    withWidth(false);
    mount();
    await waitFor(() => expect(screen.getByTestId('too-narrow')).toBeInTheDocument());
    expect(screen.queryByTestId('studio-timeline')).not.toBeInTheDocument();
    // The header is still there: saving and exporting still work at any width.
    expect(screen.getByTestId('studio-title')).toBeInTheDocument();
  });

  it('turns the page keys off while the form is open, except undo and redo', async () => {
    seed();
    mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'e' });
    await waitFor(() => expect(screen.getByTestId('event-form')).toBeInTheDocument());

    // E again would be a second add; while the form is open it does nothing.
    fireEvent.keyDown(document, { key: 'e' });
    expect(screen.getAllByTestId('event-form')).toHaveLength(1);
    expect(screen.getByText(/only undo, redo and save still fire/)).toBeInTheDocument();

    // Escape belongs to the form, and closing returns focus to the Add button.
    fireEvent.keyDown(screen.getByTestId('event-form'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('event-form')).not.toBeInTheDocument());
  });

  it('Cmd/Ctrl+S exports without a folder picked', async () => {
    seed();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // jsdom has no object URLs.
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: () => 'blob:studio',
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: () => {},
    });

    mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 's', metaKey: true });
    await waitFor(() => expect(screen.getByTestId('export-notice')).toBeInTheDocument());
    expect(screen.getByTestId('export-notice')).toHaveTextContent('ep1.json');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('counts the draft issues on the Issues tab', async () => {
    const draft = draftFromEpisode({ ...META, youtubeId: '' }, makeEpisodeRaw(1));
    saveDraft({ ...draft, events: [{ uid: 'bad', event: { t: 5000, type: 'note', text: 'x' } }] });
    mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());

    // No video id (error) and an event past the end of the video (error).
    const badge = screen.getByTestId('issues-badge');
    expect(badge).toHaveAttribute('data-tone', 'error');

    fireEvent.click(screen.getByTestId('tab-issues'));
    await waitFor(() => expect(screen.getByTestId('issues-panel')).toBeInTheDocument());
    expect(screen.getAllByTestId('issue').length).toBeGreaterThan(1);
  });
});

describe('StudioEpisodePage - the focus shield over an embedded player', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __fakeSources.length = 0;
    seed();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('covers the iframe and plays or pauses when it is clicked', async () => {
    const player = await mountEmbedded();
    const shield = screen.getByTestId('video-shield');
    // Nothing for assistive tech to reach: the transport bar owns this action.
    expect(shield).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(shield);
    expect(player.calls).toContain('playVideo');
    fireEvent.click(shield);
    expect(player.calls).toContain('pauseVideo');
  });

  it('unlocks the video controls, and locks them again', async () => {
    await mountEmbedded();
    const toggle = screen.getByTestId('video-lock');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent(studioCopy.transport.videoLocked);
    expect(screen.queryByTestId('video-lock-hint')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent(studioCopy.transport.videoUnlocked);
    // No shield: the author has YouTube's own controls, and the hint says what
    // that costs them.
    expect(screen.queryByTestId('video-shield')).toBeNull();
    expect(screen.getByTestId('video-lock-hint')).toHaveTextContent(
      studioCopy.transport.videoUnlockHint,
    );

    fireEvent.click(toggle);
    expect(screen.getByTestId('video-shield')).toBeInTheDocument();
  });

  it('takes the keyboard back when Tab lands inside the iframe', async () => {
    await mountEmbedded();
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    frame.focus();
    expect(document.activeElement).toBe(frame);

    fireEvent.blur(window);
    expect(document.activeElement).toBe(screen.getByTestId('add-event'));
    frame.remove();
  });

  it('leaves the dev stage alone: its own controls are inside the box', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());
    expect(screen.queryByTestId('video-shield')).toBeNull();
    expect(screen.queryByTestId('video-lock')).toBeNull();
  });
});
