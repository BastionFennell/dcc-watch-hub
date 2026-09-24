// @vitest-environment jsdom
/**
 * T1019 - the preview (T1017, US3).
 *
 * What matters here is that it is the *viewer's* rail and feed, computed by the
 * viewer's reducer from the draft: a row the preview shows is a row the episode
 * will show. The read-only part matters too - a preview row promises no panel,
 * so it is not a button.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { makeEpisodeRaw, makeRegistry, makeSpells } from '../../test/fixtures';
import { studioCopy } from '../copy';
import type { DraftMeta, StudioDraft } from '../draft';
import { draftFromEpisode } from '../draft';
import type { StudioRegistries } from '../options';
import { PreviewPane } from './PreviewPane';

afterEach(cleanup);

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

const draft = draftFromEpisode(META, makeEpisodeRaw());
const registries: StudioRegistries = { npcs: makeRegistry(), spells: makeSpells() };

describe('PreviewPane (T1017)', () => {
  it('shows the party and the feed the viewer would show', () => {
    render(<PreviewPane draft={draft} registries={registries} t={200} />);
    expect(screen.getAllByTestId('crawler-frame').length).toBe(5);
    expect(screen.getAllByTestId('feed-item').length).toBeGreaterThan(0);
  });

  it('follows the draft', () => {
    const { rerender } = render(<PreviewPane draft={draft} registries={registries} t={200} />);
    expect(screen.queryByText('Fresh beat')).toBeNull();

    const edited: StudioDraft = {
      ...draft,
      events: [...draft.events, { uid: 'fresh', event: { t: 199, type: 'note', text: 'Fresh beat' } }],
    };
    rerender(<PreviewPane draft={edited} registries={registries} t={200} />);
    expect(screen.getByText('Fresh beat')).toBeInTheDocument();
  });

  it('follows the playhead', () => {
    const { rerender } = render(<PreviewPane draft={draft} registries={registries} t={10} />);
    const early = screen.queryAllByTestId('feed-item').length;
    rerender(<PreviewPane draft={draft} registries={registries} t={200} />);
    expect(screen.getAllByTestId('feed-item').length).toBeGreaterThan(early);
  });

  it('is read only: no row is a control', () => {
    render(<PreviewPane draft={draft} registries={registries} t={200} />);
    for (const row of screen.getAllByTestId('feed-item')) {
      expect(within(row).queryByRole('button')).toBeNull();
    }
  });

  it('collapses behind its header', () => {
    render(<PreviewPane draft={draft} registries={registries} t={200} />);
    const toggle = screen.getByTestId('preview-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByTestId('crawler-frame')[0]).not.toBeVisible();
  });

  it('says plainly when the draft cannot be normalized', () => {
    const broken: StudioDraft = { ...draft, initialState: 'not a state' };
    render(<PreviewPane draft={broken} t={200} />);
    expect(screen.getByTestId('preview-unavailable')).toHaveTextContent(
      studioCopy.preview.unavailable,
    );
    expect(screen.queryByTestId('crawler-frame')).toBeNull();
  });
});
