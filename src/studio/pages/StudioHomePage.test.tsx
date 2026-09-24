// @vitest-environment jsdom
/**
 * T1025 - the drafts list: what is in this browser, deleting one, and starting
 * a new episode through the dialog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { makeEpisodeRaw } from '../../test/fixtures';
import { draftFromEpisode } from '../draft';
import { listDrafts, saveDraft } from '../storage';
import { StudioHomePage } from './StudioHomePage';

function seed(id: number, title: string): void {
  saveDraft(
    draftFromEpisode(
      { id, title, youtubeId: 'dQw4w9WgXcQ', floor: 6, durationSec: 600 },
      makeEpisodeRaw(id),
    ),
  );
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/studio']}>
      <Routes>
        <Route path="/studio" element={<StudioHomePage />} />
        <Route path="/studio/ep/:id" element={<p data-testid="editor">editor</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudioHomePage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('says so when there are no drafts', () => {
    mount();
    expect(screen.getByTestId('drafts-empty')).toBeInTheDocument();
  });

  it('lists the drafts in this browser and deletes one after a confirm', async () => {
    seed(1, 'The Stairs Down');
    seed(2, 'The Landing');
    mount();
    expect(screen.getAllByTestId('draft-row')).toHaveLength(2);

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getAllByTestId('delete-draft')[0]);
    expect(screen.getAllByTestId('draft-row')).toHaveLength(2);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getAllByTestId('delete-draft')[0]);
    await waitFor(() => expect(screen.getAllByTestId('draft-row')).toHaveLength(1));
    expect(listDrafts()).toHaveLength(1);
  });

  it('creates an episode through the dialog and opens the editor', async () => {
    mount();
    fireEvent.click(screen.getByTestId('new-episode'));
    await waitFor(() => expect(screen.getByTestId('new-episode-dialog')).toBeInTheDocument());

    // A title is required; the number defaults to one past the last draft.
    expect(screen.getByTestId('new-number')).toHaveValue('1');
    fireEvent.change(screen.getByTestId('new-title'), { target: { value: 'Pilot' } });
    fireEvent.change(screen.getByTestId('new-video'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s' },
    });
    // Only the id reaches the draft, whatever the author pasted.
    expect(screen.getByTestId('new-video-ok')).toHaveTextContent('dQw4w9WgXcQ');

    fireEvent.click(screen.getByTestId('new-create'));
    await waitFor(() => expect(screen.getByTestId('editor')).toBeInTheDocument());

    const stored = listDrafts();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 1, title: 'Pilot', events: 0 });
  });

  it('refuses a number that already has a draft', async () => {
    seed(3, 'The Stairs Down');
    mount();
    fireEvent.click(screen.getByTestId('new-episode'));
    await waitFor(() => expect(screen.getByTestId('new-episode-dialog')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('new-number'), { target: { value: '3' } });
    expect(screen.getByTestId('new-number-taken')).toBeInTheDocument();
  });
});
