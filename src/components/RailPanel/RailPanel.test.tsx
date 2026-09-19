// @vitest-environment jsdom
/**
 * The rail panel's two presentations (T607). `'rail'` is the frame every earlier
 * feature renders - in place, no portal, no backdrop - and `'sheet'` is the phone
 * bottom sheet from 006 (FR-504, research R3): portalled to `document.body` over
 * a dim backdrop, dismissed by a downward drag past a quarter of its height.
 *
 * Escape, focus return and the `body.panel-open` scroll lock are `usePanel`'s
 * (tested in `usePanel.test.ts`); the sheet deliberately adds none of them.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RailPanel } from './RailPanel';
import type { RailPanelPresentation } from './RailPanel';
import { copy } from '../../copy';

function renderPanel(presentation?: RailPanelPresentation) {
  const onClose = vi.fn();
  const view = render(
    <RailPanel
      title="Harry Potter"
      kicker="CRAWLER DOSSIER"
      presentation={presentation}
      onClose={onClose}
    >
      <p>dossier body</p>
    </RailPanel>,
  );
  return { ...view, onClose };
}

/** jsdom has no `PointerEvent`; a bubbling MouseEvent carries the same fields React reads. */
function firePointer(target: Element, type: string, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
}

/** jsdom lays nothing out: the sheet's height has to be stated for the threshold. */
function stubSheetHeight(height: number) {
  const sheet = screen.getByTestId('rail-panel');
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 400,
    bottom: height,
    width: 400,
    height,
    toJSON: () => ({}),
  } as DOMRect);
  return sheet;
}

describe('RailPanel - rail presentation (unchanged)', () => {
  it('renders a labelled region in place with a close control', () => {
    const { container, onClose } = renderPanel();
    const panel = screen.getByTestId('rail-panel');
    expect(panel).toHaveAttribute('id', 'rail-panel');
    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAccessibleName('Harry Potter');
    expect(screen.getByTestId('rail-panel-body')).toHaveTextContent('dossier body');
    // In the tree it was rendered into, not in a portal on the body.
    expect(container).toContainElement(panel);

    fireEvent.click(screen.getByTestId('panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no sheet chrome and no presentation flag', () => {
    renderPanel('rail');
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sheet-handle')).not.toBeInTheDocument();
    expect(screen.getByTestId('rail-panel')).not.toHaveAttribute('data-presentation');
    expect(screen.queryByText(copy.sheetHandle)).not.toBeInTheDocument();
  });

  it('renders the same markup with or without the default prop', () => {
    const explicit = renderPanel('rail').container.innerHTML;
    const implicit = renderPanel().container.innerHTML;
    expect(implicit).toBe(explicit);
  });
});

describe('RailPanel - sheet presentation', () => {
  it('portals a backdrop, a handle and the same region to the body', () => {
    const { container } = renderPanel('sheet');
    const backdrop = screen.getByTestId('sheet-backdrop');
    const panel = screen.getByTestId('rail-panel');

    expect(container).toBeEmptyDOMElement();
    expect(backdrop.parentElement).toBe(document.body);
    expect(backdrop).toContainElement(panel);
    expect(screen.getByTestId('sheet-handle')).toHaveAttribute('role', 'presentation');
    expect(panel).toHaveAttribute('data-presentation', 'sheet');
    // Still the rail's one region, with its id, role, name, body and close control.
    expect(panel).toHaveAttribute('id', 'rail-panel');
    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAccessibleName('Harry Potter');
    expect(screen.getByTestId('rail-panel-body')).toHaveTextContent('dossier body');
    expect(screen.getByTestId('panel-close')).toBeInTheDocument();
    // The handle cannot be named, so the gesture is announced in the header.
    expect(screen.getByText(copy.sheetHandle)).toHaveClass('sr-only');
  });

  it('closes on the close control', () => {
    const { onClose } = renderPanel('sheet');
    fireEvent.click(screen.getByTestId('panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap on the dim area but not on a tap inside the sheet', () => {
    const { onClose } = renderPanel('sheet');
    fireEvent.click(screen.getByTestId('rail-panel-body'));
    fireEvent.click(screen.getByTestId('rail-panel'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the handle is dragged past a quarter of the sheet height', () => {
    const { onClose } = renderPanel('sheet');
    const sheet = stubSheetHeight(700);
    const handle = screen.getByTestId('sheet-handle');

    firePointer(handle, 'pointerdown', 100);
    firePointer(handle, 'pointermove', 300); // 200 px > 175 px
    expect(sheet).toHaveAttribute('data-dragging', 'true');
    expect(sheet.style.transform).toBe('translateY(200px)');

    firePointer(handle, 'pointerup', 300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('drags from the header too', () => {
    const { onClose } = renderPanel('sheet');
    stubSheetHeight(700);
    const header = screen.getByText('Harry Potter');

    firePointer(header, 'pointerdown', 100);
    firePointer(header, 'pointermove', 400);
    firePointer(header, 'pointerup', 400);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('snaps back and clears the transform when the drag falls short', () => {
    const { onClose } = renderPanel('sheet');
    const sheet = stubSheetHeight(700);
    const handle = screen.getByTestId('sheet-handle');

    firePointer(handle, 'pointerdown', 100);
    firePointer(handle, 'pointermove', 150); // 50 px < 175 px
    expect(sheet.style.transform).toBe('translateY(50px)');

    firePointer(handle, 'pointerup', 150);
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    expect(sheet).not.toHaveAttribute('data-dragging');
  });

  it('ignores an upward pull and never closes on one', () => {
    const { onClose } = renderPanel('sheet');
    const sheet = stubSheetHeight(700);
    const handle = screen.getByTestId('sheet-handle');

    firePointer(handle, 'pointerdown', 400);
    firePointer(handle, 'pointermove', 100); // −300 px
    expect(sheet.style.transform).toBe('');

    firePointer(handle, 'pointerup', 100);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not start a drag from the close control', () => {
    const { onClose } = renderPanel('sheet');
    const sheet = stubSheetHeight(700);
    const close = screen.getByTestId('panel-close');

    firePointer(close, 'pointerdown', 100);
    firePointer(close, 'pointermove', 500);
    expect(sheet).not.toHaveAttribute('data-dragging');
    expect(sheet.style.transform).toBe('');

    firePointer(close, 'pointerup', 500);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('drops a cancelled gesture without closing', () => {
    const { onClose } = renderPanel('sheet');
    const sheet = stubSheetHeight(700);
    const handle = screen.getByTestId('sheet-handle');

    firePointer(handle, 'pointerdown', 100);
    firePointer(handle, 'pointermove', 500);
    firePointer(handle, 'pointercancel', 500);
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    expect(sheet).not.toHaveAttribute('data-dragging');
  });
});
