// @vitest-environment jsdom
/**
 * The phone tab strip (006 T604/T605, research R2/R5). The widget is checked
 * through the ARIA it exposes - roles, `aria-selected`, roving `tabIndex` - so
 * these assertions are the same ones assistive tech makes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MobileTabs, SWIPE_PX } from './MobileTabs';
import type { TabId } from './MobileTabs';
import { copy } from '../../copy';

afterEach(cleanup);

const tabs = [
  { id: 'feed' as const, label: copy.tabFeed, content: <p>feed pane</p> },
  { id: 'party' as const, label: copy.tabParty, content: <p>party pane</p> },
  { id: 'map' as const, label: copy.tabMap, content: <p>map pane</p> },
  { id: 'log' as const, label: copy.tabLog, content: <p>log pane</p> },
];

function renderTabs(initial?: TabId) {
  const onChange = vi.fn();
  const view = render(<MobileTabs tabs={tabs} initial={initial} onChange={onChange} />);
  return { ...view, onChange };
}

const tab = (id: TabId) => screen.getByTestId(`tab-${id}`);
const panel = (id: TabId) => screen.getByTestId(`tabpanel-${id}`);

/** The selected tab, by the attribute the widget publishes. */
function selected(): string | null {
  const open = screen.getAllByRole('tab').find((node) => node.getAttribute('aria-selected') === 'true');
  return open?.textContent ?? null;
}

/** jsdom has no `PointerEvent`; a bubbling MouseEvent carries the fields React reads. */
function firePointerOn(target: Element, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  fireEvent(target, event);
}

function firePointer(type: string, clientX: number, clientY: number) {
  firePointerOn(screen.getByTestId('mobile-tabpanels'), type, clientX, clientY);
}

/** One whole gesture: down at the origin, move by (dx, dy), up. */
function swipe(dx: number, dy = 0) {
  firePointer('pointerdown', 200, 300);
  firePointer('pointermove', 200 + dx, 300 + dy);
  firePointer('pointerup', 200 + dx, 300 + dy);
}

describe('MobileTabs', () => {
  it('renders a named tablist with one tab and one panel per pane', () => {
    renderTabs();
    const list = screen.getByTestId('mobile-tabs');
    expect(list).toHaveAttribute('role', 'tablist');
    expect(list).toHaveAttribute('aria-label', copy.tabsLabel);
    // The strip is the sticky bar the docked mini-player is positioned under
    // (T611); jsdom cannot compute the rule, so the class it hangs on is what
    // is asserted here and the geometry is measured in the 006 Results.
    expect(list.className).toMatch(/strip/);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const entry of tabs) {
      expect(tab(entry.id)).toHaveAttribute('aria-controls', `tabpanel-${entry.id}`);
      expect(tab(entry.id)).toHaveAttribute('id', `tab-${entry.id}`);
      expect(panel(entry.id)).toHaveAttribute('role', 'tabpanel');
      expect(panel(entry.id)).toHaveAttribute('aria-labelledby', `tab-${entry.id}`);
      expect(panel(entry.id)).toHaveAttribute('tabindex', '0');
    }
  });

  it('opens the first pane by default and the named one when asked', () => {
    const { unmount } = renderTabs();
    expect(tab('feed')).toHaveAttribute('aria-selected', 'true');
    unmount();
    renderTabs('map');
    expect(tab('map')).toHaveAttribute('aria-selected', 'true');
    expect(tab('feed')).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps every panel mounted and toggles `hidden` instead', () => {
    renderTabs();
    // All four are in the tree whichever one is open, so the log's follow state
    // and the map's zoom survive a switch (research R2).
    expect(screen.getByText('log pane')).toBeInTheDocument();
    expect(panel('feed')).not.toHaveAttribute('hidden');
    expect(panel('log')).toHaveAttribute('hidden');

    fireEvent.click(tab('log'));
    expect(screen.getByText('feed pane')).toBeInTheDocument();
    expect(panel('feed')).toHaveAttribute('hidden');
    expect(panel('log')).not.toHaveAttribute('hidden');
  });

  it('switches on click and reports the change once', () => {
    const { onChange } = renderTabs();
    fireEvent.click(tab('party'));
    expect(selected()).toBe(copy.tabParty);
    expect(onChange).toHaveBeenCalledWith('party');
    // Re-tapping the open tab is not a change.
    fireEvent.click(tab('party'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('gives the strip a single tab stop that follows the selection', () => {
    renderTabs();
    expect(tab('feed')).toHaveAttribute('tabindex', '0');
    expect(tab('party')).toHaveAttribute('tabindex', '-1');
    fireEvent.click(tab('map'));
    expect(tab('map')).toHaveAttribute('tabindex', '0');
    expect(tab('feed')).toHaveAttribute('tabindex', '-1');
  });

  it('moves and activates with ArrowRight, wrapping at the end', () => {
    const { onChange } = renderTabs('log');
    tab('log').focus();
    fireEvent.keyDown(tab('log'), { key: 'ArrowRight' });
    expect(selected()).toBe(copy.tabFeed);
    expect(document.activeElement).toBe(tab('feed'));
    expect(onChange).toHaveBeenLastCalledWith('feed');
  });

  it('moves and activates with ArrowLeft, wrapping at the start', () => {
    renderTabs();
    tab('feed').focus();
    fireEvent.keyDown(tab('feed'), { key: 'ArrowLeft' });
    expect(selected()).toBe(copy.tabLog);
    expect(document.activeElement).toBe(tab('log'));
  });

  it('jumps to the ends with Home and End', () => {
    renderTabs('party');
    fireEvent.keyDown(tab('party'), { key: 'End' });
    expect(selected()).toBe(copy.tabLog);
    expect(document.activeElement).toBe(tab('log'));
    fireEvent.keyDown(tab('log'), { key: 'Home' });
    expect(selected()).toBe(copy.tabFeed);
    expect(document.activeElement).toBe(tab('feed'));
  });

  it('ignores keys that are not tab navigation', () => {
    const { onChange } = renderTabs();
    fireEvent.keyDown(tab('feed'), { key: 'ArrowDown' });
    fireEvent.keyDown(tab('feed'), { key: 'a' });
    expect(selected()).toBe(copy.tabFeed);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('swipes left to the next pane and right to the previous one', () => {
    const { onChange } = renderTabs('party');
    swipe(-(SWIPE_PX + 20));
    expect(selected()).toBe(copy.tabMap);
    expect(onChange).toHaveBeenLastCalledWith('map');
    swipe(SWIPE_PX + 20);
    expect(selected()).toBe(copy.tabParty);
    expect(onChange).toHaveBeenLastCalledWith('party');
  });

  it('switches once per gesture, however far the finger travels', () => {
    const { onChange } = renderTabs();
    firePointer('pointerdown', 200, 300);
    firePointer('pointermove', 100, 300);
    firePointer('pointermove', 20, 300);
    firePointer('pointerup', 20, 300);
    expect(selected()).toBe(copy.tabParty);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not wrap at either end of the strip', () => {
    const { onChange } = renderTabs();
    swipe(SWIPE_PX + 20);
    expect(selected()).toBe(copy.tabFeed);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a short drag and a mostly vertical one', () => {
    const { onChange } = renderTabs();
    // Under the 40 px threshold: a tap or a jitter, not a swipe.
    swipe(-(SWIPE_PX - 10));
    expect(selected()).toBe(copy.tabFeed);
    // Long but steep: the page is scrolling (2:1 ratio, FR-502).
    swipe(-80, 60);
    expect(selected()).toBe(copy.tabFeed);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a gesture alone when it starts inside a `data-swipe-ignore` pane', () => {
    // The map pane drags to pan (FloorMap's viewport): that drag is the map's,
    // not the strip's, so it must not also flick to the next tab.
    const onChange = vi.fn();
    render(
      <MobileTabs
        tabs={[
          tabs[0],
          {
            id: 'map' as const,
            label: copy.tabMap,
            content: (
              <div data-swipe-ignore="" data-testid="pan-surface">
                <span data-testid="pan-child">map</span>
              </div>
            ),
          },
        ]}
        initial="map"
        onChange={onChange}
      />,
    );
    const child = screen.getByTestId('pan-child');
    firePointerOn(child, 'pointerdown', 200, 300);
    firePointerOn(child, 'pointermove', 200 - (SWIPE_PX + 60), 300);
    firePointerOn(child, 'pointerup', 200 - (SWIPE_PX + 60), 300);
    expect(screen.getByTestId('tab-map')).toHaveAttribute('aria-selected', 'true');
    expect(onChange).not.toHaveBeenCalled();
    // The same swipe starting on the pane's own background still switches.
    firePointer('pointerdown', 200, 300);
    firePointer('pointermove', 200 + SWIPE_PX + 60, 300);
    firePointer('pointerup', 200 + SWIPE_PX + 60, 300);
    expect(screen.getByTestId('tab-feed')).toHaveAttribute('aria-selected', 'true');
  });

  it('drops a gesture that is cancelled', () => {
    renderTabs();
    firePointer('pointerdown', 200, 300);
    firePointer('pointercancel', 200, 300);
    firePointer('pointermove', 20, 300);
    expect(selected()).toBe(copy.tabFeed);
  });
});
