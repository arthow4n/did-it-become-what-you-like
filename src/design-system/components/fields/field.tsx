import type { ReactNode } from "react";
import { Input as MantineInput } from "@mantine/core";
import { cx } from "../shared.ts";

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  controlId?: string;
  className?: string;
};

export function Field(
  { label, children, description, error, required, controlId, className }:
    FieldProps,
) {
  return (
    <MantineInput.Wrapper
      id={controlId}
      label={label}
      description={description}
      error={error}
      required={required}
      labelElement={controlId ? "label" : "div"}
      className={cx("ds-field", className)}
      data-invalid={error ? "true" : undefined}
    >
      {children}
    </MantineInput.Wrapper>
  );
}
