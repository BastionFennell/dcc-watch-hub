/**
 * One switch, fifteen widgets (010, T1014).
 *
 * `EventForm` never knows what a field looks like: it hands the spec, the value
 * and the options here and gets the right control back. A new `FieldKind` in
 * the table fails to compile until it has a case, which is the point.
 */
import type { FieldProps } from './shared';
import {
  ActorField,
  ChapterKindField,
  NpcRefField,
  RoomField,
  SelectField,
  SlotField,
  SpellRefField,
} from './ChoiceFields';
import { CellsField, EntryAddField, EntryRemoveField, FactRefsField } from './ListFields';
import { BoolField, IntField, LongTextField, TextField } from './TextFields';

export function FieldInput(props: FieldProps) {
  switch (props.field.kind) {
    case 'actor':
      return <ActorField {...props} />;
    case 'text':
      return <TextField {...props} />;
    case 'longtext':
      return <LongTextField {...props} />;
    case 'int':
      return <IntField {...props} />;
    case 'select':
      return <SelectField {...props} />;
    case 'bool':
      return <BoolField {...props} />;
    case 'spellRef':
      return <SpellRefField {...props} />;
    case 'npcRef':
      return <NpcRefField {...props} />;
    case 'slot':
      return <SlotField {...props} />;
    case 'room':
      return <RoomField {...props} />;
    case 'chapterKind':
      return <ChapterKindField {...props} />;
    case 'entryAdd':
      return <EntryAddField {...props} />;
    case 'entryRemove':
      return <EntryRemoveField {...props} />;
    case 'cells':
      return <CellsField {...props} />;
    case 'factRefs':
      return <FactRefsField {...props} />;
  }
}

export default FieldInput;
