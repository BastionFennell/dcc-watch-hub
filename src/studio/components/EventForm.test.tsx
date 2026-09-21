// @vitest-environment jsdom
/**
 * T1019 - the form's behaviour around the fields: defaults, the sticky actor,
 * the time row, why Save is off, the two save keys, and edit mode.
 *
 * The numbers quoted here are the fixture's own (see `defaults.test.ts`): Harry
 * is on 4/22 at t = 100, X.O. is level 1 at t = 60, and the Psychic holds
 * "Second Sight" at rank 2, so the next rank the form offers is 3.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeEpisodeRaw, makeRegistry, makeSpells } from '../../test/fixtures';
import type { DraftEvent, DraftMeta, RawEvent } from '../draft';
import { draftFromEpisode } from '../draft';
import type { StudioRegistries } from '../options';
import { studioCopy } from '../copy';
import { EventForm } from './EventForm';

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

interface Opened {
  onSave: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

function open(
  options: { t?: number; lastActor?: string; lastType?: string; editing?: DraftEvent } = {},
): Opened {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <EventForm
      draft={draft}
      registries={registries}
      t={options.t ?? 200}
      lastActor={options.lastActor}
      lastType={options.lastType as never}
      editing={options.editing}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  return { onSave, onCancel };
}

function pick(type: string): void {
  fireEvent.click(screen.getByTestId('type-picker').querySelector(`[data-type="${type}"]`)!);
}

function field(key: string): HTMLInputElement {
  return screen.getByTestId(`field-${key}`) as HTMLInputElement;
}

function saved(onSave: ReturnType<typeof vi.fn>): RawEvent {
  return onSave.mock.calls[0][0] as RawEvent;
}

describe('EventForm - defaults (FR-1004)', () => {
  it('prefills hp from the crawler state at that second', () => {
    open({ t: 100, lastActor: 'harry' });
    pick('hp');
    expect(field('actor').value).toBe('harry');
    expect(field('current').value).toBe('4');
    expect(field('max').value).toBe('22');
  });

  it('prefills the next level on a level up', () => {
    open({ t: 60, lastActor: 'xo' });
    pick('level_up');
    expect(field('level').value).toBe('2');
  });

  it('prefills the mana pool the crawler already has', () => {
    open({ t: 175, lastActor: 'psychic' });
    pick('mana');
    expect(field('max').value).toBe('5');
    expect(field('current').value).not.toBe('');
  });

  it('offers the next rank for a spell the crawler already holds', () => {
    open({ t: 100, lastActor: 'psychic' });
    pick('spell');
    expect(field('rank').value).toBe('');
    fireEvent.change(field('name'), { target: { value: 'Second Sight' } });
    expect(field('rank').value).toBe('3');
  });

  it('never clobbers a value the author has already edited', () => {
    open({ t: 100, lastActor: 'harry' });
    pick('hp');
    fireEvent.change(field('current'), { target: { value: '9' } });
    // Changing the crawler re-runs the defaults; the edited field stands.
    fireEvent.change(field('actor'), { target: { value: 'xo' } });
    expect(field('current').value).toBe('9');
    expect(field('max').value).not.toBe('22');
  });

  it('keeps the last actor across events (FR-1003)', () => {
    open({ lastActor: 'harry' });
    pick('loot');
    expect(field('actor').value).toBe('harry');
  });

  it('leaves the crawler blank on an entity beat', () => {
    open({ lastActor: 'harry' });
    pick('npc');
    expect(field('actor').value).toBe('');
    expect(field('action').value).toBe('met');
  });
});

describe('EventForm - the time row (FR-1005)', () => {
  it('opens at the playhead and nudges by a second', () => {
    open({ t: 200 });
    pick('note');
    const time = screen.getByTestId('event-time') as HTMLInputElement;
    expect(time.value).toBe('3:20');
    fireEvent.click(screen.getByTestId('nudge-back'));
    expect(time.value).toBe('3:19');
    fireEvent.click(screen.getByTestId('nudge-forward'));
    fireEvent.click(screen.getByTestId('nudge-forward'));
    expect(time.value).toBe('3:21');
  });

  it('parses what the author types and saves the seconds', () => {
    const { onSave } = open({ t: 200 });
    pick('note');
    fireEvent.change(field('text'), { target: { value: 'A beat' } });
    fireEvent.change(screen.getByTestId('event-time'), { target: { value: '3:45' } });
    fireEvent.click(screen.getByTestId('save-event'));
    expect(saved(onSave)).toEqual({ t: 225, type: 'note', text: 'A beat' });
  });

  it('clamps a time past the end of the video', () => {
    const { onSave } = open({ t: 200 });
    pick('note');
    fireEvent.change(field('text'), { target: { value: 'A beat' } });
    fireEvent.change(screen.getByTestId('event-time'), { target: { value: '9:99' } });
    // "9:99" is not a time at all: the field says so and Save stays off.
    expect(screen.getByTestId('save-event')).toBeDisabled();
    fireEvent.change(screen.getByTestId('event-time'), { target: { value: '5:00' } });
    fireEvent.click(screen.getByTestId('save-event'));
    expect(saved(onSave).t).toBe(240);
  });

  it('returns the time to the playhead', () => {
    open({ t: 200 });
    pick('note');
    const time = screen.getByTestId('event-time') as HTMLInputElement;
    fireEvent.change(time, { target: { value: '1:00' } });
    fireEvent.click(screen.getByTestId('set-to-playhead'));
    expect(time.value).toBe('3:20');
  });

  it('refuses a time it cannot read', () => {
    open();
    pick('note');
    fireEvent.change(field('text'), { target: { value: 'A beat' } });
    fireEvent.change(screen.getByTestId('event-time'), { target: { value: 'soon' } });
    expect(screen.getByTestId('event-time')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('save-event')).toBeDisabled();
    expect(screen.getByTestId('save-reason')).toHaveTextContent(studioCopy.form.reasonTime);
  });
});

describe('EventForm - why Save is off', () => {
  it('asks for a type before anything else', () => {
    open();
    expect(screen.getByTestId('save-event')).toBeDisabled();
    expect(screen.getByTestId('save-reason')).toHaveTextContent(studioCopy.form.reasonPickType);
  });

  it('names the required field that is empty', () => {
    open({ lastActor: 'harry' });
    pick('loot');
    expect(screen.getByTestId('save-event')).toBeDisabled();
    expect(screen.getByTestId('save-reason')).toHaveTextContent('Item');
    expect(screen.getByTestId('error-item')).toHaveTextContent(studioCopy.fields.required);
    fireEvent.change(field('item'), { target: { value: 'Crowbar' } });
    expect(screen.getByTestId('save-event')).not.toBeDisabled();
  });

  it('asks for one of the pair a spell needs (requireOneOf)', () => {
    open({ lastActor: 'harry' });
    pick('spell');
    expect(screen.getByTestId('save-event')).toBeDisabled();
    expect(screen.getByTestId('save-reason')).toHaveTextContent('Name or Registry spell');
    fireEvent.change(field('name'), { target: { value: 'Torch Spark' } });
    expect(screen.getByTestId('save-event')).not.toBeDisabled();
  });

  it('offers the custom-name escape beside the registry picker', () => {
    open({ lastActor: 'harry' });
    pick('spell');
    fireEvent.change(field('ref'), { target: { value: 'heal' } });
    fireEvent.click(screen.getByTestId('spell-custom-name'));
    expect(field('ref').value).toBe('');
    expect(document.activeElement).toBe(field('name'));
  });
});

describe('EventForm - keyboard (FR-1002)', () => {
  it('saves on Cmd+Enter and saves-and-resumes on Shift+Cmd+Enter', () => {
    const { onSave } = open({ t: 200 });
    pick('note');
    fireEvent.change(field('text'), { target: { value: 'A beat' } });
    fireEvent.keyDown(screen.getByTestId('event-form'), { key: 'Enter', metaKey: true });
    expect(onSave).toHaveBeenCalledWith({ t: 200, type: 'note', text: 'A beat' }, { resume: false });

    fireEvent.keyDown(screen.getByTestId('event-form'), {
      key: 'Enter',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(onSave).toHaveBeenLastCalledWith(expect.anything(), { resume: true });
  });

  it('does not save an invalid event from the keyboard', () => {
    const { onSave } = open();
    pick('loot');
    fireEvent.keyDown(screen.getByTestId('event-form'), { key: 'Enter', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels on Escape', () => {
    const { onCancel } = open();
    pick('note');
    fireEvent.keyDown(screen.getByTestId('event-form'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('opens with focus in the type filter, and moves it into the fields', () => {
    open();
    expect(document.activeElement).toBe(screen.getByTestId('type-filter'));
    pick('note');
    expect(document.activeElement).toBe(field('text'));
  });
});

describe('EventForm - edit mode (US2)', () => {
  const editing = draft.events.find((entry) => entry.event.type === 'loot') as DraftEvent;

  it('opens on the event own values, with focus on the first field', () => {
    open({ editing, t: 200 });
    expect(screen.queryByTestId('type-picker')).toBeNull();
    expect(screen.getByTestId('event-form-type')).toHaveTextContent('Loot');
    expect(field('item').value).toBe(editing.event.item as string);
    expect(screen.getByTestId('event-time')).toHaveValue('0:30');
    expect(document.activeElement).toBe(field('actor'));
  });

  it('changes the type and keeps the values the new type also has', () => {
    const { onSave } = open({ editing, t: 200 });
    const actor = field('actor').value;
    fireEvent.click(screen.getByTestId('change-type'));
    fireEvent.click(screen.getByTestId('type-picker').querySelector('[data-type="achievement"]')!);
    expect(field('actor').value).toBe(actor);
    expect(screen.queryByTestId('field-item')).toBeNull();
    fireEvent.change(field('title'), { target: { value: 'Well Read' } });
    fireEvent.click(screen.getByTestId('save-event'));
    expect(saved(onSave)).toEqual({
      t: editing.event.t,
      type: 'achievement',
      actor,
      title: 'Well Read',
    });
  });
});

describe('EventForm - the feed line', () => {
  it('reads the row the viewer would file, and follows every edit', () => {
    open({ t: 200, lastActor: 'harry' });
    expect(screen.getByTestId('feed-line')).toHaveTextContent(studioCopy.form.previewEmpty);
    pick('loot');
    fireEvent.change(field('item'), { target: { value: 'Crowbar' } });
    expect(screen.getByTestId('feed-line')).toHaveTextContent('Crowbar');
    fireEvent.change(field('item'), { target: { value: 'Torch' } });
    expect(screen.getByTestId('feed-line')).toHaveTextContent('Torch');
    expect(screen.getByTestId('feed-line')).not.toHaveTextContent('Crowbar');
  });
});
