import {
  Button,
  ContentContainer,
  Divider,
  PageHeader,
  Stack,
} from "../../design-system/index.ts";
import { ExportPanel } from "./export-panel.tsx";
import { ImportPanel } from "./import-panel.tsx";
import type { ImportExportScreenProps } from "./types.ts";

export type { ImportExportScreenProps };

export function ImportExportScreen({
  exportModel,
  importModel,
  onBack,
  onExport,
  onRetryExport,
  onCancelExport,
  onFileSelected,
  onModeChange,
  onSafetyExport,
  onSafetyExportRetry,
  onReplacementConfirmationChange,
  onCommit,
  onRetryImport,
  onReviewConflicts,
  onCancelImport,
}: ImportExportScreenProps) {
  return (
    <ContentContainer size="readable" className="conflict-import-ui">
      <Stack gap={5}>
        <PageHeader
          title="Import & export"
          headingLevel={1}
          leading={<Button variant="quiet" onPress={onBack}>Back</Button>}
        />
        <ExportPanel
          viewModel={exportModel}
          onExport={onExport}
          onRetry={onRetryExport}
          onCancel={onCancelExport}
        />
        <Divider />
        <ImportPanel
          viewModel={importModel}
          onFileSelected={onFileSelected}
          onModeChange={onModeChange}
          onSafetyExport={onSafetyExport}
          onSafetyExportRetry={onSafetyExportRetry}
          onReplacementConfirmationChange={onReplacementConfirmationChange}
          onCommit={onCommit}
          onRetry={onRetryImport}
          onReviewConflicts={onReviewConflicts}
          onCancel={onCancelImport}
        />
      </Stack>
    </ContentContainer>
  );
}
