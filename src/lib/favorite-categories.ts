import { categoryOptions } from "@/components/SidebarFilters";

export { MAX_CATEGORY_LENGTH } from "@/lib/category-constants";

export interface FavoriteCategoryOption {
  value: string;
  label: string;
}

// The 10 platform-native categories (used for search filtering) always show
// up first as suggestions. Anything else already saved on a favorite is a
// user-created category — freeform text, not part of that fixed set.
const defaultOptions: ReadonlyArray<FavoriteCategoryOption> =
  categoryOptions.map(({ id, label }) => ({ value: id, label }));
const defaultValues = new Set(defaultOptions.map((option) => option.value));

export function getFavoriteCategoryOptions(
  existingCategories: ReadonlyArray<string | null | undefined>
): FavoriteCategoryOption[] {
  const customs = new Set<string>();
  for (const category of existingCategories) {
    if (category && !defaultValues.has(category)) {
      customs.add(category);
    }
  }
  const sortedCustoms = [...customs].sort((a, b) => a.localeCompare(b));
  return [
    ...defaultOptions,
    ...sortedCustoms.map((value) => ({ value, label: value })),
  ];
}
