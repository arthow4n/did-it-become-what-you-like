import {
  Button,
  Inline,
  List,
  ListRow,
  Stack,
  Text,
} from "../../design-system/index.ts";
import type { ConflictListProps } from "./types.ts";

export type { ConflictListProps };

export function ConflictList({
  groups,
  activeGroupId,
  onOpenGroup,
}: ConflictListProps) {
  return (
    <List label="Unresolved conflicts" className="conflict-import-list">
      {groups.map((group, index) => (
        <ListRow key={group.id}>
          <Button
            variant="quiet"
            className="conflict-import-list__button"
            data-selected={activeGroupId === group.id ? "true" : undefined}
            aria-current={activeGroupId === group.id ? "true" : undefined}
            onPress={() => onOpenGroup(group.id)}
          >
            <Stack gap={1}>
              <Inline justify="space-between" gap={2}>
                <strong>{group.recordLabel}</strong>
                <Text size="label" tone="muted">{index + 1}</Text>
              </Inline>
              <Text size="label" tone="secondary">
                {group.fieldLabel} · {group.recordTypeLabel}
              </Text>
            </Stack>
          </Button>
        </ListRow>
      ))}
    </List>
  );
}
