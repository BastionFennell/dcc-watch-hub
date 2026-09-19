// @vitest-environment jsdom
/**
 * 008 revision 2: the record's one explanation surface. Hover, keyboard focus
 * and click all reveal the same `role="tooltip"`; Escape and a click outside
 * hide it; and an entry with nothing to explain gets no button at all, so the
 * sheet never grows an affordance that leads nowhere.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

function setup(content?: string) {
  return render(
    <div>
      <Tooltip content={content} label="Heal, show details" testId="trigger">
        <span>Heal</span>
      </Tooltip>
      <button type="button">Elsewhere</button>
    </div>,
  );
}

const FULL = 'Heal (2 mana) - Rank 1, heal 2 HB slots.';

describe('Tooltip', () => {
  it('renders its trigger contents bare when there is nothing to explain', () => {
    setup();
    expect(screen.getByText('Heal')).toBeInTheDocument();
    expect(screen.queryByTestId('trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('gives the trigger a button role and no tooltip until it is asked', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows on hover and hides again on leave', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerEnter(trigger.parentElement as HTMLElement);
    expect(screen.getByTestId('tooltip')).toHaveTextContent(FULL);
    expect(screen.getByTestId('tooltip')).toHaveAttribute('role', 'tooltip');
    fireEvent.pointerLeave(trigger.parentElement as HTMLElement);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('describes the trigger while it is open', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    const tip = screen.getByTestId('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tip.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles on click', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows on keyboard focus and hides on blur', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.focus(trigger);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  // A pointer press focuses the button too; without the guard that focus would
  // open the tooltip and the click behind it would shut it again.
  it('does not let a pointer press double-toggle through focus', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerDown(trigger);
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('hides on Escape', () => {
    setup(FULL);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('hides on a click outside, and stays open for one inside', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    fireEvent.mouseDown(trigger);
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Elsewhere'));
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('flips below the trigger when there is no headroom', () => {
    setup(FULL);
    const trigger = screen.getByTestId('trigger');
    // jsdom measures everything at 0, which is exactly the no-headroom case.
    fireEvent.click(trigger);
    expect(screen.getByTestId('tooltip')).toHaveAttribute('data-placement', 'below');
  });
});
