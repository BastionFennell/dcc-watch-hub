/**
 * The grid the add form opens on (010, T1015).
 *
 * Twenty types is too many to hunt through with the mouse and too few to need a
 * search page, so it is both: a grid grouped the way the table groups it, and a
 * filter box that narrows as the author types. Enter takes the first match, so
 * "sp" + Enter is a spell without ever leaving the keyboard.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EventType } from '../../data/types';
import type { EventFormSpec } from '../eventForms';
import { GROUP_LABELS, formsByGroup } from '../eventForms';
import { studioCopy } from '../copy';
import styles from './TypePicker.module.css';

export interface TypePickerProps {
  /** The remembered last type: pre-highlighted and the first Tab stop. */
  value?: string;
  onPick(type: EventType): void;
  /** Focus the filter on mount - the add form's entry point. */
  autoFocus?: boolean;
}

/** Matches the CSS grid, so the arrow keys move the way the eye does. */
const COLUMNS = 3;

function matches(form: EventFormSpec, query: string): boolean {
  if (query === '') return true;
  const needle = query.trim().toLowerCase();
  return form.label.toLowerCase().includes(needle) || form.type.toLowerCase().includes(needle);
}

export function TypePicker({ value, onPick, autoFocus }: TypePickerProps) {
  const domId = useId();
  const filterId = `${domId}-filter`;
  const helpId = `${domId}-help`;
  const [query, setQuery] = useState('');
  const groups = useMemo(
    () =>
      formsByGroup()
        .map(({ group, forms }) => ({ group, forms: forms.filter((form) => matches(form, query)) }))
        .filter(({ forms }) => forms.length > 0),
    [query],
  );
  const flat = useMemo(() => groups.flatMap(({ forms }) => forms), [groups]);

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [active, setActive] = useState(0);

  /*
   * The remembered type leads while the list is untouched; any filtering starts
   * again at the first match, because that is what Enter would take.
   */
  useEffect(() => {
    const remembered = flat.findIndex((form) => form.type === value);
    setActive(query === '' && remembered >= 0 ? remembered : 0);
  }, [query, value, flat]);

  const index = Math.min(active, Math.max(flat.length - 1, 0));

  function focusAt(next: number): void {
    if (flat.length === 0) return;
    const clamped = Math.min(Math.max(next, 0), flat.length - 1);
    setActive(clamped);
    buttons.current.get(flat[clamped].type)?.focus();
  }

  function onGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + COLUMNS);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - COLUMNS);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(flat.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.picker} data-testid="type-picker">
      <label className={styles.filterLabel} htmlFor={filterId}>
        {studioCopy.typePicker.filterLabel}
      </label>
      <input
        id={filterId}
        type="search"
        className={styles.filter}
        data-testid="type-filter"
        placeholder={studioCopy.typePicker.filterPlaceholder}
        aria-describedby={helpId}
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (flat.length > 0) onPick(flat[0].type);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusAt(0);
          }
        }}
      />
      <p className={styles.help} id={helpId}>
        {studioCopy.typePicker.filterHelp}
      </p>

      {flat.length === 0 ? (
        <p className={styles.empty} data-testid="type-picker-empty">
          {studioCopy.typePicker.noMatch(query.trim())}
        </p>
      ) : (
        <div onKeyDown={onGridKeyDown}>
          {groups.map(({ group, forms }) => (
            <div key={group} className={styles.group}>
              <h4 className={styles.groupLabel} id={`${domId}-group-${group}`}>
                {GROUP_LABELS[group]}
              </h4>
              <div
                className={styles.grid}
                role="group"
                aria-labelledby={`${domId}-group-${group}`}
              >
                {forms.map((form) => {
                  const position = flat.indexOf(form);
                  const last = form.type === value;
                  return (
                    <button
                      key={form.type}
                      type="button"
                      className={styles.type}
                      data-testid="type-option"
                      data-type={form.type}
                      data-last-used={last ? 'true' : undefined}
                      tabIndex={position === index ? 0 : -1}
                      ref={(node) => {
                        if (node === null) buttons.current.delete(form.type);
                        else buttons.current.set(form.type, node);
                      }}
                      onFocus={() => setActive(position)}
                      onClick={() => onPick(form.type)}
                    >
                      {form.label}
                      {last ? (
                        <span className="sr-only">{` (${studioCopy.typePicker.lastUsed})`}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TypePicker;
