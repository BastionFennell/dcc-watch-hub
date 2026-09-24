// @vitest-environment jsdom
/**
 * T1021 - the keyboard's three rules (FR-1002): a bare key belongs to whatever
 * text box has focus, a modifier combination never does, and `enabled: false`
 * silences the whole map in one place.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { comboOf, isTypingTarget, useStudioHotkeys } from './useStudioHotkeys';
import type { HotkeyMap } from './useStudioHotkeys';

function Harness({ map, enabled = true }: { map: HotkeyMap; enabled?: boolean }) {
  useStudioHotkeys(map, { enabled });
  return (
    <div>
      <input data-testid="box" />
      <button type="button" data-testid="btn">
        press
      </button>
    </div>
  );
}

afterEach(cleanup);

describe('comboOf', () => {
  it('names the space bar and lowercases the key', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: ' ' }))).toBe('space');
    expect(comboOf(new KeyboardEvent('keydown', { key: 'E' }))).toBe('e');
    expect(comboOf(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe('arrowleft');
  });

  it('puts the modifiers in one fixed order, with Cmd and Ctrl both "mod"', () => {
    expect(comboOf(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))).toBe('mod+z');
    expect(comboOf(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe('mod+z');
    expect(
      comboOf(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true })),
    ).toBe('mod+shift+z');
  });
});

describe('isTypingTarget', () => {
  it('is true for the form controls and false for a button', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const button = document.createElement('button');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('useStudioHotkeys', () => {
  it('fires a bare key from the page and prevents its default', () => {
    const add = vi.fn();
    render(<Harness map={{ e: add }} />);
    const event = new KeyboardEvent('keydown', { key: 'e', cancelable: true, bubbles: true });
    document.dispatchEvent(event);
    expect(add).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a bare key alone while the author is typing', () => {
    const add = vi.fn();
    const { getByTestId } = render(<Harness map={{ e: add, space: add }} />);
    fireEvent.keyDown(getByTestId('box'), { key: 'e' });
    fireEvent.keyDown(getByTestId('box'), { key: ' ' });
    expect(add).not.toHaveBeenCalled();
  });

  it('still fires a modifier combination from inside a text box', () => {
    const undo = vi.fn();
    const { getByTestId } = render(<Harness map={{ 'mod+z': undo }} />);
    fireEvent.keyDown(getByTestId('box'), { key: 'z', metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('ignores an auto-repeating key', () => {
    const nudge = vi.fn();
    render(<Harness map={{ arrowright: nudge }} />);
    fireEvent.keyDown(document, { key: 'ArrowRight', repeat: true });
    expect(nudge).not.toHaveBeenCalled();
  });

  it('is silent while disabled - the form-open case', () => {
    const add = vi.fn();
    render(<Harness map={{ e: add }} enabled={false} />);
    fireEvent.keyDown(document, { key: 'e' });
    expect(add).not.toHaveBeenCalled();
  });
});
