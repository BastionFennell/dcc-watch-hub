// @vitest-environment jsdom
/**
 * The badge as the expanded map's trigger (T124, FR-104/FR-122 and
 * `contracts/panels.md`): button semantics, an accessible name from the System
 * copy, and a decorative grid that assistive tech never walks.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MiniMapBadge } from './MiniMapBadge';
import { copy } from '../../copy';
import type { MapCellsView } from '../../engine/selectors';

const cells: MapCellsView = {
  floor: 6,
  cols: 12,
  rows: 8,
  revealed: new Set(['0,0', '1,1']),
  total: 96,
};

describe('MiniMapBadge', () => {
  it('is a button named by the System invitation and described by the summary', () => {
    render(<MiniMapBadge cells={cells} recent={new Set()} />);
    const badge = screen.getByTestId('minimap-badge');
    expect(badge.tagName).toBe('BUTTON');
    expect(badge).toHaveAttribute('type', 'button');
    expect(badge).toHaveAttribute('data-panel-trigger', 'map');
    expect(badge).toHaveAttribute('aria-controls', 'rail-panel');
    expect(screen.getByRole('button', { name: copy.mapTriggerLabel(cells.floor) })).toBe(badge);

    const describedBy = badge.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)).toHaveTextContent(copy.sectorsRevealed(2, 96));
  });

  it('keeps the grid decorative and still renders one cell per sector', () => {
    render(<MiniMapBadge cells={cells} recent={new Set(['1,1'])} />);
    const cellNodes = screen.getAllByTestId('minimap-cell');
    expect(cellNodes).toHaveLength(96);
    expect(cellNodes[0].closest('[aria-hidden="true"]')).not.toBeNull();
    const states = cellNodes.map((cell) => cell.getAttribute('data-state'));
    expect(states.filter((state) => state === 'recent')).toHaveLength(1);
    expect(states.filter((state) => state === 'revealed')).toHaveLength(1);
  });

  it('reports its expanded state and hands the button back on activation', () => {
    const onActivate = vi.fn();
    const { rerender } = render(
      <MiniMapBadge cells={cells} recent={new Set()} expanded={false} onActivate={onActivate} />,
    );
    const badge = screen.getByTestId('minimap-badge');
    expect(badge).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(badge);
    expect(onActivate).toHaveBeenCalledWith(badge);

    rerender(
      <MiniMapBadge cells={cells} recent={new Set()} expanded onActivate={onActivate} />,
    );
    expect(screen.getByTestId('minimap-badge')).toHaveAttribute('aria-expanded', 'true');
  });

  it('survives the page not passing the v2 props yet (T125 wires them)', () => {
    render(<MiniMapBadge cells={cells} recent={new Set()} />);
    const badge = screen.getByTestId('minimap-badge');
    expect(badge).toHaveAttribute('aria-expanded', 'false');
    expect(() => fireEvent.click(badge)).not.toThrow();
  });
});
