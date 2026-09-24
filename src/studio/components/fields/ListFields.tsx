/**
 * The list widgets (010, T1014): what an event adds, what it removes, which
 * facts it unlocks, and which map cells it reveals.
 *
 * Adding is typing: Enter turns the box into a chip, Backspace on an empty box
 * takes the last one back, so a five-item pickup never needs the mouse.
 * Removing is a checkbox per thing the crawler actually has at that second
 * (`removableEntries`), because a removal that names nothing is a dead row.
 */
import { useState } from 'react';
import { studioCopy } from '../../copy';
import type { Option } from '../../options';
import type { FieldProps } from './shared';
import { asCells, asList } from './shared';
import styles from './fields.module.css';

/** Chips the author has already added, each with its own remove control. */
function Chips({
  values,
  onRemove,
  testid,
}: {
  values: readonly string[];
  onRemove(value: string): void;
  testid: string;
}) {
  if (values.length === 0) return null;
  return (
    <ul className={styles.chips} data-testid={testid}>
      {values.map((value) => (
        <li key={value} className={styles.chip}>
          <span>{value}</span>
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={studioCopy.fields.entryRemoveLabel(value)}
            onClick={() => onRemove(value)}
          >
            {'×'}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Free names, added one Enter at a time. */
export function EntryAddField({
  field,
  id,
  value,
  onChange,
  options,
  describedBy,
  invalid,
  autoFocus,
}: FieldProps) {
  const values = asList(value);
  const [text, setText] = useState('');
  const listId = options.length > 0 ? `${id}-list` : undefined;

  function add(): void {
    const name = text.trim();
    if (name === '') return;
    setText('');
    if (values.includes(name)) return;
    onChange([...values, name]);
  }

  return (
    <div className={styles.list}>
      <Chips
        values={values}
        onRemove={(name) => onChange(values.filter((item) => item !== name))}
        testid={`chips-${field.key}`}
      />
      <div className={styles.listRow}>
        <input
          id={id}
          type="text"
          className={styles.input}
          data-testid={`field-${field.key}`}
          placeholder={studioCopy.fields.entryPlaceholder}
          value={text}
          list={listId}
          aria-describedby={describedBy}
          aria-invalid={invalid === true ? true : undefined}
          autoFocus={autoFocus}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // Never submits the form: Enter in this box means "chip".
              event.preventDefault();
              add();
              return;
            }
            if (event.key === 'Backspace' && text === '' && values.length > 0) {
              event.preventDefault();
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
        />
        <button type="button" className={styles.smallButton} onClick={add}>
          {studioCopy.fields.add}
        </button>
      </div>
      {listId === undefined ? null : (
        <datalist id={listId} data-testid={`suggestions-${field.key}`}>
          {options.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** A checkbox per option, plus whatever the event already names. */
function CheckboxList({
  field,
  id,
  values,
  options,
  describedBy,
  empty,
  onToggle,
}: {
  field: FieldProps['field'];
  id: string;
  values: readonly string[];
  options: readonly Option[];
  describedBy?: string;
  empty: string;
  onToggle(value: string, checked: boolean): void;
}) {
  const extra = values.filter((value) => !options.some((option) => option.value === value));
  const all: Option[] = [...options, ...extra.map((value) => ({ value, label: value }))];
  if (all.length === 0) {
    return (
      <p className={styles.notice} data-testid={`empty-${field.key}`}>
        {empty}
      </p>
    );
  }
  return (
    <ul className={styles.checkList} data-testid={`field-${field.key}`} aria-describedby={describedBy}>
      {all.map((option) => {
        const optionId = `${id}-${option.value.replace(/\W+/g, '-')}`;
        return (
          <li key={option.value} className={styles.checkRow}>
            <input
              id={optionId}
              type="checkbox"
              className={styles.checkbox}
              value={option.value}
              checked={values.includes(option.value)}
              onChange={(event) => onToggle(option.value, event.target.checked)}
            />
            <label htmlFor={optionId} className={styles.checkLabel}>
              {option.label}
              {option.hint === undefined ? null : (
                <span className={styles.hint}>{option.hint}</span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** What the crawler loses: only what they hold at this second. */
export function EntryRemoveField({ field, id, value, onChange, options, describedBy }: FieldProps) {
  const values = asList(value);
  return (
    <CheckboxList
      field={field}
      id={id}
      values={values}
      options={options}
      describedBy={describedBy}
      empty={studioCopy.fields.nothingToRemove}
      onToggle={(name, checked) =>
        onChange(checked ? [...values, name] : values.filter((item) => item !== name))
      }
    />
  );
}

/** The facts an `npc` beat unlocks, read off the entity the beat is about. */
export function FactRefsField({ field, id, value, onChange, options, describedBy }: FieldProps) {
  const values = asList(value);
  return (
    <CheckboxList
      field={field}
      id={id}
      values={values}
      options={options}
      describedBy={describedBy}
      empty={studioCopy.fields.noFacts}
      onToggle={(factId, checked) =>
        onChange(checked ? [...values, factId] : values.filter((item) => item !== factId))
      }
    />
  );
}

/** `"3, 4"` -> `[3, 4]`; anything else is a typo, not a cell. */
function parseCell(text: string): [number, number] | null {
  const parts = text.split(/[,\s]+/).filter((part) => part !== '');
  if (parts.length !== 2) return null;
  const [row, col] = parts.map(Number);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) return null;
  return [row, col];
}

/**
 * The grid cells a reveal uncovers, as `row, column` pairs. Compact on purpose:
 * a reveal is usually a handful of cells typed straight off the map, and the
 * floor's rooms (the `label` field beside this one) are the friendlier handle
 * when the draft already names them.
 */
export function CellsField({ field, id, value, onChange, describedBy, invalid }: FieldProps) {
  const cells = asCells(value);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);

  function add(): void {
    if (text.trim() === '') return;
    const cell = parseCell(text);
    if (cell === null) {
      setBad(true);
      return;
    }
    setBad(false);
    setText('');
    if (cells.some(([row, col]) => row === cell[0] && col === cell[1])) return;
    onChange([...cells, cell]);
  }

  return (
    <div className={styles.list}>
      {cells.length === 0 ? (
        <p className={styles.notice}>{studioCopy.fields.cellsEmpty}</p>
      ) : (
        <ul className={styles.chips} data-testid={`cells-${field.key}`}>
          {cells.map(([row, col]) => (
            <li key={`${row},${col}`} className={styles.chip}>
              <span>{`${row}, ${col}`}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={studioCopy.fields.cellRemoveLabel(row, col)}
                onClick={() =>
                  onChange(cells.filter(([r, c]) => !(r === row && c === col)))
                }
              >
                {'×'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.listRow}>
        <input
          id={id}
          type="text"
          className={styles.input}
          data-testid={`field-${field.key}`}
          placeholder={studioCopy.fields.cellPlaceholder}
          aria-label={studioCopy.fields.cellPlaceholder}
          aria-describedby={describedBy}
          aria-invalid={bad || invalid === true ? true : undefined}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setBad(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <button type="button" className={styles.smallButton} onClick={add}>
          {studioCopy.fields.cellAdd}
        </button>
      </div>
      {bad ? <p className={styles.error}>{studioCopy.fields.cellInvalid}</p> : null}
    </div>
  );
}
