import { describe, expect, it } from 'vitest';
import { KNOWN_EVENT_TYPES } from '../data/types';
import {
  EVENT_FORMS,
  FIELD_GROUPS,
  eventTypeLabel,
  formFor,
  formsByGroup,
  isKnownEventType,
} from './eventForms';

describe('EVENT_FORMS', () => {
  it('covers every known event type, once', () => {
    expect(Object.keys(EVENT_FORMS).sort()).toEqual([...KNOWN_EVENT_TYPES].sort());
    for (const type of KNOWN_EVENT_TYPES) {
      expect(EVENT_FORMS[type].type, `${type} is filed under its own key`).toBe(type);
    }
  });

  it('gives every type a group the picker knows and a human label', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const form = EVENT_FORMS[type];
      expect(FIELD_GROUPS).toContain(form.group);
      expect(form.label.length).toBeGreaterThan(0);
      expect(form.label).not.toBe(type);
    }
  });

  it('never repeats a field key inside one form', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const keys = EVENT_FORMS[type].fields.map((field) => field.key);
      expect(new Set(keys).size, `${type} has unique field keys`).toBe(keys.length);
    }
  });

  it('never declares t or type as a field (the form owns both)', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      for (const field of EVENT_FORMS[type].fields) {
        expect(['t', 'type']).not.toContain(field.key);
      }
    }
  });

  it('puts the actor first wherever an event has one', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const fields = EVENT_FORMS[type].fields;
      const index = fields.findIndex((field) => field.key === 'actor');
      if (index === -1) continue;
      // `npc` is the one type whose actor is optional, so it sits at the end.
      expect(index === 0 || type === 'npc').toBe(true);
    }
  });

  it('only names requireOneOf keys the form actually has', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      const form = EVENT_FORMS[type];
      for (const key of form.requireOneOf ?? []) {
        expect(form.fields.some((field) => field.key === key)).toBe(true);
      }
    }
  });

  it('gives every select-like field its options', () => {
    for (const type of KNOWN_EVENT_TYPES) {
      for (const field of EVENT_FORMS[type].fields) {
        if (field.kind === 'select' || field.kind === 'slot' || field.kind === 'chapterKind') {
          expect(field.options ?? [], `${type}.${field.key}`).not.toHaveLength(0);
        }
      }
    }
  });
});

describe('formsByGroup', () => {
  it('lists every type exactly once, in group order', () => {
    const groups = formsByGroup();
    expect(groups.map((entry) => entry.group)).toEqual([...FIELD_GROUPS]);
    const types = groups.flatMap((entry) => entry.forms.map((form) => form.type));
    expect(types.sort()).toEqual([...KNOWN_EVENT_TYPES].sort());
    for (const group of groups) expect(group.forms.length).toBeGreaterThan(0);
  });
});

describe('lookups', () => {
  it('reads a form by type and shrugs at an unknown one', () => {
    expect(formFor('hp')?.label).toBe('HP');
    expect(formFor('future_type')).toBeUndefined();
    expect(isKnownEventType('hp')).toBe(true);
    expect(isKnownEventType('future_type')).toBe(false);
    expect(eventTypeLabel('future_type')).toBe('future_type');
  });
});
