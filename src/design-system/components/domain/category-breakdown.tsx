import {
  Button,
  Heading,
  Inline,
  List,
  ListRow,
  MoneyText,
  Section,
} from "../primitives.tsx";

export type CategoryTotal = {
  id: string;
  name: string;
  amount: string;
  currency: string;
};

export type CategoryBreakdownProps = {
  categories: CategoryTotal[];
  onSelect?: (id: string) => void;
  onViewAll?: () => void;
};

export function CategoryBreakdown(
  { categories, onSelect, onViewAll }: CategoryBreakdownProps,
) {
  return (
    <Section>
      <Inline justify="space-between">
        <Heading size="sm">By category</Heading>
        {onViewAll
          ? <Button variant="quiet" onPress={onViewAll}>View all</Button>
          : null}
      </Inline>
      <List label="Category totals">
        {categories.map((category) => (
          <ListRow
            key={category.id}
            trailing={
              <MoneyText
                amount={category.amount}
                currency={category.currency}
              />
            }
          >
            <Button
              variant="quiet"
              onPress={() => onSelect?.(category.id)}
            >
              {category.name}
            </Button>
          </ListRow>
        ))}
      </List>
    </Section>
  );
}
