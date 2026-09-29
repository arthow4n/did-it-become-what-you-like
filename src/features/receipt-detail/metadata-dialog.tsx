import type { ReceiptMetadataChanges } from "../../domain/index.ts";
import {
  AdaptiveDialog,
  Button,
  FormActions,
  InlineNotice,
  MoneyField,
  NativeDateField,
  NativeTimeField,
  Stack,
  TextField,
} from "../../design-system/index.ts";

export type ReceiptMetadataEditorDialogProps = {
  readonly isOpen: boolean;
  readonly isDismissable: boolean;
  readonly metadataDraft: ReceiptMetadataChanges | null;
  readonly currency: string;
  readonly mutationFailure: boolean;
  readonly errorMessage?: string;
  readonly canRetry: boolean;
  readonly canSave: boolean;
  readonly onChange: (changes: ReceiptMetadataChanges) => void;
  readonly onSave: () => void;
  readonly onRetry: () => void;
  readonly onReload: () => void;
  readonly onClose: () => void;
};

export function ReceiptMetadataEditorDialog({
  isOpen,
  isDismissable,
  metadataDraft,
  currency,
  mutationFailure,
  errorMessage,
  canRetry,
  canSave,
  onChange,
  onSave,
  onRetry,
  onReload,
  onClose,
}: ReceiptMetadataEditorDialogProps) {
  return (
    <AdaptiveDialog
      trigger={null}
      title="Edit receipt details"
      isOpen={isOpen}
      isDismissable={isDismissable}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {metadataDraft
        ? (
          <Stack gap={4}>
            <TextField
              autoFocus
              label="Merchant"
              placeholder="No merchant entered"
              description="Store, restaurant, or vendor name (optional)"
              value={metadataDraft.merchant ?? ""}
              onChange={(merchant) =>
                onChange({ ...metadataDraft, merchant: merchant || null })}
              isDisabled={mutationFailure}
            />
            <div className="local-ui-form-row local-ui-form-row--date-time">
              <NativeDateField
                label="Date"
                value={metadataDraft.date}
                onChange={(event) =>
                  onChange({
                    ...metadataDraft,
                    date: event.currentTarget.value,
                  })}
                disabled={mutationFailure}
              />
              <NativeTimeField
                label="Time (optional)"
                value={metadataDraft.time ?? ""}
                onChange={(event) =>
                  onChange({
                    ...metadataDraft,
                    time: event.currentTarget.value || null,
                  })}
                disabled={mutationFailure}
              />
            </div>
            <MoneyField
              label="Printed receipt total"
              currency={currency}
              value={metadataDraft.printedTotal}
              onChange={(printedTotal) =>
                onChange({
                  ...metadataDraft,
                  printedTotal,
                })}
              isDisabled={mutationFailure}
            />
            {mutationFailure
              ? (
                <InlineNotice tone="danger" title="Save failed">
                  {errorMessage ??
                    (canRetry
                      ? "Retry to save these receipt details."
                      : "Reload the receipt to discard this failed change.")}
                </InlineNotice>
              )
              : null}
            <FormActions>
              <Button variant="secondary" onPress={onClose}>
                Cancel
              </Button>
              {mutationFailure
                ? canRetry
                  ? (
                    <Button onPress={onRetry}>
                      Retry
                    </Button>
                  )
                  : (
                    <Button variant="secondary" onPress={onReload}>
                      Reload receipt
                    </Button>
                  )
                : (
                  <Button
                    isDisabled={!canSave}
                    onPress={onSave}
                  >
                    Save changes
                  </Button>
                )}
            </FormActions>
          </Stack>
        )
        : null}
    </AdaptiveDialog>
  );
}
