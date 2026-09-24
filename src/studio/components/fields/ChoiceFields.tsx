/**
 * The closed-set widgets (010, T1014): crawler, gear slot, chapter kind, entity,
 * registry spell, and the free `select` the table declares options for.
 *
 * A closed set is a `<select>`, never a combo box the author has to guess at:
 * the option list is exactly what the event may carry, so a typo is impossible.
 * The one open set - a map reveal's neighborhood - is a text box with a
 * `<datalist>` of the names this floor already uses.
 */
import { studioCopy } from '../../copy';
import type { FieldProps } from './shared';
import { asText, optionLabel } from './shared';
import { TextField } from './TextFields';
import styles from './fields.module.css';

/** The shared `<select>` behind every closed set. Blank is always reachable. */
function ChoiceSelect({
  field,
  id,
  value,
  onChange,
  options,
  describedBy,
  invalid,
  autoFocus,
  emptyLabel,
}: FieldProps & { emptyLabel?: string }) {
  const current = asText(value);
  /*
   * An event being edited may name something the current state no longer
   * offers (a spell the registry dropped, a crawler renamed). The value stays
   * selectable rather than silently snapping to blank.
   */
  const missing = current !== '' && !options.some((option) => option.value === current);
  return (
    <select
      id={id}
      className={styles.select}
      data-testid={`field-${field.key}`}
      value={current}
      aria-describedby={describedBy}
      aria-invalid={invalid === true ? true : undefined}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">
        {emptyLabel ?? (field.required === true ? studioCopy.fields.choose : studioCopy.fields.none)}
      </option>
      {missing ? <option value={current}>{current}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {optionLabel(option)}
        </option>
      ))}
    </select>
  );
}

/** The crawler an event belongs to, from the draft's party. */
export function ActorField(props: FieldProps) {
  if (props.options.length === 0) {
    return <p className={styles.notice}>{studioCopy.fields.noActors}</p>;
  }
  return <ChoiceSelect {...props} />;
}

/** A closed set the table spells out (`npc.action`). */
export function SelectField(props: FieldProps) {
  return <ChoiceSelect {...props} />;
}

/** A gear slot. */
export function SlotField(props: FieldProps) {
  return <ChoiceSelect {...props} />;
}

/** A chapter marker's kind, which decides the timeline colour. */
export function ChapterKindField(props: FieldProps) {
  return <ChoiceSelect {...props} />;
}

/** An entity from `npcs.json`. */
export function NpcRefField(props: FieldProps) {
  return <ChoiceSelect {...props} />;
}

/**
 * A spell from `spells.json`, plus the escape: a spell the book has not got is
 * written as a plain name in the field beside this one (008 revision 4).
 */
export function SpellRefField(props: FieldProps) {
  const { onUseCustomName, onChange } = props;
  return (
    <div className={styles.withEscape}>
      <ChoiceSelect {...props} />
      {onUseCustomName === undefined ? null : (
        <button
          type="button"
          className={styles.escape}
          data-testid="spell-custom-name"
          onClick={() => {
            onChange('');
            onUseCustomName();
          }}
        >
          {studioCopy.fields.spellCustom}
        </button>
      )}
    </div>
  );
}

/** An open set: the neighborhoods this draft's reveals already name. */
export function RoomField(props: FieldProps) {
  return <TextField {...props} />;
}
