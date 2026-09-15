import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { MapCellsView, MapLabel } from '../../engine/selectors';
import { cellKey } from '../../engine/state';
import { copy } from '../../copy';
import styles from './FloorMap.module.css';

/** ×1.5 steps (research R5). Index 0 is "fit"; index 4 is the ceiling. */
const ZOOM_STEPS = [1, 1.5, 2.25, 3.375, 5] as const;

/** Each cell is drawn 0.92 units square inside its 1×1 grid slot. */
const CELL_INSET = 0.04;
const CELL_SIZE = 1 - CELL_INSET * 2;

interface Pan {
  x: number;
  y: number;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startPan: Pan;
  /** SVG user units per CSS pixel, from the viewport box and the viewBox. */
  unitsPerPx: number;
}

const NO_PAN: Pan = { x: 0, y: 0 };

/** Keeps transform strings short and makes `translate(0 0)` exact. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Pan is clamped so the scaled grid never leaves the view: per axis the offset
 * lives in `[min(0, view − grid × zoom), 0]`, which collapses to `0` at zoom 1.
 */
function clampPan(pan: Pan, cols: number, rows: number, zoom: number): Pan {
  const minX = Math.min(0, cols - cols * zoom);
  const minY = Math.min(0, rows - rows * zoom);
  return {
    x: Math.min(0, Math.max(minX, pan.x)),
    y: Math.min(0, Math.max(minY, pan.y)),
  };
}

export interface FloorMapProps {
  /** `mapCells(state)` — grid shape and the revealed set as of the playhead. */
  cells: MapCellsView;
  /** `recentlyRevealed(events, t)` — cells revealed in the last 5 s (FR-120). */
  recent: Set<string>;
  /** `mapLabels(events, t)` — one entry per named neighborhood, at its centroid. */
  labels: MapLabel[];
  /** The floor being drawn; the panel header renders the title, not this component. */
  floor: number;
}

/**
 * The expanded floor map (FR-120/FR-121). One SVG per grid, zoom and pan applied
 * as a transform on a single `<g>` so the DOM stays static from tick to tick.
 *
 * Zoom and pan are viewer state, not overlay state: they live in local state and
 * reset on mount, which is what the panel gives us since it mounts the map fresh
 * every time it opens.
 */
export function FloorMap({ cells, recent, labels, floor }: FloorMapProps) {
  const { cols, rows, revealed, total } = cells;
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pan, setPan] = useState<Pan>(NO_PAN);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const zoom = ZOOM_STEPS[zoomIndex];
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1;
  const canZoomOut = zoomIndex > 0;
  const summary = copy.mapSummary(revealed.size, total, labels.length);

  const zoomTo = useCallback(
    (nextIndex: number) => {
      const index = Math.min(ZOOM_STEPS.length - 1, Math.max(0, nextIndex));
      setZoomIndex(index);
      setPan((current) => clampPan(current, cols, rows, ZOOM_STEPS[index]));
    },
    [cols, rows],
  );

  const zoomIn = useCallback(() => zoomTo(zoomIndex + 1), [zoomIndex, zoomTo]);
  const zoomOut = useCallback(() => zoomTo(zoomIndex - 1), [zoomIndex, zoomTo]);
  const fit = useCallback(() => {
    setZoomIndex(0);
    setPan(NO_PAN);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn();
      } else if (event.key === '-') {
        event.preventDefault();
        zoomOut();
      } else if (event.key === '0') {
        event.preventDefault();
        fit();
      }
    },
    [fit, zoomIn, zoomOut],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (zoom <= 1) return;
      const element = viewportRef.current;
      if (element === null) return;
      const rect = element.getBoundingClientRect();
      // `xMidYMid meet` scales both axes by the same factor: the smaller fit.
      const pxPerUnit = Math.min(rect.width / cols, rect.height / rows);
      if (!(pxPerUnit > 0)) return;
      if (typeof element.setPointerCapture === 'function') {
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // Environments without a live pointer (jsdom) simply skip capture.
        }
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: pan,
        unitsPerPx: 1 / pxPerUnit,
      };
      setDragging(true);
    },
    [cols, pan, rows, zoom],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const next = {
        x: drag.startPan.x + (event.clientX - drag.startX) * drag.unitsPerPx,
        y: drag.startPan.y + (event.clientY - drag.startY) * drag.unitsPerPx,
      };
      setPan(clampPan(next, cols, rows, zoom));
    },
    [cols, rows, zoom],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const element = viewportRef.current;
    if (element !== null && typeof element.releasePointerCapture === 'function') {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already have been lost; nothing to release.
      }
    }
    dragRef.current = null;
    setDragging(false);
  }, []);

  return (
    <div className={styles.map} data-floor={floor} data-testid="floormap">
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          onClick={zoomIn}
          disabled={!canZoomIn}
          data-testid="floormap-zoom-in"
        >
          {copy.mapZoomIn}
        </button>
        <button
          type="button"
          className={styles.control}
          onClick={zoomOut}
          disabled={!canZoomOut}
          data-testid="floormap-zoom-out"
        >
          {copy.mapZoomOut}
        </button>
        <button type="button" className={styles.control} onClick={fit} data-testid="floormap-fit">
          {copy.mapFit}
        </button>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        data-testid="floormap-viewport"
        data-pannable={zoom > 1 ? 'true' : undefined}
        data-dragging={dragging ? 'true' : undefined}
        style={{ aspectRatio: `${cols} / ${rows}` } as CSSProperties}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${cols} ${rows}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={summary}
        >
          <g
            className={styles.scene}
            data-testid="floormap-scene"
            transform={`translate(${round(pan.x)} ${round(pan.y)}) scale(${zoom})`}
          >
            {Array.from({ length: cols * rows }, (_, index) => {
              const row = Math.floor(index / cols);
              const col = index % cols;
              const key = cellKey(row, col);
              const state = recent.has(key) ? 'recent' : revealed.has(key) ? 'revealed' : 'hidden';
              return (
                <rect
                  key={key}
                  className={styles.cell}
                  data-state={state}
                  data-testid="floormap-cell"
                  x={col + CELL_INSET}
                  y={row + CELL_INSET}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                />
              );
            })}
            {labels.map((label) => (
              <text
                key={label.label}
                className={styles.label}
                data-testid="floormap-label"
                x={label.col + 0.5}
                y={label.row + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {label.label}
              </text>
            ))}
          </g>
        </svg>
      </div>

      <ul className="sr-only" data-testid="floormap-label-list">
        {labels.map((label) => (
          <li key={label.label}>{label.label}</li>
        ))}
      </ul>
    </div>
  );
}

export default FloorMap;
