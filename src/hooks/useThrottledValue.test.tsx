// @vitest-environment jsdom
/**
 * The log count's cadence floor (005 T504, research R5).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useThrottledValue } from './useThrottledValue';

function Readout({ value }: { value: string }) {
  return <span data-testid="out">{useThrottledValue(value, 1000)}</span>;
}

const out = () => screen.getByTestId('out').textContent;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useThrottledValue', () => {
  it('shows the first value immediately, and the first change too', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Readout value="one" />);
    expect(out()).toBe('one');

    act(() => rerender(<Readout value="two" />));
    expect(out()).toBe('two');
  });

  it('holds later changes to one a second and always lands on the latest', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Readout value="one" />);
    act(() => rerender(<Readout value="two" />)); // immediate: opens the window

    act(() => rerender(<Readout value="three" />));
    expect(out()).toBe('two');
    act(() => rerender(<Readout value="four" />));
    expect(out()).toBe('two');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Not "three": the queue never plays back, only the truth of now.
    expect(out()).toBe('four');
  });

  it('is quiet when the value has not changed', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Readout value="one" />);
    act(() => rerender(<Readout value="one" />));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(out()).toBe('one');
  });
});
