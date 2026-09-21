/**
 * The scalar widgets: free text, prose, whole numbers, flags (010, T1014).
 *
 * Native inputs only - the platform's own keyboard behaviour is the
 * accessibility story, and a number input already steps on the arrow keys.
 */
import type { FieldProps } from './shared';
import { asText } from './shared';
import styles from './fields.module.css';

/** A one-line value, with a `<datalist>` when the field has suggestions. */
export function TextField({
  field,
  id,
  value,
  onChange,
  options,
  describedBy,
  invalid,
  autoFocus,
}: FieldProps) {
  const listId = options.length > 0 ? `${id}-list` : undefined;
  return (
    <>
      <input
        id={id}
        type="text"
        className={styles.input}
        data-testid={`field-${field.key}`}
        value={asText(value)}
        list={listId}
        aria-describedby={describedBy}
        aria-invalid={invalid === true ? true : undefined}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      {listId === undefined ? null : (
        <datalist id={listId} data-testid={`suggestions-${field.key}`}>
          {options.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      )}
    </>
  );
}

/** Prose: the System's message, a note, a sponsor read. */
export function LongTextField({
  field,
  id,
  value,
  onChange,
  describedBy,
  invalid,
  autoFocus,
}: FieldProps) {
  return (
    <textarea
      id={id}
      className={styles.textarea}
      data-testid={`field-${field.key}`}
      rows={3}
      value={asText(value)}
      aria-describedby={describedBy}
      aria-invalid={invalid === true ? true : undefined}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * A whole number. The value is kept as the input's own string so the author can
 * empty the box; `buildEvent` is what turns it into a number (or drops it).
 */
export function IntField({
  field,
  id,
  value,
  onChange,
  describedBy,
  invalid,
  autoFocus,
}: FieldProps) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      min={field.min}
      className={styles.number}
      data-testid={`field-${field.key}`}
      value={asText(value)}
      aria-describedby={describedBy}
      aria-invalid={invalid === true ? true : undefined}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** A flag. No type in the table uses one yet; the switch stays total. */
export function BoolField({ field, id, value, onChange, describedBy, autoFocus }: FieldProps) {
  return (
    <input
      id={id}
      type="checkbox"
      className={styles.checkbox}
      data-testid={`field-${field.key}`}
      checked={value === true}
      aria-describedby={describedBy}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
