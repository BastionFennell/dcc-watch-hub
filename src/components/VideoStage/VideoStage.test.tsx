// @vitest-environment jsdom
/**
 * T603 — the mini stage (006 T602, FR-500/FR-501/FR-505).
 *
 * The stage runs on the dev host (`?fake=1`) so no network is involved. The
 * load-bearing claim is the *absence* of a remount: docking must move the same
 * nodes, because re-parenting the host player would reload it (constitution II,
 * research R1).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { EpisodeMeta } from '../../data/types';
import { copy } from '../../copy';
import { VideoStage } from './VideoStage';

const META: EpisodeMeta = {
  id: 1,
  title: 'Episode 1 — The World Dungeon',
  youtubeId: 'M7lc1UVf-VE',
  floor: 1,
  durationSec: 240,
  dataUrl: '/data/ep1.json',
};

interface Options {
  mini?: boolean;
  hideBadge?: boolean;
  onExitMini?: () => void;
  children?: ReactNode;
}

function mount({ mini, hideBadge, onExitMini, children }: Options = {}) {
  const view = render(
    <MemoryRouter initialEntries={['/ep/1?fake=1']}>
      <VideoStage
        meta={META}
        t={0}
        onSource={() => {}}
        mini={mini}
        hideBadge={hideBadge}
        onExitMini={onExitMini}
      >
        {children}
      </VideoStage>
    </MemoryRouter>,
  );
  const rerender = (next: Options = {}) =>
    view.rerender(
      <MemoryRouter initialEntries={['/ep/1?fake=1']}>
        <VideoStage
          meta={META}
          t={0}
          onSource={() => {}}
          mini={next.mini}
          hideBadge={next.hideBadge}
          onExitMini={next.onExitMini}
        >
          {next.children}
        </VideoStage>
      </MemoryRouter>,
    );
  return { ...view, rerender };
}

const slot = () => screen.getByTestId('stage-slot');
const stage = () => screen.getByTestId('video-stage');

afterEach(cleanup);

describe('VideoStage', () => {
  it('renders the stage inside a slot that a placeholder holds open', () => {
    mount();

    const placeholder = screen.getByTestId('stage-placeholder');
    expect(slot()).toContainElement(placeholder);
    expect(slot()).toContainElement(stage());
    // The placeholder is the stage's sibling, and it comes first: the stage
    // sits on top of it, so leaving the flow cannot change the slot's height.
    expect(placeholder.parentElement).toBe(slot());
    expect(placeholder.nextElementSibling).toBe(stage());
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('is the plain desktop stage when mini is falsy (FR-505)', () => {
    mount({ children: <span data-testid="overlay" /> });

    expect(slot()).not.toHaveAttribute('data-mini');
    expect(slot()).not.toHaveAttribute('data-hide-badge');
    expect(stage()).toHaveAttribute('data-host', 'fake');
    expect(screen.getByTestId('fake-stage')).toBeInTheDocument();
    expect(within(stage()).getByTestId('overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('mini-return')).toBeNull();
  });

  it('marks the slot when it docks, and keeps the placeholder', () => {
    const { rerender } = mount();
    expect(slot()).not.toHaveAttribute('data-mini');

    rerender({ mini: true });
    expect(slot()).toHaveAttribute('data-mini', 'true');
    expect(screen.getByTestId('stage-placeholder')).toBeInTheDocument();

    rerender({ mini: false });
    expect(slot()).not.toHaveAttribute('data-mini');
  });

  it('docks the same nodes — no remount, so the host never reloads (FR-500)', () => {
    const { rerender } = mount();
    const before = stage();
    const player = screen.getByTestId('fake-stage');
    const placeholder = screen.getByTestId('stage-placeholder');

    rerender({ mini: true });

    expect(stage()).toBe(before);
    expect(screen.getByTestId('fake-stage')).toBe(player);
    expect(stage().parentElement).toBe(slot());
    expect(screen.getByTestId('stage-placeholder')).toBe(placeholder);

    rerender({ mini: false });
    expect(stage()).toBe(before);
    expect(screen.getByTestId('fake-stage')).toBe(player);
  });

  it('offers the way back to the full stage, in the System’s voice (FR-501)', () => {
    const onExitMini = vi.fn();
    mount({ mini: true, onExitMini });

    const button = screen.getByTestId('mini-return');
    expect(button).toHaveTextContent(copy.miniReturn);
    expect(button).toHaveAccessibleName(copy.miniReturn);
    // Inside the frame, under the picture — the one part of it that is ours.
    expect(stage()).toContainElement(button);

    fireEvent.click(button);
    expect(onExitMini).toHaveBeenCalledTimes(1);
  });

  it('keeps the overlays the page hands it while docked (US1 scenario 3)', () => {
    mount({ mini: true, children: <div data-testid="achievement-toast">Achievement</div> });

    expect(within(stage()).getByTestId('achievement-toast')).toBeInTheDocument();
  });

  it('surfaces hideBadge on the root for the page and the stylesheet', () => {
    const { rerender } = mount({ hideBadge: true });
    expect(slot()).toHaveAttribute('data-hide-badge', 'true');

    rerender({ hideBadge: false });
    expect(slot()).not.toHaveAttribute('data-hide-badge');
  });
});
