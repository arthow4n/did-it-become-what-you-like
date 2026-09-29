import type { ReactNode } from "react";
import type { ConflictJsonValue } from "../../domain/conflict/types.ts";

export type ConnectivityViewModel = "online" | "offline" | "reconnecting";

export type TechnicalDetailsViewModel = {
  readonly recordId: string;
  readonly groupId: string;
  readonly parentRevisionIds: readonly string[];
  readonly candidateRevisionIds?: readonly string[];
};

export type ConflictCandidateViewModel = {
  readonly id: string;
  readonly revisionId: string;
  readonly value?: ConflictJsonValue;
  readonly valueLabel?: ReactNode;
  readonly deleted: boolean;
  readonly deviceLabel: string;
  readonly recordedAt: string;
  readonly recordedAtLabel?: string;
};

export type ConflictChoice =
  | { readonly kind: "candidate"; readonly candidateId: string }
  | { readonly kind: "custom" }
  | { readonly kind: "keep-edited" }
  | { readonly kind: "delete" };

export type ConflictGroupViewModel = {
  readonly id: string;
  readonly recordLabel: string;
  readonly recordTypeLabel: string;
  readonly fieldLabel: string;
  readonly kind: "same-field" | "delete-versus-edit";
  readonly candidates: readonly ConflictCandidateViewModel[];
  readonly selectedChoice?: ConflictChoice;
  readonly customValue: string;
  readonly customValueError?: string;
  readonly discardedEditedValues?: readonly ConflictJsonValue[];
  readonly technicalDetails?: TechnicalDetailsViewModel;
};

export type ConflictWorkflowPhase =
  | "loading"
  | "reviewing"
  | "saving"
  | "error"
  | "completed";

export type ConflictReviewViewModel = {
  readonly phase: ConflictWorkflowPhase;
  readonly connectivity: ConnectivityViewModel;
  readonly groups: readonly ConflictGroupViewModel[];
  readonly activeGroupId: string | null;
  readonly pane: "list" | "detail";
  readonly completedCount: number;
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ConflictCandidateCardProps = {
  readonly candidate: ConflictCandidateViewModel;
  readonly ordinal: number;
  readonly selected: boolean;
  readonly interactive: boolean;
  readonly onChoose: () => void;
};

export type ConflictDetailProps = {
  readonly group: ConflictGroupViewModel;
  readonly phase: ConflictWorkflowPhase;
  readonly onChooseCandidate: (candidateId: string) => void;
  readonly onCustomValueChange: (value: string) => void;
  readonly onChooseCustom: (value: string) => void;
  readonly onKeepEdited: () => void;
  readonly onDeleteRecord: () => void;
  readonly onSubmit: () => void;
};

export type ConflictListProps = {
  readonly groups: readonly ConflictGroupViewModel[];
  readonly activeGroupId: string | null;
  readonly onOpenGroup: (groupId: string) => void;
};

export type ConflictReviewScreenProps = {
  readonly viewModel: ConflictReviewViewModel;
  readonly onBack: () => void;
  readonly onOpenGroup: (groupId: string) => void;
  readonly onShowList: () => void;
  readonly onChooseCandidate: (candidateId: string) => void;
  readonly onCustomValueChange: (value: string) => void;
  readonly onChooseCustom: (value: string) => void;
  readonly onKeepEdited: () => void;
  readonly onDeleteRecord: () => void;
  readonly onSubmit: () => void;
  readonly onRetry: () => void;
};

export type ExportDelivery = "download" | "share";
export type ExportWorkflowPhase =
  | "idle"
  | "preparing"
  | "delivering"
  | "completed"
  | "error";

export type ExportViewModel = {
  readonly phase: ExportWorkflowPhase;
  readonly shareAvailability: "available" | "unavailable";
  readonly delivery?: "downloaded" | "shared";
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ExportPanelProps = {
  readonly viewModel: ExportViewModel;
  readonly onExport: (delivery: ExportDelivery) => void;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
};

export type ImportPreviewViewModel = {
  readonly schemaVersion: number;
  readonly migration: "not-required" | "required";
  readonly projectCount: number;
  readonly categoryCount: number;
  readonly expenseCount: number;
  readonly receiptCount: number;
  readonly changeCount: number;
  readonly migrations: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
};

export type ImportPreviewProps = {
  readonly preview: ImportPreviewViewModel;
};

export type ImportMode = "merge" | "replace";

export type ImportModeChoiceProps = {
  readonly value: ImportMode | null;
  readonly disabled: boolean;
  readonly onChange: (mode: ImportMode) => void;
};

export type SafetyExportStatus =
  | "not-started"
  | "exporting"
  | "ready"
  | "error";
export type ReplacementConfirmation = "unconfirmed" | "confirmed";

export type SafetyExportStepProps = {
  readonly status: SafetyExportStatus;
  readonly confirmation: ReplacementConfirmation;
  readonly errorMessage?: string;
  readonly onExport: () => void;
  readonly onRetry: () => void;
  readonly onConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
};

export type ImportWorkflowPhase =
  | "idle"
  | "choosing"
  | "validating"
  | "preview"
  | "pre-syncing"
  | "saving"
  | "conflict"
  | "completed"
  | "error";

export type ImportViewModel = {
  readonly phase: ImportWorkflowPhase;
  readonly connectivity: ConnectivityViewModel;
  readonly drive: "configured" | "not-configured";
  readonly fileName?: string;
  readonly preview: ImportPreviewViewModel | null;
  readonly mode: ImportMode | null;
  readonly safetyExport: SafetyExportStatus;
  readonly safetyExportError?: string;
  readonly replacementConfirmation: ReplacementConfirmation;
  readonly conflictCount: number;
  readonly generation?: number;
  readonly error?: {
    readonly message: string;
    readonly retryable: boolean;
  };
};

export type ImportPanelProps = {
  readonly viewModel: ImportViewModel;
  readonly onFileSelected: (file: File) => void;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onSafetyExport: () => void;
  readonly onSafetyExportRetry: () => void;
  readonly onReplacementConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
  readonly onCommit: () => void;
  readonly onRetry: () => void;
  readonly onReviewConflicts: () => void;
  readonly onCancel: () => void;
};

export type ImportExportScreenProps = {
  readonly exportModel: ExportViewModel;
  readonly importModel: ImportViewModel;
  readonly onBack: () => void;
  readonly onExport: (delivery: ExportDelivery) => void;
  readonly onRetryExport: () => void;
  readonly onCancelExport: () => void;
  readonly onFileSelected: (file: File) => void;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onSafetyExport: () => void;
  readonly onSafetyExportRetry: () => void;
  readonly onReplacementConfirmationChange: (
    confirmation: ReplacementConfirmation,
  ) => void;
  readonly onCommit: () => void;
  readonly onRetryImport: () => void;
  readonly onReviewConflicts: () => void;
  readonly onCancelImport: () => void;
};

export function displayConflictValue(
  value: ConflictJsonValue | undefined,
): string {
  if (value === undefined || value === null) return "No value";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return "Multiple values";
  return "Structured value";
}
