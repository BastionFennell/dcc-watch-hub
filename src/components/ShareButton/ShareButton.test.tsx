// @vitest-environment jsdom
/** T406 — the share control (FR-302/303). */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { copy } from '../../copy';
import { ShareButton } from './ShareButton';

describe('ShareButton', () => {
  it('names itself in the System voice by default', () => {
    render(<ShareButton onClick={() => {}} testId="share-moment" />);
    const button = screen.getByTestId('share-moment');
    expect(button).toHaveAccessibleName(copy.shareMoment);
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('takes the row label when it belongs to a feed row', () => {
    render(<ShareButton onClick={() => {}} label={copy.shareRow('2:34')} testId="share-row" />);
    expect(screen.getByTestId('share-row')).toHaveAccessibleName(copy.shareRow('2:34'));
  });

  it('carries no visible text of its own', () => {
    render(<ShareButton onClick={() => {}} testId="share-moment" />);
    expect(screen.getByTestId('share-moment')).toHaveTextContent('');
  });

  it('calls back on click', () => {
    const onClick = vi.fn();
    render(<ShareButton onClick={onClick} testId="share-moment" />);
    fireEvent.click(screen.getByTestId('share-moment'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not let the click reach a surrounding handler (FR-303)', () => {
    const onClick = vi.fn();
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <ShareButton onClick={onClick} testId="share-row" />
      </div>,
    );
    fireEvent.click(screen.getByTestId('share-row'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
