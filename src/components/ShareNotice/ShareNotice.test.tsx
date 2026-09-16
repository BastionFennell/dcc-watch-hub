// @vitest-environment jsdom
/** T406 — the share confirmation (FR-302/304, US2 scenarios 4 and 5). */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { copy } from '../../copy';
import { ShareNotice } from './ShareNotice';

const URL_ = 'http://localhost:3000/ep/1?t=156';

describe('ShareNotice', () => {
  it('is a polite live region that is present before it has anything to say', () => {
    render(<ShareNotice status="idle" url={null} onDismiss={() => {}} />);
    const region = screen.getByTestId('share-notice');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('data-status', 'idle');
    expect(region).toHaveTextContent('');
  });

  it('confirms a copy in the System voice', () => {
    render(<ShareNotice status="copied" url={URL_} onDismiss={() => {}} />);
    expect(screen.getByTestId('share-notice')).toHaveTextContent(copy.shareCopied);
    expect(screen.getByText(copy.systemTag)).toBeInTheDocument();
    // A copy needs no field: the link is already on the clipboard.
    expect(screen.queryByTestId('share-url')).not.toBeInTheDocument();
  });

  it('confirms a native share with the shorter line', () => {
    render(<ShareNotice status="shared" url={URL_} onDismiss={() => {}} />);
    expect(screen.getByTestId('share-notice')).toHaveTextContent(copy.shareShared);
    expect(screen.queryByTestId('share-url')).not.toBeInTheDocument();
  });

  it('offers the link, selected, when nothing could deliver it (FR-304)', () => {
    render(<ShareNotice status="shown" url={URL_} onDismiss={() => {}} />);
    expect(screen.getByTestId('share-notice')).toHaveTextContent(copy.shareShown);

    const field = screen.getByTestId('share-url') as HTMLInputElement;
    expect(field).toHaveValue(URL_);
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveAccessibleName(copy.shareUrlLabel);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(URL_.length);
  });

  it('re-selects when a second moment replaces the first', () => {
    const { rerender } = render(<ShareNotice status="shown" url={URL_} onDismiss={() => {}} />);
    const next = 'http://localhost:3000/ep/1?t=20';
    rerender(<ShareNotice status="shown" url={next} onDismiss={() => {}} />);

    const field = screen.getByTestId('share-url') as HTMLInputElement;
    expect(field).toHaveValue(next);
    expect(field.selectionEnd).toBe(next.length);
  });

  it('dismisses by hand', () => {
    const onDismiss = vi.fn();
    render(<ShareNotice status="shown" url={URL_} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('share-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no dismiss control when there is nothing to keep', () => {
    render(<ShareNotice status="copied" url={URL_} onDismiss={() => {}} />);
    expect(screen.queryByTestId('share-dismiss')).not.toBeInTheDocument();
  });
});
