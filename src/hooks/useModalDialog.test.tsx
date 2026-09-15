// @vitest-environment jsdom
/**
 * The modal contract (contracts/dialog.md, research R6, T305). Nothing here
 * involves episode data: the hook is pure viewer-interaction state, so it is
 * driven through a bare harness dialog.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useModalDialog } from './useModalDialog';

interface HarnessProps {
  open: boolean;
  onClose(): void;
  returnFocusTo: HTMLElement | null;
  /** Drops the close control, to prove the "first focusable" fallback. */
  withClose?: boolean;
}

function Harness({ open, onClose, returnFocusTo, withClose = true }: HarnessProps) {
  const { dialogRef, onBackdropClick } = useModalDialog({ open, onClose, returnFocusTo });
  if (!open) return null;
  return (
    <div data-testid="backdrop" onClick={onBackdropClick}>
      <div ref={dialogRef} role="dialog" aria-modal="true" data-testid="dialog">
        {withClose ? (
          <button type="button" data-testid="record-close">
            Close
          </button>
        ) : null}
        <button type="button" data-testid="first">
          First
        </button>
        <a href="#last" data-testid="last">
          Last
        </a>
      </div>
    </div>
  );
}

/** The app root the dialog makes inert while it is open. */
function makeRoot(): { root: HTMLElement; children: HTMLElement[] } {
  const root = document.createElement('div');
  root.id = 'root';
  const page = document.createElement('main');
  const header = document.createElement('header');
  root.append(header, page);
  document.body.append(root);
  return { root, children: [header, page] };
}

/** A live trigger outside the dialog, like the glance card's "Open full record". */
function makeTrigger(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  document.body.append(button);
  return button;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('useModalDialog', () => {
  it('focuses the close control, locks the page, and makes the app root inert', () => {
    const { children } = makeRoot();
    const onClose = vi.fn();

    const { rerender } = render(
      <Harness open={false} onClose={onClose} returnFocusTo={null} />,
    );
    expect(document.body.classList.contains('dialog-open')).toBe(false);
    expect(children[0].hasAttribute('inert')).toBe(false);

    rerender(<Harness open onClose={onClose} returnFocusTo={null} />);
    expect(document.activeElement).toBe(screen.getByTestId('record-close'));
    expect(document.body.classList.contains('dialog-open')).toBe(true);
    for (const child of children) expect(child.hasAttribute('inert')).toBe(true);

    rerender(<Harness open={false} onClose={onClose} returnFocusTo={null} />);
    expect(document.body.classList.contains('dialog-open')).toBe(false);
    for (const child of children) expect(child.hasAttribute('inert')).toBe(false);
  });

  it('falls back to the first focusable when there is no close control', () => {
    render(<Harness open withClose={false} onClose={vi.fn()} returnFocusTo={null} />);
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness open onClose={vi.fn()} returnFocusTo={null} />);
    const close = screen.getByTestId('record-close');
    const last = screen.getByTestId('last');

    // Backwards off the first control lands on the last one…
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // …and forwards off the last one comes back round to the first.
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    // A Tab in the middle is left to the browser's own focus order.
    const first = screen.getByTestId('first');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('answers Escape without letting it reach the page behind (usePanel)', () => {
    const onClose = vi.fn();
    const page = vi.fn();
    document.addEventListener('keydown', page);
    try {
      render(<Harness open onClose={onClose} returnFocusTo={null} />);

      fireEvent.keyDown(screen.getByTestId('record-close'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      // The capture-phase listener stopped it before the bubble phase: one
      // Escape closes the record only, never the panel underneath it.
      expect(page).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', page);
    }
  });

  it('ignores every key it does not own', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} returnFocusTo={null} />);

    fireEvent.keyDown(screen.getByTestId('record-close'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('record-close'), { key: 'Escape', repeat: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click on the backdrop itself, never on one inside', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} returnFocusTo={null} />);

    fireEvent.click(screen.getByTestId('dialog'));
    fireEvent.click(screen.getByTestId('first'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger that opened it', () => {
    const trigger = makeTrigger();
    const onClose = vi.fn();
    const { rerender } = render(<Harness open onClose={onClose} returnFocusTo={trigger} />);
    expect(document.activeElement).toBe(screen.getByTestId('record-close'));

    rerender(<Harness open={false} onClose={onClose} returnFocusTo={trigger} />);
    expect(document.activeElement).toBe(trigger);
  });

  it('never focuses a trigger that has left the document', () => {
    const trigger = makeTrigger();
    const onClose = vi.fn();
    const { rerender } = render(<Harness open onClose={onClose} returnFocusTo={trigger} />);

    trigger.remove();
    rerender(<Harness open={false} onClose={onClose} returnFocusTo={trigger} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('opens where there is no #root to make inert', () => {
    const onClose = vi.fn();
    expect(() =>
      render(<Harness open onClose={onClose} returnFocusTo={null} />),
    ).not.toThrow();
    expect(document.activeElement).toBe(screen.getByTestId('record-close'));
    expect(document.body.classList.contains('dialog-open')).toBe(true);
  });

  it('leaves the page alone while it is closed', () => {
    const { children } = makeRoot();
    const page = vi.fn();
    document.addEventListener('keydown', page);
    try {
      const onClose = vi.fn();
      render(<Harness open={false} onClose={onClose} returnFocusTo={null} />);

      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
      expect(page).toHaveBeenCalledTimes(1);
      expect(children.some((child) => child.hasAttribute('inert'))).toBe(false);
    } finally {
      document.removeEventListener('keydown', page);
    }
  });
});
