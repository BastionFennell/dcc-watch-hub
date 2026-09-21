/**
 * Every string the Studio's own UI renders (010, T1013).
 *
 * Plain functional English, deliberately *not* the System's voice: the viewer
 * is a broadcast and this is a tool the author drives (constitution VII). The
 * viewer's `src/copy.ts` stays the System's; nothing here leaks into it, and
 * the components the Studio reuses (PartyRail, EventFeed) keep reading their
 * own copy, so the preview reads exactly as the episode will.
 *
 * Field labels, help and group names are not here on purpose: they are part of
 * the declarative table in `eventForms.ts` (the plan's contract), so a new event
 * type needs one row and no second edit.
 *
 * Later waves APPEND their own groups at the end of this object.
 */
export const studioCopy = {
  /** The event form's chrome: title, time row, actions, save reasons. */
  form: {
    addTitle: 'Add event',
    editTitle: 'Edit event',
    typeLabel: 'Type',
    changeType: 'Change type',
    unknownType: (type: string) => `"${type}" is not a type this build knows. Pick one to replace it.`,

    timeLabel: 'Time',
    timeHelp: 'm:ss, h:mm:ss, or a number of seconds.',
    timeInvalid: 'Not a time. Try 4:05.',
    timeClamped: (time: string) => `Clamped to the end of the video (${time}).`,
    nudgeBack: '-1 s',
    nudgeBackLabel: 'One second earlier',
    nudgeForward: '+1 s',
    nudgeForwardLabel: 'One second later',
    setToPlayhead: 'Set to playhead',
    setToPlayheadLabel: (time: string) => `Set the time to the playhead (${time})`,

    previewLabel: 'Feed line',
    previewEmpty: 'Fill the fields in to see the feed line.',

    save: 'Save',
    saveLabel: 'Save (Cmd or Ctrl + Enter)',
    cancel: 'Cancel',
    cancelLabel: 'Cancel (Escape)',
    keysHelp: 'Cmd or Ctrl + Enter saves. Add Shift to save and resume playback.',

    reasonPickType: 'Pick an event type.',
    reasonTime: 'Enter a time as m:ss.',
    reasonRequired: (labels: readonly string[]) => `Fill in ${labels.join(', ')}.`,
    reasonOneOf: (labels: readonly string[]) => `Fill in ${labels.join(' or ')}.`,
    reasonInvalid: 'The viewer would ignore this event. Check the fields.',
  },

  /** The field widgets: shared labels, empty states and list controls. */
  fields: {
    required: 'Required.',
    requiredMark: 'required',
    choose: 'Choose one',
    none: 'None',
    add: 'Add',
    entryPlaceholder: 'Type a name, press Enter',
    entryHelp: 'Enter adds. Backspace on an empty box removes the last one.',
    entryRemoveLabel: (name: string) => `Remove ${name}`,
    entryDuplicate: (name: string) => `${name} is already on the list.`,
    nothingToRemove: 'Nothing to remove at this moment.',
    noActors: 'No crawlers yet. Add the party on the Episode tab.',
    noFacts: 'Pick the entity first; its facts appear here.',
    spellCustom: 'Use a custom name',
    spellCustomHelp: 'Leave the registry spell empty and type the name below.',
    cellPlaceholder: 'row, column',
    cellAdd: 'Add cell',
    cellInvalid: 'Type a row and a column, like 3, 4.',
    cellLabel: (row: number, col: number) => `Row ${row}, column ${col}`,
    cellRemoveLabel: (row: number, col: number) => `Remove row ${row}, column ${col}`,
    cellsEmpty: 'No cells yet.',
    roomsHelp: 'Pick a neighborhood this floor already uses, or type a new one.',
  },

  /** The grid of event types the add form opens on. */
  typePicker: {
    label: 'Event type',
    filterLabel: 'Filter types',
    filterPlaceholder: 'Filter types',
    filterHelp: 'Enter picks the first match. Arrow keys move across the grid.',
    noMatch: (query: string) => `No event type matches "${query}".`,
    lastUsed: 'last used',
  },

  /** The read-only overlay preview under the stage. */
  preview: {
    title: 'Preview',
    expand: 'Show the preview',
    collapse: 'Hide the preview',
    at: (time: string) => `at ${time}`,
    unavailable:
      'The draft cannot be previewed yet. The episode needs a party and a valid initial state.',
    readOnly: 'Read only: the preview shows what the viewer would show at this second.',
  },

  /** The issues list: the viewer's own validation, run over the draft. */
  issues: {
    title: 'Issues',
    empty: 'No issues.',
    error: 'Error',
    warning: 'Warning',
    selectLabel: (message: string) => `Show the event: ${message}`,
    count: (errors: number, warnings: number) => `${errors} errors, ${warnings} warnings`,
  },
};
