// @vitest-environment jsdom
/**
 * Expanded floor map (T123, FR-120/FR-121). Everything here is a pure render of
 * the selectors the page will feed it, plus the viewer-only zoom/pan state.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FloorMap } from './FloorMap';
import { copy } from '../../copy';
import type { MapCellsView, MapLabel } from '../../engine/selectors';

const COLS = 12;
const ROWS = 8;

const cells: MapCellsView = {
  floor: 6,
  cols: COLS,
  rows: ROWS,
  revealed: new Set(['0,0', '0,1', '1,0', '3,4', '3,5']),
  total: COLS * ROWS,
};

const recent = new Set(['3,4', '3,5']);

const labels: MapLabel[] = [
  { label: 'The Meat District', row: 0.333, col: 0.333, cells: 3 },
  { label: 'The Rot Market', row: 3, col: 4.5, cells: 2 },
];

function renderMap() {
  return render(<FloorMap cells={cells} recent={recent} labels={labels} floor={6} />);
}

function scene(): SVGGElement {
  return screen.getByTestId('floormap-scene') as unknown as SVGGElement;
}

function transform(): string {
  return scene().getAttribute('transform') ?? '';
}

function viewport(): HTMLElement {
  return screen.getByTestId('floormap-viewport');
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

/** jsdom measures nothing, so the drag test supplies the box the pan math needs. */
function stubViewportBox(width: number, height: number) {
  viewport().getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height }) as DOMRect;
}

/** jsdom has no `PointerEvent`; a bubbling MouseEvent carries the same fields React reads. */
function firePointer(type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(viewport(), event);
}

describe('FloorMap', () => {
  it('renders one rect per grid cell', () => {
    renderMap();
    expect(screen.getAllByTestId('floormap-cell')).toHaveLength(COLS * ROWS);
  });

  it('marks cells hidden, revealed, or recent from the two sets', () => {
    renderMap();
    const rects = screen.getAllByTestId('floormap-cell');
    const states = rects.map((rect) => rect.getAttribute('data-state'));
    expect(states.filter((state) => state === 'recent')).toHaveLength(recent.size);
    // The two recent cells are also in `revealed`; the rest of that set stays plain.
    expect(states.filter((state) => state === 'revealed')).toHaveLength(
      cells.revealed.size - recent.size,
    );
    expect(states.filter((state) => state === 'hidden')).toHaveLength(
      COLS * ROWS - cells.revealed.size,
    );
    // Cell (0,0) is revealed but not recent; (3,4) is recent.
    expect(rects[0]).toHaveAttribute('data-state', 'revealed');
    expect(rects[3 * COLS + 4]).toHaveAttribute('data-state', 'recent');
  });

  it('draws one label per neighborhood at its centroid plus a half cell', () => {
    renderMap();
    const texts = screen.getAllByTestId('floormap-label');
    expect(texts).toHaveLength(2);
    expect(texts.map((text) => text.textContent)).toEqual([
      'The Meat District',
      'The Rot Market',
    ]);
    expect(texts[1]).toHaveAttribute('x', '5');
    expect(texts[1]).toHaveAttribute('y', '3.5');
    expect(texts[0]).toHaveAttribute('text-anchor', 'middle');
  });

  it('describes the whole map through the System summary copy', () => {
    renderMap();
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', copy.mapSummary(5, 96, 2));
    expect(svg.getAttribute('aria-label')).toContain('5 of 96');
    expect(svg.getAttribute('aria-label')).toContain('2 neighborhood');
  });

  it('lists the label names for assistive tech', () => {
    renderMap();
    const list = screen.getByTestId('floormap-label-list');
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(list).toHaveTextContent('The Rot Market');
  });

  it('starts fitted with zoom out disabled', () => {
    renderMap();
    expect(transform()).toBe('translate(0 0) scale(1)');
    expect(button(copy.mapZoomOut)).toBeDisabled();
    expect(button(copy.mapZoomIn)).toBeEnabled();
  });

  it('scales by 1.5 per zoom-in step and stops at the ceiling', () => {
    renderMap();
    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));
    expect(transform()).toBe('translate(0 0) scale(2.25)');
    expect(button(copy.mapZoomOut)).toBeEnabled();

    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));
    expect(transform()).toBe('translate(0 0) scale(5)');
    expect(button(copy.mapZoomIn)).toBeDisabled();
  });

  it('returns to a fitted, unpanned view on Fit', () => {
    renderMap();
    stubViewportBox(480, 320);
    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));
    firePointer('pointerdown', 200, 200);
    firePointer('pointermove', 120, 140);
    firePointer('pointerup', 120, 140);
    expect(transform()).not.toBe('translate(0 0) scale(1)');

    fireEvent.click(button(copy.mapFit));
    expect(transform()).toBe('translate(0 0) scale(1)');
  });

  it('zooms with + and refits with 0 from the keyboard', () => {
    renderMap();
    fireEvent.keyDown(viewport(), { key: '+' });
    expect(transform()).toBe('translate(0 0) scale(1.5)');
    fireEvent.keyDown(viewport(), { key: '=' });
    expect(transform()).toBe('translate(0 0) scale(2.25)');
    fireEvent.keyDown(viewport(), { key: '-' });
    expect(transform()).toBe('translate(0 0) scale(1.5)');
    fireEvent.keyDown(viewport(), { key: '0' });
    expect(transform()).toBe('translate(0 0) scale(1)');
  });

  it('pans by the dragged distance in SVG units and clamps at the edges', () => {
    renderMap();
    stubViewportBox(480, 320); // 40 px per SVG unit on both axes
    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));

    firePointer('pointerdown', 200, 200);
    firePointer('pointermove', 120, 140); // −80 px, −60 px → −2, −1.5 units
    expect(transform()).toBe('translate(-2 -1.5) scale(2.25)');

    // Dragging back past the origin clamps: pan never goes positive.
    firePointer('pointermove', 400, 400);
    expect(transform()).toBe('translate(0 0) scale(2.25)');
    firePointer('pointerup', 400, 400);

    // With the drag released, further movement does nothing.
    firePointer('pointermove', 100, 100);
    expect(transform()).toBe('translate(0 0) scale(2.25)');
  });

  it('does not pan while the map is fitted', () => {
    renderMap();
    stubViewportBox(480, 320);
    firePointer('pointerdown', 200, 200);
    firePointer('pointermove', 100, 100);
    expect(transform()).toBe('translate(0 0) scale(1)');
  });
});
