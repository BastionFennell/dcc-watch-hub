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

  /* ------------------------------------------------- Wave C: the shell */

  /** The drafts list at `/studio`. */
  home: {
    title: 'Studio',
    subtitle: 'Place events against the video, preview the overlay, export the episode file.',
    draftsTitle: 'Drafts in this browser',
    draftsEmpty: 'No drafts yet. Start one below.',
    draftMeta: (events: number, when: string) =>
      `${events} event${events === 1 ? '' : 's'} · saved ${when}`,
    open: 'Open',
    openLabel: (title: string) => `Open ${title}`,
    delete: 'Delete',
    deleteLabel: (title: string) => `Delete ${title}`,
    deleteConfirm: (title: string) =>
      `Delete the draft "${title}"? It is only in this browser, so this cannot be undone.`,
    startTitle: 'Start',
    newEpisode: 'New episode',
    openFile: 'Open file...',
    publishedTitle: 'Edit a published episode',
    publishedHelp: 'Loads the file the site serves today and turns it into a draft.',
    publishedEmpty: 'The archive has no episodes to open.',
    publishedLoading: 'Loading the archive...',
    publishedReplace: (id: number) =>
      `A draft for episode ${id} is already here. Replace it with the published file?`,
    storageOff:
      'This browser will not let the Studio save drafts (private window, or site data is blocked). Export early and often.',
  },

  /** The editor's top bar. */
  header: {
    back: 'All drafts',
    backLabel: 'Back to the drafts list',
    undo: 'Undo',
    undoLabel: 'Undo (Cmd or Ctrl + Z)',
    redo: 'Redo',
    redoLabel: 'Redo (Shift + Cmd or Ctrl + Z)',
    import: 'Import',
    importLabel: 'Replace this draft with an episode JSON file',
    importConfirm: (events: number) =>
      `This draft has ${events} event${events === 1 ? '' : 's'}. Replace all of it with the file?`,
    exportMenu: 'Export',
    download: (name: string) => `Download ${name}`,
    saveToFolder: 'Save to data folder',
    pickFolder: 'Pick the data folder...',
    copyShowEntry: 'Copy show.json entry',
    downloadShowEntry: 'Download show.json entry',
    saved: 'Saved',
    saving: 'Saving...',
    saveError: (reason: string) => `Not saved: ${reason}`,
    quota: 'this browser is out of room. Delete a draft, or export and start clean.',
    unavailable: 'this browser will not store drafts. Export before you close the tab.',
  },

  /** The transport bar under the stage. */
  transport: {
    label: 'Transport',
    play: 'Play',
    pause: 'Pause',
    playLabel: 'Play (Space)',
    pauseLabel: 'Pause (Space)',
    back5: '-5 s',
    back5Label: 'Back five seconds (J)',
    back1: '-1 s',
    back1Label: 'Back one second (Left arrow)',
    forward1: '+1 s',
    forward1Label: 'Forward one second (Right arrow)',
    forward5: '+5 s',
    forward5Label: 'Forward five seconds (L)',
    rateLabel: 'Speed',
    timeLabel: 'Playhead',
    noDuration: '--:--',
    add: (time: string) => `Add event at ${time}`,
    addHint: 'E',
    addLabel: (time: string) => `Add an event at ${time} (E)`,
    noTransport:
      "This player cannot be driven from here. Use the video's own controls; times still follow it.",
  },

  /** The draft's own marker strip. */
  timeline: {
    label: 'Draft events',
    scrub: 'Seek the video',
    empty: 'No events yet.',
    markerLabel: (time: string, sentence: string) => `${time} ${sentence}`,
  },

  /** The Events tab. */
  list: {
    title: 'Events',
    count: (n: number) => `${n} event${n === 1 ? '' : 's'}`,
    filterGroupLabel: 'Filter by group',
    filterAll: 'All',
    filterActorLabel: 'Crawler',
    filterActorAll: 'Anyone',
    searchLabel: 'Search events',
    searchPlaceholder: 'Search',
    now: 'now',
    nowLabel: 'The event the playhead is on',
    issue: 'Has an issue',
    rowLabel: (time: string, sentence: string) => `Edit ${time} ${sentence}`,
    retime: 'Retime',
    retimeLabel: (time: string) => `Retime to the playhead (${time}) - T`,
    duplicate: 'Duplicate',
    duplicateLabel: (time: string) => `Duplicate at the playhead (${time}) - D`,
    remove: 'Delete',
    removeLabel: 'Delete this event (Delete)',
    empty: 'No events yet. Press E, or use the Add button, to mark the moment you are watching.',
    emptyFiltered: 'No event matches these filters.',
    clearFilters: 'Clear filters',
  },

  /** The Episode tab: meta and the party. */
  episode: {
    title: 'Episode',
    metaTitle: 'Details',
    number: 'Number',
    numberHelp: 'Fixed: it names the draft and the exported file.',
    episodeTitle: 'Title',
    youtube: 'YouTube URL or id',
    youtubeInvalid: 'That is not a YouTube link or an 11-character id.',
    youtubeOk: (id: string) => `Video id: ${id}`,
    floor: 'Floor',
    duration: 'Duration',
    durationHelp: 'm:ss, h:mm:ss, or seconds. Event times are clamped to it.',
    usePlayerDuration: 'Use player duration',
    usePlayerDurationLabel: (time: string) => `Use the player's duration (${time})`,
    partyTitle: 'Party at the start',
    partyEmpty: 'No crawlers yet. Add one to start placing events.',
    addCrawler: 'Add crawler',
    removeCrawler: 'Remove',
    removeCrawlerLabel: (name: string) => `Remove ${name} from the party`,
    removeCrawlerConfirm: (name: string) => `Remove ${name} from the starting party?`,
    crawlerJsonLabel: (name: string) => `${name} as JSON`,
    apply: 'Apply',
    reset: 'Reset',
    jsonInvalid: (message: string) => `Not valid JSON: ${message}`,
    jsonNotObject: 'A crawler has to be a JSON object.',
    jsonNoId: 'A crawler needs an "id" string.',
    jsonApplied: 'Applied.',
    jsonHelp: 'The escape hatch: every sheet field, exactly as the file will carry it.',
  },

  /** The new-episode dialog. */
  dialog: {
    newTitle: 'New episode',
    number: 'Episode number',
    numberTaken: (id: number) => `A draft for episode ${id} already exists.`,
    numberInvalid: 'Type a whole number above zero.',
    episodeTitle: 'Title',
    titleRequired: 'Give the episode a title.',
    youtube: 'YouTube URL or id',
    youtubeInvalid: 'That is not a YouTube link or an 11-character id.',
    floor: 'Floor',
    duration: 'Duration (optional)',
    durationHelp: 'Leave it empty and take it from the player later.',
    partyTitle: 'Party at the start',
    partyEmpty: 'Empty party',
    partyInitial: 'Initial party of another episode',
    partyFinal: 'Final state of another episode',
    partyEpisode: 'Episode',
    partyLoading: 'Reading that episode...',
    partyFailed: 'That episode could not be read; the draft starts with an empty party.',
    partyCount: (n: number) => `${n} crawler${n === 1 ? '' : 's'} will be copied in.`,
    create: 'Create',
    cancel: 'Cancel',
    close: 'Close',
  },

  /** Transient notices the shell raises. */
  notices: {
    narrow: 'The Studio needs a wider screen.',
    narrowHelp:
      'The editor wants at least 1000 px: the video, the timeline and the event list sit side by side. Authoring on a phone is a non-goal.',
    unknownDraft: (id: string) => `There is no draft for episode ${id} in this browser.`,
    unknownDraftCreate: 'Create it',
    unknownDraftHome: 'Back to the drafts list',
    loading: 'Loading the draft...',
    exported: (name: string) => `Downloaded ${name}.`,
    savedToFolder: (name: string) => `Saved ${name} to the data folder.`,
    folderFailed: (message: string) => `Could not save to the folder: ${message}`,
    folderPicked: (name: string) => `Saving into ${name} from now on.`,
    copied: 'The show.json entry is on the clipboard.',
    copyFailed: 'Could not reach the clipboard. The entry is selected below - copy it by hand.',
    imported: (events: number) => `Imported ${events} event${events === 1 ? '' : 's'}.`,
    importFailed: (message: string) => `Could not import that file: ${message}`,
    dismiss: 'Dismiss',
    hotkeysWhileFormOpen:
      'While the form is open the page keys are off: only undo, redo and save still fire.',
  },
};
