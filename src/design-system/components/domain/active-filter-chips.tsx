import { Chip, Inline } from "../primitives.tsx";

export type ActiveFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export type ActiveFilterChipsProps = {
  filters: ActiveFilterChip[];
};

export function ActiveFilterChips(
  { filters }: ActiveFilterChipsProps,
) {
  return (
    <Inline gap={2}>
      {filters.map((filter) => (
        <Chip key={filter.id} onRemove={filter.onRemove}>{filter.label}</Chip>
      ))}
    </Inline>
  );
}
