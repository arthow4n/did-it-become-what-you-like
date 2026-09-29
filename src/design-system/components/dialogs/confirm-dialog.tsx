import type { ReactNode } from "react";
import type { ButtonVariant } from "../shared.ts";
import { Button, Stack, Text } from "../primitives.tsx";
import { FormActions } from "../layout.tsx";
import {
  AdaptiveDialog,
  type AdaptiveDialogProps,
} from "./adaptive-dialog.tsx";

export type ConfirmDialogProps = Omit<AdaptiveDialogProps, "children"> & {
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmVariant?: ButtonVariant;
  cancelLabel?: string;
  onCancel?: () => void;
};

export function ConfirmDialog({
  description,
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  cancelLabel = "Cancel",
  onCancel,
  ...props
}: ConfirmDialogProps) {
  return (
    <AdaptiveDialog {...props}>
      {(close) => (
        <Stack gap={5}>
          <Text>{description}</Text>
          <FormActions>
            <Button
              variant="secondary"
              onPress={() => {
                onCancel?.();
                close();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {confirmLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
