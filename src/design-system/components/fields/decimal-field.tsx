import { memo } from "react";
import { TextField } from "./text-field.tsx";
import type { SharedTextFieldProps } from "./shared.ts";

export type DecimalFieldProps = Omit<
  SharedTextFieldProps,
  "inputMode" | "type"
>;

export const DecimalField = memo(function DecimalField(
  props: DecimalFieldProps,
) {
  return (
    <TextField
      {...props}
      inputMode="decimal"
      type="text"
    />
  );
});
