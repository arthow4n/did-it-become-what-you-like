import type { ReactNode } from "react";
import { Button, Stack } from "../primitives.tsx";
import { FormActions } from "../layout.tsx";
import { AdaptiveDialog } from "../dialogs.tsx";

export type FilterSheetProps = {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  title?: ReactNode;
  applyLabel?: string;
  onApply?: () => void;
  resetLabel?: string;
  onReset?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function FilterSheet(
  {
    trigger,
    children,
    title = "Filters",
    applyLabel = "Apply filters",
    onApply,
    resetLabel = "Reset filters",
    onReset,
    isOpen,
    onOpenChange,
  }: FilterSheetProps,
) {
  return (
    <AdaptiveDialog
      trigger={trigger}
      title={title}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      {(close) => (
        <Stack gap={4}>
          {typeof children === "function" ? children(close) : children}
          <FormActions>
            {onReset
              ? (
                <Button
                  variant="quiet"
                  onPress={() => {
                    onReset();
                    close();
                  }}
                >
                  {resetLabel}
                </Button>
              )
              : null}
            <Button
              variant="primary"
              onPress={() => {
                onApply?.();
                close();
              }}
            >
              {applyLabel}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
