import {
  Button,
  ContentContainer,
  List,
  ListRow,
  PageHeader,
  Stack,
  Text,
} from "../../design-system/index.ts";
export function SettingsScreen(
  {
    expenseDayBoundary,
    syncSummary,
    receiptSummary,
    onReceipt,
    onSync,
    onImport,
    onPrivacy,
    onPreferences,
    onAbout,
  }: {
    expenseDayBoundary: string;
    syncSummary?: string;
    receiptSummary?: string;
    onReceipt?: () => void;
    onSync?: () => void;
    onImport?: () => void;
    onPrivacy?: () => void;
    onPreferences?: () => void;
    onAbout?: () => void;
  },
) {
  const rows = [
    {
      label: "Google Drive and sync",
      summary: syncSummary,
      available: Boolean(onSync),
    },
    {
      label: "Receipt scanning",
      summary: receiptSummary,
      available: Boolean(onReceipt),
    },
    {
      label: "Preferences",
      summary: `Expense day ${expenseDayBoundary}`,
      available: Boolean(onPreferences),
    },
    {
      label: "Import and export",
      summary: undefined,
      available: Boolean(onImport),
    },
    {
      label: "Data and privacy",
      summary: undefined,
      available: Boolean(onPrivacy),
    },
    {
      label: "About and disclosure",
      summary: undefined,
      available: Boolean(onAbout),
    },
  ];
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader title="Settings" headingLevel={1} />
        <List label="Settings">
          {rows.map((row) => (
            <ListRow
              key={row.label}
              trailing={
                <Button
                  variant="quiet"
                  isDisabled={!row.available}
                  aria-label={"Open " + row.label}
                  onPress={row.label === "Receipt scanning"
                    ? onReceipt
                    : row.label === "Google Drive and sync"
                    ? onSync
                    : row.label === "Import and export"
                    ? onImport
                    : row.label === "Data and privacy"
                    ? onPrivacy
                    : row.label === "Preferences"
                    ? onPreferences
                    : row.label === "About and disclosure"
                    ? onAbout
                    : undefined}
                >
                  Open
                </Button>
              }
            >
              <Stack gap={1}>
                <strong>{row.label}</strong>
                {row.summary
                  ? <Text tone="secondary">{row.summary}</Text>
                  : null}
              </Stack>
            </ListRow>
          ))}
        </List>
      </Stack>
    </ContentContainer>
  );
}
