/**
 * The form behind "mark a moment" (010, T1016, US1 / US2).
 *
 * Everything it knows about an event type comes from the table
 * (`EVENT_FORMS`), everything it offers comes from `optionsFor`, everything it
 * prefills comes from `defaultsFor`, and the only thing it hands back is
 * `buildEvent`'s raw event. So a new event type is one table row and no change
 * here, and what the author saves is exactly what the file will carry.
 *
 * Two modes, one component: *add* opens on the type grid and then the fields;
 * *edit* opens on the fields of the event's own type, which "Change type" can
 * still replace, keeping the values the new type also understands.
 *
 * The container owns the draft: this form never mutates it. It should mount the
 * form with `key={editing?.uid ?? 'new'}` so reopening it on another event
 * starts clean.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EventType } from '../../data/types';
import { normalizeEvent } from '../../data/validate';
import { feedItems } from '../../engine/selectors';
import { spellIndex } from '../../engine/spells';
import { buildEvent, eventToValues } from '../buildEvent';
import { studioCopy } from '../copy';
import { defaultsFor, nextRankFor } from '../defaults';
import type { DraftEvent, RawEvent, StudioDraft } from '../draft';
import type { FieldValue, FieldValues } from '../eventForms';
import { EVENT_FORMS, isKnownEventType } from '../eventForms';
import type { StudioRegistries } from '../options';
import { actorOptions, optionsFor, stateAt } from '../options';
import { clampTime, formatTimecode, parseTimecode } from '../timecode';
import { FieldInput } from './fields/FieldInput';
import { isGroupKind } from './fields/shared';
import { TypePicker } from './TypePicker';
import styles from './EventForm.module.css';

export interface EventFormProps {
  draft: StudioDraft;
  registries?: StudioRegistries;
  /** The playhead. A new event opens here, and "Set to playhead" returns here. */
  t: number;
  /** Present in edit mode; absent in add mode. */
  editing?: DraftEvent;
  /** Sticky actor and type, remembered by the container across events. */
  lastActor?: string;
  lastType?: EventType;
  onSave(event: RawEvent, opts: { resume: boolean }): void;
  onCancel(): void;
  /** Called alongside "Set to playhead", for a container that also retimes. */
  onRetimeToPlayhead?(): void;
}

function text(value: FieldValue): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function actorOf(values: FieldValues): string | undefined {
  return text(values.actor);
}

function filled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value !== '';
  return true;
}

/**
 * The defaults the author has not spoken for. A field they have edited - even
 * to empty it - is never refilled (FR-1004).
 */
function withDefaults(
  values: FieldValues,
  defaults: FieldValues,
  touched: ReadonlySet<string>,
): FieldValues {
  const next = { ...values };
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (touched.has(key)) continue;
    if (next[key] === value) continue;
    next[key] = value;
    changed = true;
  }
  return changed ? next : values;
}

/**
 * What survives a change of type: a key the new type also has, in the same
 * kind of field. The crawler is the one that matters - retyping the actor after
 * picking the wrong type is the tax this avoids.
 */
function keepCompatible(
  from: EventType | null,
  to: EventType,
  values: FieldValues,
): FieldValues {
  if (from === null) return {};
  const before = EVENT_FORMS[from].fields;
  const kept: FieldValues = {};
  for (const field of EVENT_FORMS[to].fields) {
    const previous = before.find((candidate) => candidate.key === field.key);
    if (previous === undefined || previous.kind !== field.kind) continue;
    if (!filled(values[field.key])) continue;
    kept[field.key] = values[field.key];
  }
  return kept;
}

export function EventForm({
  draft,
  registries,
  t,
  editing,
  lastActor,
  lastType,
  onSave,
  onCancel,
  onRetimeToPlayhead,
}: EventFormProps) {
  const domId = useId();
  const editingType = editing === undefined ? null : editing.event.type;
  const knownEditingType =
    editingType !== null && isKnownEventType(editingType) ? editingType : null;

  const [type, setType] = useState<EventType | null>(knownEditingType);
  const [picking, setPicking] = useState(knownEditingType === null);
  const [values, setValues] = useState<FieldValues>(() =>
    editing === undefined ? {} : eventToValues(editing.event),
  );
  const [timeText, setTimeText] = useState(() =>
    formatTimecode(editing === undefined ? t : editing.event.t),
  );
  /* Everything the author has typed, so a default never lands on top of it. */
  const touched = useRef(new Set<string>(editing === undefined ? [] : Object.keys(values)));
  const [attempted, setAttempted] = useState(false);

  const duration = draft.meta.durationSec;
  const parsed = parseTimecode(timeText);
  const lastValidTime = useRef(editing === undefined ? t : editing.event.t);
  const time = parsed === null ? lastValidTime.current : clampTime(parsed, duration);
  if (parsed !== null) lastValidTime.current = time;
  const clamped = parsed !== null && parsed !== time;

  const state = useMemo(() => stateAt(draft, time), [draft, time]);
  const actorId = actorOf(values) ?? lastActor;
  const npcId = typeof values.id === 'string' ? values.id : undefined;

  /* Type or crawler changed: fill in what this moment already knows. */
  useEffect(() => {
    if (type === null) return;
    setValues((prev) => withDefaults(prev, defaultsFor(type, actorId, state), touched.current));
    // `state` is deliberately not a dependency: a defaults pass belongs to a
    // change of type or crawler, not to every scrub of the playhead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, actorId]);

  /*
   * The rank a skill or a spell should open with cannot come from `defaultsFor`:
   * it depends on *which* ability the author names, which they do after the type
   * is chosen (FR-1004). An ability the crawler has not got yet has no rank to
   * advance, so nothing is filled.
   */
  const rankKey =
    type === 'skill'
      ? text(values.name)
      : type === 'spell'
        ? (text(values.ref) ?? text(values.name))
        : undefined;
  useEffect(() => {
    if (type !== 'skill' && type !== 'spell') return;
    if (touched.current.has('rank')) return;
    const next = nextRankFor(state, actorId, type, rankKey);
    if (next === undefined) return;
    setValues((prev) => (prev.rank === next ? prev : { ...prev, rank: next }));
    // Same as above: a change of ability, not a scrub of the playhead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, actorId, rankKey]);

  function edit(key: string, value: FieldValue): void {
    touched.current.add(key);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickType(next: EventType): void {
    setValues((prev) => {
      const kept = keepCompatible(type, next, prev);
      for (const key of Array.from(touched.current)) {
        if (!(key in kept)) touched.current.delete(key);
      }
      return kept;
    });
    setType(next);
    setPicking(false);
  }

  function nudge(delta: number): void {
    setTimeText(formatTimecode(clampTime(time + delta, duration)));
  }

  function toPlayhead(): void {
    setTimeText(formatTimecode(clampTime(t, duration)));
    onRetimeToPlayhead?.();
  }

  /* ------------------------------------------------------------ validity */

  const form = type === null ? null : EVENT_FORMS[type];
  const built = type === null ? null : buildEvent(type, time, values);
  const missing =
    form === null || built === null
      ? []
      : form.fields.filter((field) => field.required === true && built[field.key] === undefined);
  const oneOf = form?.requireOneOf;
  const oneOfMissing =
    oneOf !== undefined && built !== null && !oneOf.some((key) => built[key] !== undefined);
  const keepsType = built !== null && normalizeEvent(built).type === type;

  const oneOfLabels =
    oneOf === undefined || form === null
      ? []
      : oneOf.map((key) => form.fields.find((field) => field.key === key)?.label ?? key);

  let reason: string | null = null;
  if (type === null) reason = studioCopy.form.reasonPickType;
  else if (parsed === null) reason = studioCopy.form.reasonTime;
  else if (missing.length > 0)
    reason = studioCopy.form.reasonRequired(missing.map((field) => field.label));
  else if (oneOfMissing) reason = studioCopy.form.reasonOneOf(oneOfLabels);
  else if (!keepsType) reason = studioCopy.form.reasonInvalid;

  function save(resume: boolean): void {
    setAttempted(true);
    if (reason !== null || built === null) return;
    onSave(built, { resume });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLFormElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      save(event.shiftKey);
    }
  }

  /* ------------------------------------------------------------- preview */

  const party = useMemo(
    () => actorOptions(draft).map((option) => ({ id: option.value, name: option.label })),
    [draft],
  );
  const spells = useMemo(() => spellIndex(registries?.spells ?? null), [registries?.spells]);
  const line = useMemo(() => {
    if (built === null) return null;
    const normalized = normalizeEvent(built);
    if (normalized.type === 'unknown') return null;
    return feedItems([normalized], time, 1, party, registries?.npcs ?? null, spells)[0] ?? null;
  }, [built, time, party, registries?.npcs, spells]);

  /* -------------------------------------------------------------- render */

  const reasonId = `${domId}-reason`;

  return (
    <form
      className={styles.form}
      data-testid="event-form"
      aria-label={editing === undefined ? studioCopy.form.addTitle : studioCopy.form.editTitle}
      noValidate
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={onKeyDown}
    >
      <div className={styles.head}>
        <h3 className={styles.title}>
          {editing === undefined ? studioCopy.form.addTitle : studioCopy.form.editTitle}
        </h3>
        {form === null ? null : (
          <p className={styles.type} data-testid="event-form-type">
            <span className={styles.typeLabel}>{studioCopy.form.typeLabel}</span>
            {form.label}
          </p>
        )}
        {picking ? null : (
          <button
            type="button"
            className={styles.ghost}
            data-testid="change-type"
            onClick={() => setPicking(true)}
          >
            {studioCopy.form.changeType}
          </button>
        )}
      </div>

      <div className={styles.timeRow}>
        <label className={styles.timeLabel} htmlFor={`${domId}-time`}>
          {studioCopy.form.timeLabel}
        </label>
        <input
          id={`${domId}-time`}
          type="text"
          className={styles.time}
          data-testid="event-time"
          inputMode="numeric"
          value={timeText}
          aria-describedby={`${domId}-time-help`}
          aria-invalid={parsed === null ? true : undefined}
          onChange={(event) => setTimeText(event.target.value)}
        />
        <button
          type="button"
          className={styles.nudge}
          data-testid="nudge-back"
          aria-label={studioCopy.form.nudgeBackLabel}
          onClick={() => nudge(-1)}
        >
          {studioCopy.form.nudgeBack}
        </button>
        <button
          type="button"
          className={styles.nudge}
          data-testid="nudge-forward"
          aria-label={studioCopy.form.nudgeForwardLabel}
          onClick={() => nudge(1)}
        >
          {studioCopy.form.nudgeForward}
        </button>
        <button
          type="button"
          className={styles.ghost}
          data-testid="set-to-playhead"
          aria-label={studioCopy.form.setToPlayheadLabel(formatTimecode(t))}
          onClick={toPlayhead}
        >
          {studioCopy.form.setToPlayhead}
        </button>
        <p className={styles.help} id={`${domId}-time-help`}>
          {parsed === null
            ? studioCopy.form.timeInvalid
            : clamped
              ? studioCopy.form.timeClamped(formatTimecode(time))
              : studioCopy.form.timeHelp}
        </p>
      </div>

      {editingType !== null && knownEditingType === null ? (
        <p className={styles.notice} data-testid="unknown-type">
          {studioCopy.form.unknownType(editingType)}
        </p>
      ) : null}

      {picking ? (
        <TypePicker value={type ?? lastType} onPick={pickType} autoFocus />
      ) : form === null ? null : (
        <div className={styles.fields} key={form.type}>
          {form.fields.map((field, index) => {
            const fieldId = `${domId}-${field.key}`;
            const helpId = `${fieldId}-help`;
            const errorId = `${fieldId}-error`;
            const requiredMissing = missing.includes(field);
            const oneOfHere = oneOfMissing && oneOf?.includes(field.key) === true;
            const error = requiredMissing
              ? studioCopy.fields.required
              : oneOfHere
                ? studioCopy.form.reasonOneOf(oneOfLabels)
                : null;
            const describedBy =
              [field.help === undefined ? null : helpId, error === null ? null : errorId]
                .filter((id): id is string => id !== null)
                .join(' ') || undefined;
            const control = (
              <FieldInput
                field={field}
                id={fieldId}
                value={values[field.key]}
                onChange={(value) => edit(field.key, value)}
                options={optionsFor(field, { draft, registries, state, actorId, npcId })}
                describedBy={describedBy}
                invalid={error !== null}
                autoFocus={index === 0}
                onUseCustomName={
                  field.kind === 'spellRef'
                    ? () => document.getElementById(`${domId}-name`)?.focus()
                    : undefined
                }
              />
            );
            const label = (
              <>
                {field.label}
                {field.required === true ? (
                  <span className={styles.required} aria-hidden="true">
                    {' *'}
                  </span>
                ) : null}
              </>
            );
            return (
              <div className={styles.field} key={field.key} data-field={field.key}>
                {isGroupKind(field.kind) ? (
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.label}>{label}</legend>
                    {control}
                  </fieldset>
                ) : (
                  <>
                    <label className={styles.label} htmlFor={fieldId}>
                      {label}
                    </label>
                    {control}
                  </>
                )}
                {field.help === undefined ? null : (
                  <p className={styles.help} id={helpId}>
                    {field.help}
                  </p>
                )}
                {error === null ? null : (
                  <p className={styles.error} id={errorId} data-testid={`error-${field.key}`}>
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.preview} data-testid="feed-line">
        <span className={styles.previewLabel}>{studioCopy.form.previewLabel}</span>
        {line === null ? (
          <span className={styles.previewEmpty}>{studioCopy.form.previewEmpty}</span>
        ) : (
          <span>{`${line.label} · ${line.text}`}</span>
        )}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          data-testid="save-event"
          aria-label={studioCopy.form.saveLabel}
          aria-describedby={reason === null ? undefined : reasonId}
          disabled={reason !== null}
          onClick={() => save(false)}
        >
          {studioCopy.form.save}
        </button>
        <button
          type="button"
          className={styles.ghost}
          data-testid="cancel-event"
          aria-label={studioCopy.form.cancelLabel}
          onClick={onCancel}
        >
          {studioCopy.form.cancel}
        </button>
        <p
          className={reason === null ? styles.help : styles.error}
          id={reasonId}
          data-testid="save-reason"
          role={attempted && reason !== null ? 'alert' : undefined}
        >
          {reason ?? studioCopy.form.keysHelp}
        </p>
      </div>
    </form>
  );
}

export default EventForm;
