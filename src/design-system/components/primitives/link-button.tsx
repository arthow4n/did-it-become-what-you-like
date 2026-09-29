import type { ComponentProps, ReactNode } from "react";
import { Button as MantineButton } from "@mantine/core";
import { type ButtonVariant, cx, mantineButtonVariants } from "../shared.ts";

export type LinkButtonProps = Omit<ComponentProps<"a">, "className"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

export function LinkButton({
  children,
  variant = "secondary",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <MantineButton
      {...props}
      component="a"
      variant={mantineButtonVariants[variant]}
      color={variant === "danger" ? "negative" : "accent"}
      className={cx("ds-link-button", className)}
      data-variant={variant}
    >
      {children}
    </MantineButton>
  );
}
