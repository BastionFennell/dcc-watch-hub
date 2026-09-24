/**
 * What every field widget is handed, and the three coercions they share.
 *
 * A field never looks anything up: the form passes the spec, the value, the
 * options (`optionsFor`) and the ids the label and the messages use. That keeps
 * `FieldInput` a pure switch and every widget testable on its own.
 */
import type { FieldKind, FieldSpec, FieldValue } from '../../eventForms';
import type { Option } from '../../options';

export interface FieldProps {
  field: FieldSpec;
  /** The control's DOM id - the form's `<label htmlFor>` points here. */
  id: string;
  value: FieldValue;
  onChange(value: FieldValue): void;
  /** `optionsFor(field, ctx)`. Empty is a normal state, not an error. */
  options: readonly Option[];
  /** Ids of the help and error text, for `aria-describedby`. */
  describedBy?: string;
  invalid?: boolean;
  /** The form focuses the first field when it opens, or when the type changes. */
  autoFocus?: boolean;
  /**
   * `spellRef` only: the escape from the registry. The form clears the ref and
   * moves focus to the free-text name beside it.
   */
  onUseCustomName?(): void;
}

/**
 * Kinds that render a set of controls rather than one: the form wraps these in
 * a `<fieldset><legend>` instead of a `<label htmlFor>`, because no single
 * element is the label's target.
 */
const GROUP_KINDS: readonly FieldKind[] = ['entryRemove', 'factRefs', 'cells'];

export function isGroupKind(kind: FieldKind): boolean {
  return GROUP_KINDS.includes(kind);
}

/** The value as an input's string. `undefined` and lists read as empty. */
export function asText(value: FieldValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : '';
  return '';
}

export function asList(value: FieldValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function asCells(value: FieldValue): [number, number][] {
  if (!Array.isArray(value)) return [];
  const cells: [number, number][] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [row, col] = item as unknown[];
    if (typeof row !== 'number' || typeof col !== 'number') continue;
    cells.push([row, col]);
  }
  return cells;
}

/** An option's second line, appended to its label inside a native `<option>`. */
export function optionLabel(option: Option): string {
  return option.hint === undefined || option.hint === '' ? option.label : `${option.label} (${option.hint})`;
}
