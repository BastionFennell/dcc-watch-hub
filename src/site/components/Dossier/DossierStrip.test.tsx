// @vitest-environment jsdom
/**
 * The strip (012 T1212): three cells, and a lid on every one the reader has
 * not earned yet. The lid is the requirement - a dash or a zero would be a
 * statement, and the strip is not allowed to make one.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DossierStrip } from './DossierStrip';
import { siteCopy } from '../../copy';

const { dossier: copy } = siteCopy;

afterEach(cleanup);

describe('DossierStrip', () => {
  it('shows a labelled grey pill, and no text, for every unrevealed value', () => {
    render(<DossierStrip values={{ level: null, condition: null, lastOnCamera: null }} />);
    const pills = screen.getAllByLabelText(copy.hiddenValue);
    expect(pills).toHaveLength(3);
    for (const pill of pills) expect(pill).toHaveTextContent('');
    // The labels are always there; only the answers are hidden.
    for (const label of [copy.levelLabel, copy.conditionLabel, copy.lastOnCameraLabel]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('prints the revealed values as text: the level, the word, and "Ep N"', () => {
    render(<DossierStrip values={{ level: 7, condition: 'alive', lastOnCamera: 3 }} />);
    expect(screen.queryByLabelText(copy.hiddenValue)).toBeNull();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(copy.alive)).toBeInTheDocument();
    expect(screen.getByText(copy.lastOnCamera(3))).toBeInTheDocument();
  });

  it('lids the cells that have no answer while printing the ones that do', () => {
    render(<DossierStrip values={{ level: 2, condition: 'deceased', lastOnCamera: null }} />);
    expect(screen.getByText(copy.deceased)).toBeInTheDocument();
    expect(screen.getAllByLabelText(copy.hiddenValue)).toHaveLength(1);
  });
});
