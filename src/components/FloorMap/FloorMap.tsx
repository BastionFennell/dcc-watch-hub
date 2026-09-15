import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { MapCellsView, MapLabel } from '../../engine/selectors';
import { cellKey } from '../../engine/state';
import { copy } from '../../copy';
import styles from './FloorMap.module.css';

/** Buttons and keys step by ×1.5; the wheel is continuous. Zoom 1 is "fit". */
const ZOOM_STEP = 1.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
/** Wheel sensitivity: 100 px of wheel ≈ one 1.16× step, so a flick of a trackpad is gentle. */
const WHEEL_ZOOM_PER_PX = 0.0015;
/** Arrow keys nudge the map by this many grid cells. */
const ARROW_STEP_UNITS = 1;

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

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Soft clamp: the scaled grid may be dragged until half the viewport is empty
 * on any side, so a drag always answers — even at fit — without letting the map
 * vanish. Per axis the offset lives in `[min(0, view − grid·zoom) − view/2, view/2]`.
 */
function clampPan(pan: Pan, cols: number, rows: number, zoom: number): Pan {
  const minX = Math.min(0, cols - cols * zoom) - cols / 2;
  const minY = Math.min(0, rows - rows * zoom) - rows / 2;
  return {
    x: Math.min(cols / 2, Math.max(minX, pan.x)),
    y: Math.min(rows / 2, Math.max(minY, pan.y)),
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
 * Interaction model is a plain map: drag to pan at any zoom, wheel (or trackpad
 * pinch, which arrives as a wheel) and double-click zoom toward the pointer,
 * the buttons and `+`/`−` zoom toward the center, arrows nudge, `0`/Fit resets.
 *
 * Zoom and pan are viewer state, not overlay state: they live in local state and
 * reset on mount, which is what the panel gives us since it mounts the map fresh
 * every time it opens.
 */
export function FloorMap({ cells, recent, labels, floor }: FloorMapProps) {
  const { cols, rows, revealed, total } = cells;
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Pan>(NO_PAN);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  // Latest values for the native wheel listener, which is registered once.
  const viewRef = useRef({ zoom, pan, cols, rows });
  viewRef.current = { zoom, pan, cols, rows };

  const canZoomIn = zoom < MAX_ZOOM - 1e-6;
  const canZoomOut = zoom > MIN_ZOOM + 1e-6;
  const summary = copy.mapSummary(revealed.size, total, labels.length);

  /** The viewport box maps 1:1 onto the viewBox (its aspect ratio is cols/rows). */
  const unitsPerPx = useCallback((): number | null => {
    const element = viewportRef.current;
    if (element === null) return null;
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0)) return null;
    return cols / rect.width;
  }, [cols]);

  /** Pointer position in SVG units (before the scene transform), or the center. */
  const pointToUnits = useCallback(
    (clientX: number, clientY: number): Pan => {
      const element = viewportRef.current;
      const scale = unitsPerPx();
      if (element === null || scale === null) return { x: cols / 2, y: rows / 2 };
      const rect = element.getBoundingClientRect();
      return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
    },
    [cols, rows, unitsPerPx],
  );

  /**
   * Zoom so that the grid point under `anchor` (in viewport units) stays put:
   * `pan' = anchor − (anchor − pan) · (zoom' / zoom)`.
   */
  const zoomAt = useCallback(
    (nextZoom: number, anchor: Pan) => {
      const { zoom: current, pan: currentPan, cols: c, rows: r } = viewRef.current;
      const next = clampZoom(nextZoom);
      const ratio = next / current;
      const nextPan = {
        x: anchor.x - (anchor.x - currentPan.x) * ratio,
        y: anchor.y - (anchor.y - currentPan.y) * ratio,
      };
      setZoom(next);
      setPan(clampPan(nextPan, c, r, next));
    },
    [],
  );

  const center = useCallback((): Pan => ({ x: cols / 2, y: rows / 2 }), [cols, rows]);
  const zoomIn = useCallback(() => zoomAt(viewRef.current.zoom * ZOOM_STEP, center()), [center, zoomAt]);
  const zoomOut = useCallback(() => zoomAt(viewRef.current.zoom / ZOOM_STEP, center()), [center, zoomAt]);
  const fit = useCallback(() => {
    setZoom(MIN_ZOOM);
    setPan(NO_PAN);
  }, []);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const { cols: c, rows: r, zoom: z } = viewRef.current;
      setPan((current) => clampPan({ x: current.x + dx, y: current.y + dy }, c, r, z));
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          fit();
          break;
        case 'ArrowLeft':
          nudge(ARROW_STEP_UNITS, 0);
          break;
        case 'ArrowRight':
          nudge(-ARROW_STEP_UNITS, 0);
          break;
        case 'ArrowUp':
          nudge(0, ARROW_STEP_UNITS);
          break;
        case 'ArrowDown':
          nudge(0, -ARROW_STEP_UNITS);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [fit, nudge, zoomIn, zoomOut],
  );

  // Wheel zoom needs `preventDefault` (the panel body scrolls otherwise), which
  // React's passive wheel handler cannot do, so it is a native listener.
  useEffect(() => {
    const element = viewportRef.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(-delta * WHEEL_ZOOM_PER_PX);
      zoomAt(viewRef.current.zoom * factor, pointToUnits(event.clientX, event.clientY));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [pointToUnits, zoomAt]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      zoomAt(viewRef.current.zoom * ZOOM_STEP, pointToUnits(event.clientX, event.clientY));
    },
    [pointToUnits, zoomAt],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const element = viewportRef.current;
      const scale = unitsPerPx();
      if (element === null || scale === null) return;
      // A drag must not start a text selection on the labels (or anything behind).
      event.preventDefault();
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
        unitsPerPx: scale,
      };
      setDragging(true);
    },
    [pan, unitsPerPx],
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
      {/*
        How much of the floor the System has charted so far (review 0.4, T335).
        Visible, not only in the SVG's accessible name, and it says so plainly
        when the answer is "none yet".
      */}
      <p className={styles.count} data-testid="floormap-count">
        {copy.sectorsRevealed(revealed.size, total)}
        {revealed.size === 0 ? (
          <span className={styles.empty} data-testid="floormap-empty">
            {copy.mapEmpty}
          </span>
        ) : null}
      </p>

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
        <span className={styles.zoomReadout} aria-live="polite" data-testid="floormap-zoom">
          {copy.mapZoomReadout(zoom)}
        </span>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        // A focusable box needs a name and a role of its own; the `<svg>` inside
        // keeps the state summary, this says what the keys do (T131).
        role="group"
        aria-label={copy.mapViewportLabel}
        data-testid="floormap-viewport"
        data-dragging={dragging ? 'true' : undefined}
        style={{ aspectRatio: `${cols} / ${rows}` } as CSSProperties}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
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
            transform={`translate(${round(pan.x)} ${round(pan.y)}) scale(${round(zoom)})`}
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

      <p className={styles.hint}>{copy.mapPointerHint}</p>

      <ul className="sr-only" data-testid="floormap-label-list">
        {labels.map((label) => (
          <li key={label.label}>{label.label}</li>
        ))}
      </ul>
    </div>
  );
}

export default FloorMap;
