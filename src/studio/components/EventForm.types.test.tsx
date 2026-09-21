// @vitest-environment jsdom
/**
 * T1019 - every event type can be authored through the form (FR-1003).
 *
 * The table drives the test the same way it drives the UI: for each member of
 * `KNOWN_EVENT_TYPES` the form is opened, every field of that type is filled by
 * its kind, and the saved event is compared with what `buildEvent` would have
 * produced from the same values. If the two ever disagree, the form has grown a
 * rule of its own - which is the thing this feature must not have.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KNOWN_EVENT_TYPES } from '../../data/types';
import { normalizeEvent } from '../../data/validate';
import { makeEpisodeRaw, makeRegistry, makeSpells } from '../../test/fixtures';
import { buildEvent } from '../buildEvent';
import type { DraftMeta, RawEvent } from '../draft';
import { draftFromEpisode } from '../draft';
import type { FieldSpec, FieldValues } from '../eventForms';
import { EVENT_FORMS } from '../eventForms';
import type { StudioRegistries } from '../options';
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
const T = 200;

/** Fills one field the way its kind is edited, and records what was entered. */
function fill(field: FieldSpec, entered: FieldValues): void {
  const control = screen.queryByTestId(`field-${field.key}`);
  if (control === null) return;

  switch (field.kind) {
    case 'actor':
    case 'select':
    case 'slot':
    case 'chapterKind':
    case 'npcRef':
    case 'spellRef': {
      const select = control as HTMLSelectElement;
      const option = Array.from(select.options).find((candidate) => candidate.value !== '');
      if (option === undefined) return;
      fireEvent.change(select, { target: { value: option.value } });
      entered[field.key] = option.value;
      return;
    }
    case 'text':
    case 'longtext':
    case 'room': {
      const text = `${field.key} value`;
      fireEvent.change(control, { target: { value: text } });
      entered[field.key] = text;
      return;
    }
    case 'int': {
      const value = String(Math.max(field.min ?? 1, 1) + 1);
      fireEvent.change(control, { target: { value } });
      entered[field.key] = value;
      return;
    }
    case 'bool': {
      fireEvent.click(control);
      entered[field.key] = true;
      return;
    }
    case 'entryAdd': {
      fireEvent.change(control, { target: { value: 'one' } });
      fireEvent.keyDown(control, { key: 'Enter' });
      entered[field.key] = ['one'];
      return;
    }
    case 'entryRemove':
    case 'factRefs': {
      const boxes = within(control).queryAllByRole('checkbox');
      if (boxes.length === 0) return;
      fireEvent.click(boxes[0]);
      entered[field.key] = [(boxes[0] as HTMLInputElement).value];
      return;
    }
    case 'cells': {
      fireEvent.change(control, { target: { value: '3, 4' } });
      fireEvent.keyDown(control, { key: 'Enter' });
      entered[field.key] = [[3, 4]];
      return;
    }
  }
}

describe('EventForm - every event type (T1019, FR-1003)', () => {
  for (const type of KNOWN_EVENT_TYPES) {
    it(`authors a ${type} event that matches buildEvent`, () => {
      const onSave = vi.fn();
      render(
        <EventForm
          draft={draft}
          registries={registries}
          t={T}
          onSave={onSave}
          onCancel={() => undefined}
        />,
      );

      // The add form opens on the grid: pick the type, then fill its fields.
      fireEvent.click(screen.getByTestId('type-picker').querySelector(`[data-type="${type}"]`)!);

      const entered: FieldValues = {};
      for (const field of EVENT_FORMS[type].fields) fill(field, entered);

      fireEvent.click(screen.getByTestId('save-event'));

      expect(onSave).toHaveBeenCalledTimes(1);
      const [event, opts] = onSave.mock.calls[0] as [RawEvent, { resume: boolean }];
      expect(opts).toEqual({ resume: false });
      expect(event).toEqual(buildEvent(type, T, entered));
      expect(event.t).toBe(T);
      // The point of the whole exercise: the viewer keeps the row.
      expect(normalizeEvent(event).type).toBe(type);
    });
  }
});
