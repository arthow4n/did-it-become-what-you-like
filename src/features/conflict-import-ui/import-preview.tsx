import {
  Card,
  DefinitionList,
  ErrorState,
  Heading,
  InlineNotice,
  List,
  ListRow,
  Stack,
  Text,
} from "../../design-system/index.ts";
import type { ImportPreviewProps } from "./types.ts";

export type { ImportPreviewProps };

export function ImportPreview({ preview }: ImportPreviewProps) {
  const counts = [
    { term: "Projects", description: String(preview.projectCount) },
    { term: "Categories", description: String(preview.categoryCount) },
    { term: "Expenses", description: String(preview.expenseCount) },
    { term: "Receipts", description: String(preview.receiptCount) },
    { term: "Changes", description: String(preview.changeCount) },
    {
      term: "Migrations",
      description: preview.migrations.length
        ? preview.migrations.join(", ")
        : "None",
    },
  ];
  return (
    <Card as="section" className="conflict-import-preview">
      <Stack gap={4}>
        <Stack gap={2}>
          <Heading level={2}>Validated JSON backup</Heading>
          <Text tone="secondary">
            Schema {preview.schemaVersion} · {preview.migration === "required"
              ? "migration required"
              : "no migration needed"}
          </Text>
        </Stack>
        <DefinitionList items={counts} />
        {preview.warnings.length
          ? (
            <InlineNotice tone="warning" title="Review these warnings">
              <List label="Import warnings">
                {preview.warnings.map((warning) => (
                  <ListRow key={warning}>{warning}</ListRow>
                ))}
              </List>
            </InlineNotice>
          )
          : null}
        {preview.errors.length
          ? (
            <ErrorState title="This backup cannot be imported">
              {preview.errors.join(" ")}
            </ErrorState>
          )
          : null}
      </Stack>
    </Card>
  );
}
