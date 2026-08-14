export type SearchableDropdownOption = {
  label: string;
  description?: string;
  searchText?: string;
};

export function filterDropdownOptions<T extends SearchableDropdownOption>(
  options: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...options];

  return options.filter((option) =>
    [option.label, option.description, option.searchText]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(needle)),
  );
}
