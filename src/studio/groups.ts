/**
 * What colour an event group is (010, T1022 / T1023).
 *
 * The timeline markers, the list's type chips and the filter chips all have to
 * agree, and they are three different components, so the mapping lives here on
 * its own. It reuses the viewer's marker tokens rather than inventing a second
 * palette (constitution: visual language).
 */
import type { FieldGroup } from './eventForms';
import { formFor } from './eventForms';

export const GROUP_COLORS: Record<FieldGroup, string> = {
  story: 'var(--marker-story)',
  crawler: 'var(--marker-achievement)',
  items: 'var(--marker-loot)',
  abilities: 'var(--marker-levelup)',
  world: 'var(--marker-boss)',
};

/** The group a type belongs to; a type this build does not know reads as story. */
export function groupOf(type: string): FieldGroup {
  return formFor(type)?.group ?? 'story';
}
