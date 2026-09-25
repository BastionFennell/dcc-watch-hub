// @vitest-environment jsdom
/**
 * The hydration contract: the first render is the value the caller was given
 * (the server's), and the clock only starts after mount.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useNow } from './useNow';

function Probe({
  interval,
  initial,
  seen = [],
}: {
  interval: number;
  initial?: number;
  seen?: number[];
}) {
  const now = useNow(interval, initial);
  seen.push(now);
  return <span data-testid="now">{now}</span>;
}

afterEach(() => vi.useRealTimers());

describe('useNow', () => {
  it('renders the value it was given, then the real clock after mount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T17:00:00Z'));
    const clock = Date.parse('2026-10-10T17:00:00Z');
    const seen: number[] = [];
    render(<Probe interval={60_000} initial={1000} seen={seen} />);
    // The server's value is what the first render produced - that is the render
    // React compares against the prerendered HTML - and the clock only replaces
    // it once the effect has run.
    expect(seen[0]).toBe(1000);
    expect(seen.at(-1)).toBe(clock);
    expect(screen.getByTestId('now')).toHaveTextContent(String(clock));
  });

  it('ticks on the interval it was given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(<Probe interval={60_000} initial={0} />);
    expect(screen.getByTestId('now')).toHaveTextContent('0');
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByTestId('now')).toHaveTextContent('60000');
  });

  it('re-reads once and stops when the interval is zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    render(<Probe interval={0} initial={0} />);
    expect(screen.getByTestId('now')).toHaveTextContent('5000');
    act(() => vi.advanceTimersByTime(600_000));
    expect(screen.getByTestId('now')).toHaveTextContent('5000');
  });

  it('defaults to the current clock when no initial value is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(42_000);
    render(<Probe interval={0} />);
    expect(screen.getByTestId('now')).toHaveTextContent('42000');
  });
});
