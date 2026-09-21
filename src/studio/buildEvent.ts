/**
 * Form values <-> raw event (010, T1009).
 *
 * `buildEvent` is the only place a Studio form turns into episode JSON, and
 * `eventToValues` is its inverse, used to reopen an event for editing. Between
 * them they own two rules the exported file depends on: numbers are numbers
 * (never the strings an input gives back), and an optional field the author
 * left blank is *absent*, not `""` or `null`.
 */
import type { EventType } from '../data/types';
import type { RawEvent } from './draft';
import type { FieldKind, FieldSpec, FieldValue, FieldValues } from './eventForms';
import { EVENT_FORMS, formFor } from './eventForms';

const LIST_KINDS: readonly FieldKind[] = ['entryAdd', 'entryRemove', 'factRefs'];

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = toStringOrUndefined(item);
    if (s !== undefined) out.push(s);
  }
  return out;
}

function toCells(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  const out: [number, number][] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const row = toNumberOrUndefined(item[0]);
    const col = toNumberOrUndefined(item[1]);
    if (row === undefined || col === undefined) continue;
    out.push([row, col]);
  }
  return out;
}

/** The JSON value for one field, or `undefined` when there is nothing to write. */
function fieldValue(field: FieldSpec, raw: FieldValue): unknown {
  if (field.kind === 'cells') {
    const cells = toCells(raw);
    return cells.length === 0 && field.required !== true ? undefined : cells;
  }
  if (LIST_KINDS.includes(field.kind)) {
    const list = toStringList(raw);
    return list.length === 0 && field.required !== true ? undefined : list;
  }
  if (field.kind === 'int') return toNumberOrUndefined(raw);
  if (field.kind === 'bool') {
    if (raw === true) return true;
    // `false` is only worth writing when the field is not allowed to be absent.
    return field.required === true ? false : undefined;
  }
  return toStringOrUndefined(raw);
}

/**
 * A raw event of `type` at `t`. Fields are written in table order, which is
 * also the exporter's key order, so a built event needs no reshuffling.
 *
 * A required field the author has not filled is simply absent: the issues list
 * (`validateDraft`) is what tells them, not a silently invented value.
 */
export function buildEvent(type: EventType, t: number, values: FieldValues = {}): RawEvent {
  const event: RawEvent = { t, type };
  for (const field of EVENT_FORMS[type].fields) {
    const value = fieldValue(field, values[field.key]);
    if (value === undefined) continue;
    event[field.key] = value;
  }
  return event;
}

/** The form values behind an event. `t` and `type` are the form's own state. */
export function eventToValues(event: RawEvent): FieldValues {
  const form = formFor(event.type);
  const values: FieldValues = {};

  if (form === undefined) {
    // A type from a later schema: hand back whatever it carries, so the editor
    // can at least show it without inventing a shape for it.
    for (const [key, value] of Object.entries(event)) {
      if (key === 't' || key === 'type') continue;
      values[key] = value as FieldValue;
    }
    return values;
  }

  for (const field of form.fields) {
    const raw = event[field.key];
    if (raw === undefined || raw === null) continue;
    if (field.kind === 'cells') {
      values[field.key] = toCells(raw);
      continue;
    }
    if (LIST_KINDS.includes(field.kind)) {
      values[field.key] = toStringList(raw);
      continue;
    }
    if (field.kind === 'int') {
      const n = toNumberOrUndefined(raw);
      if (n !== undefined) values[field.key] = n;
      continue;
    }
    if (field.kind === 'bool') {
      values[field.key] = raw === true;
      continue;
    }
    const s = toStringOrUndefined(raw);
    if (s !== undefined) values[field.key] = s;
  }
  return values;
}
