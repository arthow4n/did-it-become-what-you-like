import type { ReactNode } from "react";
import { Box as MantineBox, List as MantineList } from "@mantine/core";
import { cx } from "../shared.ts";

export type ErrorSummaryProps = {
  title?: ReactNode;
  errors: Array<{ id?: string; message: ReactNode }>;
  className?: string;
};

export function ErrorSummary(
  { title = "Check the highlighted fields", errors, className }:
    ErrorSummaryProps,
) {
  return (
    <MantineBox
      className={cx("ds-error-summary", className)}
      role="alert"
      tabIndex={-1}
    >
      <strong>{title}</strong>
      <MantineList className="ds-error-summary__list" listStyleType="disc">
        {errors.map((error, index) => (
          <MantineList.Item key={error.id ?? index}>
            {error.message}
          </MantineList.Item>
        ))}
      </MantineList>
    </MantineBox>
  );
}
