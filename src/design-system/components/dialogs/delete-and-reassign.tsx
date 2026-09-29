import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Stack, Text } from "../primitives.tsx";
import { FormActions } from "../layout.tsx";
import { SelectField, type SelectOption } from "../fields.tsx";
import { AdaptiveDialog } from "./adaptive-dialog.tsx";

export type DeleteAndReassignProps = {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  replacementOptions: SelectOption[];
  defaultReplacementId: string;
  affectedCount: number;
  onConfirm: (replacementCategoryId: string) => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
};

/**
 * The shared destructive category workflow keeps replacement selection and
 * confirmation in one accessible adaptive dialog. The actor still owns the
 * resulting atomic command; this component only binds the controlled choice.
 */
export function DeleteAndReassign({
  trigger,
  title,
  description,
  replacementOptions,
  defaultReplacementId,
  affectedCount,
  onConfirm,
  confirmLabel = "Delete and reassign",
  cancelLabel = "Cancel",
  onCancel,
}: DeleteAndReassignProps) {
  const [replacementId, setReplacementId] = useState(defaultReplacementId);
  return (
    <AdaptiveDialog
      trigger={trigger}
      title={title}
      onOpenChange={(open) => {
        if (open) setReplacementId(defaultReplacementId);
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Text>{description}</Text>
          <Text tone="secondary">
            {affectedCount} {affectedCount === 1 ? "expense" : "expenses"}{" "}
            reference this category across every project.
          </Text>
          <SelectField
            label="Replacement category"
            options={replacementOptions}
            value={replacementId}
            onValueChange={setReplacementId}
          />
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
              isDisabled={!replacementId}
              onPress={() => {
                onConfirm(replacementId);
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
