export type DayAddComposeKind = 'checklist' | 'journal' | null;

export function dayAddSheetCopy(compose: DayAddComposeKind): {
  title: string;
  subtitle?: string;
} {
  if (compose === 'checklist') {
    return {
      title: 'Add Checklist Item',
      subtitle: 'Saved to your To Do list.',
    };
  }
  if (compose === 'journal') {
    return {
      title: 'Add Journal Line',
      subtitle: 'Appended to today’s journal page.',
    };
  }
  return { title: 'Add to Today' };
}
