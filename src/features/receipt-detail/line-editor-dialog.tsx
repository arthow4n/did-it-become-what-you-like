import {
  AdaptiveDialog,
  Button,
  FormActions,
  InlineNotice,
  ReceiptLineEditor,
  type ReceiptLineEditorValue,
  SelectOption,
  Stack,
} from "../../design-system/index.ts";

export type ReceiptLineEditorDialogProps = {
  readonly isOpen: boolean;
  readonly isDismissable: boolean;
  readonly isAdding: boolean;
  readonly value: ReceiptLineEditorValue | null;
  readonly categories: SelectOption[];
  readonly linkOptions: SelectOption[];
  readonly mutationFailure: boolean;
  readonly errorMessage?: string;
  readonly canRetry: boolean;
  readonly canSubmit: boolean;
  readonly onChange: (value: ReceiptLineEditorValue) => void;
  readonly onSubmit: () => void;
  readonly onRetry: () => void;
  readonly onReload: () => void;
  readonly onClose: () => void;
};

export function ReceiptLineEditorDialog({
  isOpen,
  isDismissable,
  isAdding,
  value,
  categories,
  linkOptions,
  mutationFailure,
  errorMessage,
  canRetry,
  canSubmit,
  onChange,
  onSubmit,
  onRetry,
  onReload,
  onClose,
}: ReceiptLineEditorDialogProps) {
  return (
    <AdaptiveDialog
      trigger={null}
      title={isAdding ? "Add receipt line" : "Edit receipt line"}
      isOpen={isOpen}
      isDismissable={isDismissable}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {value
        ? (
          <Stack gap={4}>
            <ReceiptLineEditor
              value={value}
              categories={categories}
              linkOptions={linkOptions}
              onChange={onChange}
            />
            {mutationFailure
              ? (
                <InlineNotice tone="danger" title="Save failed">
                  {errorMessage ??
                    (canRetry
                      ? "Retry to save this receipt line."
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
                    isDisabled={!canSubmit}
                    onPress={onSubmit}
                  >
                    {isAdding ? "Add line" : "Save changes"}
                  </Button>
                )}
            </FormActions>
          </Stack>
        )
        : null}
    </AdaptiveDialog>
  );
}
