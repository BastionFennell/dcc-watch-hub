// @vitest-environment jsdom
/**
 * T1019 - the type grid (T1015): filtering, Enter, the arrow keys, and the
 * type the author used last.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KNOWN_EVENT_TYPES } from '../../data/types';
import { TypePicker } from './TypePicker';

afterEach(cleanup);

function options(): HTMLButtonElement[] {
  return screen.getAllByTestId('type-option') as HTMLButtonElement[];
}

describe('TypePicker (T1015)', () => {
  it('offers every known event type, grouped', () => {
    render(<TypePicker onPick={() => undefined} />);
    expect(options()).toHaveLength(KNOWN_EVENT_TYPES.length);
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('Abilities')).toBeInTheDocument();
  });

  it('narrows as the author types', () => {
    render(<TypePicker onPick={() => undefined} />);
    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'spo' } });
    expect(options().map((button) => button.dataset.type)).toEqual(['sponsor']);
  });

  it('matches the raw type as well as the label', () => {
    render(<TypePicker onPick={() => undefined} />);
    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'map_reveal' } });
    expect(options().map((button) => button.dataset.type)).toEqual(['map_reveal']);
  });

  it('says so when nothing matches', () => {
    render(<TypePicker onPick={() => undefined} />);
    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('type-picker-empty')).toHaveTextContent('zzz');
  });

  it('picks the first match on Enter', () => {
    const onPick = vi.fn();
    render(<TypePicker onPick={onPick} />);
    const filter = screen.getByTestId('type-filter');
    fireEvent.change(filter, { target: { value: 'sp' } });
    fireEvent.keyDown(filter, { key: 'Enter' });
    // Story comes before Abilities in the table, so "sp" leads with the sponsor.
    expect(onPick).toHaveBeenCalledWith('sponsor');
  });

  it('moves across the grid with the arrow keys', () => {
    render(<TypePicker onPick={() => undefined} />);
    const all = options();
    all[0].focus();
    fireEvent.keyDown(all[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[4]);
    fireEvent.keyDown(all[4], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(all[0], { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it('drops into the grid from the filter', () => {
    render(<TypePicker onPick={() => undefined} />);
    fireEvent.keyDown(screen.getByTestId('type-filter'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options()[0]);
  });

  it('pre-highlights the remembered type and makes it the first tab stop', () => {
    render(<TypePicker value="loot" onPick={() => undefined} />);
    const loot = options().find((button) => button.dataset.type === 'loot')!;
    expect(loot.dataset.lastUsed).toBe('true');
    expect(loot).toHaveAttribute('tabindex', '0');
    expect(options().filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });

  it('picks on click', () => {
    const onPick = vi.fn();
    render(<TypePicker onPick={onPick} />);
    fireEvent.click(options().find((button) => button.dataset.type === 'note')!);
    expect(onPick).toHaveBeenCalledWith('note');
  });
});
