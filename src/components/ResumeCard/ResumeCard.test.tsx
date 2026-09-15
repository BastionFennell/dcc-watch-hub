// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { copy } from '../../copy';
import { ResumeCard } from './ResumeCard';

describe('ResumeCard', () => {
  function setup(t = 120) {
    const onRejoin = vi.fn();
    const onStartOver = vi.fn();
    render(<ResumeCard t={t} onRejoin={onRejoin} onStartOver={onStartOver} />);
    return { onRejoin, onStartOver };
  }

  it('offers the saved time in System voice and focuses Rejoin', () => {
    setup(120);
    const card = screen.getByTestId('resume-card');

    expect(card).toHaveAttribute('role', 'dialog');
    expect(card).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByText(copy.resumeKicker)).toBeInTheDocument();
    expect(screen.getByText(copy.resumeTitle('2:00'))).toBeInTheDocument();
    expect(screen.getByText(copy.resumeBody)).toBeInTheDocument();

    const rejoin = screen.getByRole('button', { name: copy.resumeRejoin });
    expect(rejoin).toHaveFocus();
    expect(card).toHaveAccessibleName(copy.resumeTitle('2:00'));
    expect(card).toHaveAccessibleDescription(copy.resumeBody);
  });

  it('reports each choice', () => {
    const { onRejoin, onStartOver } = setup();

    fireEvent.click(screen.getByRole('button', { name: copy.resumeRejoin }));
    expect(onRejoin).toHaveBeenCalledTimes(1);
    expect(onStartOver).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: copy.resumeStartOver }));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as starting over', () => {
    const { onRejoin, onStartOver } = setup();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onStartOver).toHaveBeenCalledTimes(1);
    expect(onRejoin).not.toHaveBeenCalled();
  });
});
