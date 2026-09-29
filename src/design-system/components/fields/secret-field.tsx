import { useState } from "react";
import type { ComponentProps, KeyboardEvent } from "react";
import { PasswordInput as MantinePasswordInput } from "@mantine/core";
import { cx } from "../shared.ts";
import { type SharedTextFieldProps, validationAttributes } from "./shared.ts";

export type SecretFieldProps = Omit<SharedTextFieldProps, "type"> & {
  revealLabel?: string;
};

export function SecretField(
  {
    label,
    placeholder,
    description,
    error,
    className,
    revealLabel = "Show value",
    onChange,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    validationBehavior,
    slot,
    ...props
  }: SecretFieldProps,
) {
  const [revealed, setRevealed] = useState(false);
  const mantineProps = props as unknown as ComponentProps<
    typeof MantinePasswordInput
  >;
  const validation = validationAttributes(isRequired, validationBehavior);
  return (
    <MantinePasswordInput
      {...mantineProps}
      label={label}
      placeholder={placeholder}
      description={description}
      error={error}
      {...validation}
      disabled={isDisabled}
      readOnly={isReadOnly}
      visible={revealed}
      onVisibilityChange={setRevealed}
      visibilityToggleButtonProps={{
        "aria-label": revealed ? "Hide value" : revealLabel,
        className: "ds-secret-field__toggle",
        tabIndex: 0,
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setRevealed((current) => !current);
          }
        },
      }}
      aria-invalid={Boolean(error) || isInvalid ? "true" : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cx("ds-field", "ds-secret-field", className)}
      classNames={{ input: "ds-field-control ds-secret-field__input" }}
      slot={slot ?? undefined}
    />
  );
}
