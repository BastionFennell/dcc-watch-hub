// @vitest-environment jsdom
/**
 * T1019 - the widgets behind the switch (T1014).
 *
 * Each case drives `FieldInput` the way the form does - a spec, a value, a
 * change handler, the options `optionsFor` would have returned - so what is
 * asserted is the contract the form relies on, not a component internal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { studioCopy } from '../../copy';
import type { FieldSpec, FieldValue } from '../../eventForms';
import type { Option } from '../../options';
import { FieldInput } from './FieldInput';

afterEach(cleanup);

/** The form owns the value; this is that, in miniature. */
function Harness({
  field,
  options = [],
  initial,
  onChange,
}: {
  field: FieldSpec;
  options?: Option[];
  initial?: FieldValue;
  onChange?: (value: FieldValue) => void;
}) {
  const [value, setValue] = useState<FieldValue>(initial);
  return (
    <FieldInput
      field={field}
      id={`test-${field.key}`}
      value={value}
      options={options}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('text and number fields', () => {
  it('offers suggestions through a datalist without closing the box', () => {
    render(
      <Harness
        field={{ key: 'item', kind: 'text', label: 'Item', entryKind: 'gear' }}
        options={[{ value: 'Crowbar', label: 'Crowbar', hint: 'hands' }]}
      />,
    );
    const input = screen.getByTestId('field-item');
    expect(input).toHaveAttribute('list', 'test-item-list');
    const suggestions = screen.getByTestId('suggestions-item').querySelectorAll('option');
    expect(Array.from(suggestions).map((option) => option.value)).toEqual(['Crowbar']);
    fireEvent.change(input, { target: { value: 'Something else' } });
    expect(input).toHaveValue('Something else');
  });

  it('keeps a number a number, with the table minimum on the input', () => {
    const onChange = vi.fn();
    render(
      <Harness field={{ key: 'max', kind: 'int', label: 'Max HP', min: 1 }} onChange={onChange} />,
    );
    const input = screen.getByTestId('field-max');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('step', '1');
    fireEvent.change(input, { target: { value: '22' } });
    expect(onChange).toHaveBeenCalledWith('22');
  });

  it('writes prose into a textarea', () => {
    render(<Harness field={{ key: 'text', kind: 'longtext', label: 'Message' }} />);
    expect(screen.getByTestId('field-text').tagName).toBe('TEXTAREA');
  });
});

describe('closed sets', () => {
  const actor: FieldSpec = { key: 'actor', kind: 'actor', label: 'Crawler', required: true };

  it('offers the party and nothing else', () => {
    const onChange = vi.fn();
    render(
      <Harness
        field={actor}
        options={[
          { value: 'harry', label: 'Harry', hint: 'Princess Donut' },
          { value: 'xo', label: 'X.O.' },
        ]}
        onChange={onChange}
      />,
    );
    const select = screen.getByTestId('field-actor') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'harry', 'xo']);
    fireEvent.change(select, { target: { value: 'xo' } });
    expect(onChange).toHaveBeenCalledWith('xo');
  });

  it('says so when there is no party to choose from', () => {
    render(<Harness field={actor} />);
    expect(screen.getByText(studioCopy.fields.noActors)).toBeInTheDocument();
  });

  it('keeps a value the options no longer carry', () => {
    render(
      <Harness
        field={{ key: 'ref', kind: 'spellRef', label: 'Registry spell' }}
        options={[{ value: 'heal', label: 'Heal' }]}
        initial="gone"
      />,
    );
    expect(screen.getByTestId('field-ref')).toHaveValue('gone');
  });
});

describe('entryAdd', () => {
  const field: FieldSpec = { key: 'add', kind: 'entryAdd', label: 'Add', required: true };

  it('turns Enter into a chip and Backspace back into nothing', () => {
    const onChange = vi.fn();
    render(<Harness field={field} onChange={onChange} />);
    const input = screen.getByTestId('field-add');

    fireEvent.change(input, { target: { value: 'Crowbar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['Crowbar']);
    expect(input).toHaveValue('');
    expect(within(screen.getByTestId('chips-add')).getByText('Crowbar')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Torch' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['Crowbar', 'Torch']);

    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChange).toHaveBeenLastCalledWith(['Crowbar']);
  });

  it('ignores a name it already carries, and removes one by its button', () => {
    const onChange = vi.fn();
    render(<Harness field={field} initial={['Crowbar']} onChange={onChange} />);
    const input = screen.getByTestId('field-add');
    fireEvent.change(input, { target: { value: 'Crowbar' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(studioCopy.fields.entryRemoveLabel('Crowbar')));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe('entryRemove and factRefs', () => {
  const field: FieldSpec = {
    key: 'remove',
    kind: 'entryRemove',
    label: 'Remove',
    required: true,
    entryKind: 'inventory',
  };

  it('checks off what the crawler actually holds', () => {
    const onChange = vi.fn();
    render(
      <Harness
        field={field}
        options={[
          { value: 'Crowbar', label: 'Crowbar', hint: '×1' },
          { value: 'Torch', label: 'Torch' },
        ]}
        onChange={onChange}
      />,
    );
    const boxes = within(screen.getByTestId('field-remove')).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[1]);
    expect(onChange).toHaveBeenLastCalledWith(['Torch']);
    fireEvent.click(boxes[1]);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('keeps a name the event carries even when the state has lost it', () => {
    render(<Harness field={field} options={[]} initial={['Ghost Item']} />);
    const box = within(screen.getByTestId('field-remove')).getByRole('checkbox');
    expect(box).toBeChecked();
  });

  it('says there is nothing to remove rather than showing an empty box', () => {
    render(<Harness field={field} />);
    expect(screen.getByTestId('empty-remove')).toHaveTextContent(studioCopy.fields.nothingToRemove);
  });

  it('asks for the entity before its facts', () => {
    render(<Harness field={{ key: 'unlock', kind: 'factRefs', label: 'Unlock facts' }} />);
    expect(screen.getByTestId('empty-unlock')).toHaveTextContent(studioCopy.fields.noFacts);
  });
});

describe('cells', () => {
  const field: FieldSpec = { key: 'cells', kind: 'cells', label: 'Cells', required: true };

  it('adds a row and column pair, and takes it back', () => {
    const onChange = vi.fn();
    render(<Harness field={field} onChange={onChange} />);
    const input = screen.getByTestId('field-cells');
    fireEvent.change(input, { target: { value: '3, 4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith([[3, 4]]);
    expect(input).toHaveValue('');

    fireEvent.click(screen.getByLabelText(studioCopy.fields.cellRemoveLabel(3, 4)));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('refuses anything that is not a pair', () => {
    const onChange = vi.fn();
    render(<Harness field={field} onChange={onChange} />);
    const input = screen.getByTestId('field-cells');
    fireEvent.change(input, { target: { value: 'over there' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(studioCopy.fields.cellInvalid)).toBeInTheDocument();
  });

  it('ignores a cell it already carries', () => {
    const onChange = vi.fn();
    render(<Harness field={field} initial={[[3, 4]]} onChange={onChange} />);
    const input = screen.getByTestId('field-cells');
    fireEvent.change(input, { target: { value: '3 4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
