import { useEffect, useState } from "react";
import { Button, Inline, Stack, StatusDot, Text } from "../primitives.tsx";
import { FormActions } from "../layout.tsx";
import { TextField } from "../fields.tsx";
import { AdaptiveDialog } from "./adaptive-dialog.tsx";
import type { ConfirmDialogProps } from "./confirm-dialog.tsx";

export type DangerDialogProps = ConfirmDialogProps & {
  phrase?: string;
  cancelLabel?: string;
  onCancel?: () => void;
};

export function DangerDialog(
  {
    phrase,
    description,
    onConfirm,
    cancelLabel = "Cancel",
    onCancel,
    onOpenChange,
    ...props
  }: DangerDialogProps,
) {
  const [typed, setTyped] = useState("");
  const requiresPhrase = Boolean(phrase);
  useEffect(() => {
    if (props.isOpen) setTyped("");
  }, [props.isOpen]);
  return (
    <AdaptiveDialog
      {...props}
      onOpenChange={(open) => {
        if (open) setTyped("");
        onOpenChange?.(open);
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Inline>
            <StatusDot tone="danger">Destructive action</StatusDot>
          </Inline>
          <Text>{description}</Text>
          {phrase
            ? (
              <TextField
                label={`Type ${phrase} to confirm`}
                value={typed}
                onChange={setTyped}
              />
            )
            : null}
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
              variant="danger"
              isDisabled={requiresPhrase && typed !== phrase}
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {props.confirmLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
