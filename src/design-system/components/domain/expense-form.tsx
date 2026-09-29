import type { ReactNode } from "react";
import { FormActions, FormLayout, StickyActionBar } from "../layout.tsx";

export type ExpenseFormProps = {
  children?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  stickyActions?: boolean;
};

export function ExpenseForm(
  { children, status, actions, stickyActions = false }: ExpenseFormProps,
) {
  return (
    <FormLayout>
      {status}
      {children}
      {actions
        ? (stickyActions
          ? (
            <StickyActionBar className="ds-form-actions--sticky">
              {actions}
            </StickyActionBar>
          )
          : <FormActions>{actions}</FormActions>)
        : null}
    </FormLayout>
  );
}
