// @vitest-environment jsdom
/**
 * T1028 - the whole Studio, end to end, on the fake source.
 *
 * This is the feature's acceptance run in one test: open a draft, press E,
 * author three event types of three different groups without touching the
 * mouse for the form, retime one, duplicate one, delete one, undo twice, redo
 * once, prove the autosave by unmounting and remounting, then export and check
 * the file three ways - it validates against the 009 schema, `normalizeEpisode`
 * reads it back, and `reduceTo` over the export matches `reduceTo` over the
 * draft at every probe (constitution I and VII, "same truth").
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { normalizeEpisode } from '../data/validate';
import { reduceTo } from '../engine/reducer';
import { __fakeSources } from '../components/VideoStage/FakeStage';
import { makeEpisodeRaw } from '../test/fixtures';
import type { DraftMeta, StudioDraft } from './draft';
import { draftFromEpisode, toEpisodeData } from './draft';
import { toEpisodeJson } from './exporter';
import { loadDraft, saveDraft } from './storage';
import { StudioEpisodePage } from './pages/StudioEpisodePage';

const schemaPath = resolve(__dirname, '../../specs/009-mana/contracts/episode.schema.json');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateEpisode = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')) as object);

const META: DraftMeta = {
  id: 1,
  title: 'The Stairs Down',
  youtubeId: 'dQw4w9WgXcQ',
  floor: 6,
  durationSec: 600,
};

function seed(): StudioDraft {
  const base = draftFromEpisode(META, makeEpisodeRaw(1));
  // The party and the map come from the fixture; the log is the author's job.
  const draft: StudioDraft = { ...base, events: [] };
  saveDraft(draft);
  return draft;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/studio/ep/1?fake=1']}>
      <Routes>
        <Route path="/studio/ep/:id" element={<StudioEpisodePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The scrub strip is the only seek the test needs; it drives the fake source. */
function seek(seconds: number): void {
  fireEvent.change(screen.getByTestId('studio-scrub'), { target: { value: String(seconds) } });
}

function pressKey(key: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyDown(document, { key, ...init });
}

/** Filter the type grid and take the first match, exactly as the author would. */
function pickType(query: string): void {
  const filter = screen.getByTestId('type-filter');
  fireEvent.change(filter, { target: { value: query } });
  fireEvent.keyDown(filter, { key: 'Enter' });
}

/** Everything the form draws, so a label the preview also uses cannot collide. */
function form() {
  return within(screen.getByTestId('event-form'));
}

function saveForm(): void {
  fireEvent.keyDown(screen.getByTestId('event-form'), { key: 'Enter', metaKey: true });
}

function rowTexts(): string[] {
  return screen.queryAllByTestId('event-row').map((row) => row.textContent ?? '');
}

/** Each row as "Edit m:ss <sentence>" - the playhead's own chip left out. */
function rowLabels(): string[] {
  return screen
    .queryAllByTestId('event-row-open')
    .map((button) => button.getAttribute('aria-label') ?? '');
}

describe('The Studio, end to end', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __fakeSources.length = 0;
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('authors, edits, autosaves and exports an episode', async () => {
    seed();
    const first = mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());
    expect(screen.getByTestId('event-list-empty')).toBeInTheDocument();

    /* ---------------------------------------------- three events, by key */

    seek(60);
    pressKey('e');
    await waitFor(() => expect(screen.getByTestId('event-form')).toBeInTheDocument());
    pickType('note');
    fireEvent.change(form().getByLabelText(/^Note/), {
      target: { value: 'The stairwell goes quiet.' },
    });
    saveForm();
    await waitFor(() => expect(screen.queryByTestId('event-form')).not.toBeInTheDocument());

    seek(120);
    pressKey('e');
    await waitFor(() => expect(screen.getByTestId('event-form')).toBeInTheDocument());
    pickType('hp');
    fireEvent.change(form().getByLabelText(/^Crawler/), { target: { value: 'stuntman' } });
    fireEvent.change(form().getByLabelText(/^Current HP/), { target: { value: '9' } });
    fireEvent.change(form().getByLabelText(/^Max HP/), { target: { value: '24' } });
    saveForm();
    await waitFor(() => expect(screen.queryByTestId('event-form')).not.toBeInTheDocument());

    seek(180);
    pressKey('e');
    await waitFor(() => expect(screen.getByTestId('event-form')).toBeInTheDocument());
    pickType('chapter');
    fireEvent.change(form().getByLabelText(/^Chapter title/), { target: { value: 'The Landing' } });
    fireEvent.change(form().getByLabelText(/^Kind/), { target: { value: 'boss' } });
    saveForm();
    await waitFor(() => expect(screen.queryByTestId('event-form')).not.toBeInTheDocument());

    expect(rowTexts()).toHaveLength(3);
    expect(screen.getAllByTestId('studio-marker')).toHaveLength(3);
    // Two groups among the three events, so two colours on the strip.
    expect(
      new Set(screen.getAllByTestId('studio-marker').map((mark) => mark.dataset.group)),
    ).toEqual(new Set(['story', 'crawler']));

    /* ------------------------------------- retime, duplicate, delete */

    // A marker click selects without opening the form, which is what the
    // T / D / Delete keys act on.
    seek(200);
    fireEvent.click(screen.getAllByTestId('studio-marker')[0]);
    // Clicking a marker also seeks to that event; come back to the playhead.
    seek(200);
    pressKey('t');
    await waitFor(() => expect(rowTexts()[2]).toContain('3:20'));

    seek(240);
    fireEvent.click(screen.getAllByTestId('studio-marker')[0]);
    seek(240);
    pressKey('d');
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(4));

    fireEvent.click(screen.getAllByTestId('studio-marker')[0]);
    pressKey('Delete');
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(3));

    /* ------------------------------------------------------ undo, redo */

    pressKey('z', { metaKey: true });
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(4));
    pressKey('z', { metaKey: true });
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(3));
    pressKey('z', { metaKey: true, shiftKey: true });
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(4));

    const onScreen = rowLabels();

    /* -------------------------------------------------- the autosave */

    // Unmounting flushes whatever the debounce still held (FR-1008).
    first.unmount();
    const stored = loadDraft(1);
    expect(stored).not.toBeNull();
    expect(stored?.events).toHaveLength(4);

    __fakeSources.length = 0;
    mount();
    await waitFor(() => expect(screen.getByTestId('fake-stage')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId('event-row')).toHaveLength(4));
    expect(rowLabels()).toEqual(onScreen);

    /* ------------------------------------------------------ the export */

    const draft = stored as StudioDraft;
    const text = toEpisodeJson(draft);
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text) as unknown;

    expect(validateEpisode(parsed)).toBe(true);

    const exported = normalizeEpisode(parsed);
    const authored = normalizeEpisode(toEpisodeData(draft));
    expect(exported.events).toHaveLength(4);

    for (const probe of [0, 59, 60, 119, 121, 200, 240, 400, 600]) {
      expect(reduceTo(exported, probe)).toEqual(reduceTo(authored, probe));
    }

    // And the log really is the one the author placed: a note, an hp, a
    // chapter and the hp's duplicate.
    expect(exported.events.map((event) => event.type).sort()).toEqual([
      'chapter',
      'hp',
      'hp',
      'note',
    ]);
  });
});
