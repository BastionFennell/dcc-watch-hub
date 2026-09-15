# Contract: Full record dialog

`useModalDialog({ open, onClose, returnFocusTo }) → { dialogRef, backdropProps, dialogProps }`

- Portal target: `document.body`. Structure: `<div class=backdrop data-testid="record-backdrop">
  <div role="dialog" aria-modal="true" aria-labelledby=… id="crawler-record" data-testid="crawler-record">`.
- Open: `body.dialog-open` added; every child of `#root` gets `inert`; focus → the dialog's
  close button (`data-testid="record-close"`).
- Keys: Tab/Shift+Tab wrap inside; Escape (document capture phase, `stopPropagation`) closes.
- Pointer: click on the backdrop itself closes; clicks inside do not.
- Close: remove `inert` and the body class; focus `returnFocusTo` if still connected.
- The dialog MUST NOT call anything on the `TimeSource`.

Copy: kicker `recordKicker` "CRAWLER RECORD", title = crawler name, close `panelClose`,
glance kicker `glanceKicker` "CRAWLER GLANCE", button `openRecord` "Open full record",
ledger labels reuse `dossierSections.*`, `ledgerCount(n)`, `historyPlaceholder` "—".

## Revision 2 — views

`FullRecordDialog` owns `view: 'sheet' | 'skills' | 'inventory' | 'achievements' | 'history'`.
- Title: `recordTitle(name)` on the sheet; `recordListTitle(name, categoryLabel)` in a list view.
- "View all (N)" buttons: `data-testid="view-all-<category>"`, `aria-controls="crawler-record-body"`.
- Back control: `data-testid="record-back"`, focus target on entering the list view is the list
  heading (`tabIndex=-1`); on returning, focus goes back to the "View all" button that opened it.
- Escape: in a list view → back to the sheet (consumed); on the sheet → close (as before).
- Reset to `sheet` whenever `open` becomes false.
