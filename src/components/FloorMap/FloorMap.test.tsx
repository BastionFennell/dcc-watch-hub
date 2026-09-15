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

  it('scales by 1.5 per zoom-in step toward the center and stops at the ceiling', () => {
    renderMap();
    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));
    // Anchored at the grid center (6, 4): pan = c − (c − 0)·zoom.
    expect(transform()).toBe('translate(-7.5 -5) scale(2.25)');
    expect(button(copy.mapZoomOut)).toBeEnabled();
    expect(screen.getByTestId('floormap-zoom')).toHaveTextContent('225%');

    fireEvent.click(button(copy.mapZoomIn));
    fireEvent.click(button(copy.mapZoomIn));
    expect(transform()).toContain('scale(5)');
    expect(button(copy.mapZoomIn)).toBeDisabled();
  });

  it('zooms toward the pointer on wheel and double-click', () => {
    renderMap();
    stubViewportBox(480, 320); // 40 px per unit
    // Wheel at the top-left corner keeps that corner fixed: pan stays 0.
    fireEvent.wheel(viewport(), { deltaY: -100, clientX: 0, clientY: 0 });
    const expectedZoom = Math.round(Math.exp(0.15) * 1000) / 1000;
    expect(transform()).toBe(`translate(0 0) scale(${expectedZoom})`);

    fireEvent.click(button(copy.mapFit));
    // Double-click at the center (240, 160) → unit (6, 4): zoom ×1.5 around it.
    fireEvent.doubleClick(viewport(), { clientX: 240, clientY: 160 });
    expect(transform()).toBe('translate(-3 -2) scale(1.5)');
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
    expect(transform()).toBe('translate(-3 -2) scale(1.5)');
    fireEvent.keyDown(viewport(), { key: '=' });
    expect(transform()).toBe('translate(-7.5 -5) scale(2.25)');
    fireEvent.keyDown(viewport(), { key: '-' });
    expect(transform()).toBe('translate(-3 -2) scale(1.5)');
    fireEvent.keyDown(viewport(), { key: 'ArrowLeft' });
    expect(transform()).toBe('translate(-2 -2) scale(1.5)');
    fireEvent.keyDown(viewport(), { key: '0' });
    expect(transform()).toBe('translate(0 0) scale(1)');
  });

  it('pans by the dragged distance in SVG units and soft-clamps at half a view', () => {
    renderMap();
    stubViewportBox(480, 320); // 40 px per SVG unit on both axes
    fireEvent.click(button(copy.mapFit)); // start from a known pan of 0 at zoom 1
    fireEvent.keyDown(viewport(), { key: '+' }); // 1.5, pan (-3, -2)

    firePointer('pointerdown', 200, 200);
    firePointer('pointermove', 120, 140); // −80 px, −60 px → −2, −1.5 units
    expect(transform()).toBe('translate(-5 -3.5) scale(1.5)');

    // Dragging far past the origin stops once half the view would be empty: (+6, +4).
    firePointer('pointermove', 900, 900);
    expect(transform()).toBe('translate(6 4) scale(1.5)');
    firePointer('pointerup', 900, 900);

    // With the drag released, further movement does nothing.
    firePointer('pointermove', 100, 100);
    expect(transform()).toBe('translate(6 4) scale(1.5)');
  });

  it('pans even while fitted, so a drag always answers', () => {
    renderMap();
    stubViewportBox(480, 320);
    firePointer('pointerdown', 200, 200);
    firePointer('pointermove', 100, 100); // −100 px → −2.5 units on both axes
    expect(transform()).toBe('translate(-2.5 -2.5) scale(1)');
    firePointer('pointerup', 100, 100);
    fireEvent.click(button(copy.mapFit));
    expect(transform()).toBe('translate(0 0) scale(1)');
  });
});

describe('FloorMap header count (T335)', () => {
  it('says how many sectors are charted, visibly', () => {
    renderMap();
    expect(screen.getByTestId('floormap-count')).toHaveTextContent(
      copy.sectorsRevealed(5, COLS * ROWS),
    );
    expect(screen.queryByTestId('floormap-empty')).not.toBeInTheDocument();
  });

  it('says so plainly when nothing has been charted yet', () => {
    render(
      <FloorMap
        cells={{ ...cells, revealed: new Set<string>() }}
        recent={new Set<string>()}
        labels={[]}
        floor={6}
      />,
    );
    expect(screen.getByTestId('floormap-count')).toHaveTextContent(
      copy.sectorsRevealed(0, COLS * ROWS),
    );
    expect(screen.getByTestId('floormap-empty')).toHaveTextContent(copy.mapEmpty);
  });
});
