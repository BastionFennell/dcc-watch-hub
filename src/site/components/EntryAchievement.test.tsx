// @vitest-environment jsdom
/**
 * The entry achievement (011 R2): the System's own announcement, standing
 * still. Kicker, title, verbatim text, then whichever half of the payout the
 * author has - and the reward paragraph under it when there is one.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EntryAchievement } from './EntryAchievement';
import { siteCopy } from '../copy';
import { makeCrawlers } from '../../test/fixtures';
import type { CrawlerEntryAchievement } from '../../data/types';

const full = makeCrawlers().crawlers[0].entryAchievement as CrawlerEntryAchievement;

afterEach(cleanup);

describe('EntryAchievement', () => {
  it('announces it: kicker, title, text, payout, reward', () => {
    render(<EntryAchievement achievement={full} />);
    expect(screen.getByText(siteCopy.achievementKicker)).toBeInTheDocument();
    expect(screen.getByText(full.title)).toBeInTheDocument();
    expect(screen.getByText(full.text)).toBeInTheDocument();
    expect(screen.getByText('Reward: Golden Monster Box → Liquid Latex')).toBeInTheDocument();
    expect(screen.getByText(full.reward as string)).toBeInTheDocument();
  });

  it('prints only the halves of the payout it has', () => {
    const { rerender } = render(<EntryAchievement achievement={{ ...full, item: undefined }} />);
    expect(screen.getByText('Reward: Golden Monster Box')).toBeInTheDocument();

    rerender(<EntryAchievement achievement={{ ...full, box: undefined }} />);
    expect(screen.getByText('Reward: Liquid Latex')).toBeInTheDocument();
  });

  it('drops the payout line entirely when nothing was awarded', () => {
    render(
      <EntryAchievement
        achievement={{ title: full.title, text: full.text }}
      />,
    );
    expect(screen.queryByText(/^Reward:/)).toBeNull();
  });

  /* A page block, not a hub overlay: nothing here is on a timer (011 R2). */
  it('is not the hub toast', () => {
    render(<EntryAchievement achievement={full} />);
    expect(screen.queryByTestId('achievement-toast')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
