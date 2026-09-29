import { forwardRef } from "react";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { Button as MantineButton } from "@mantine/core";
import { type ButtonVariant, cx, mantineButtonVariants } from "../shared.ts";

export type ButtonProps =
  & Omit<ComponentProps<"button">, "children" | "className" | "onClick">
  & {
    children?: ReactNode;
    variant?: ButtonVariant;
    pending?: boolean;
    isDisabled?: boolean;
    isPending?: boolean;
    fullWidth?: boolean;
    onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
    slot?: string;
    className?: string;
  };

export function invokePress(
  onPress: ButtonProps["onPress"],
  event: MouseEvent<HTMLButtonElement>,
): void {
  onPress?.(event);
}

export type InjectedClickProps = {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = "primary",
      pending = false,
      fullWidth,
      className,
      onPress,
      isDisabled,
      isPending,
      slot,
      ...props
    },
    ref,
  ) {
    const isBusy = pending || Boolean(isPending);
    const injectedOnClick = (props as ButtonProps & InjectedClickProps).onClick;
    return (
      <MantineButton
        {...props}
        ref={ref}
        fullWidth={fullWidth}
        variant={mantineButtonVariants[variant]}
        color={variant === "danger" ? "negative" : "accent"}
        disabled={isDisabled}
        loading={isBusy}
        slot={slot ?? undefined}
        onClick={(event) => {
          injectedOnClick?.(event);
          invokePress(onPress, event);
        }}
        className={cx("ds-button", className)}
        data-variant={variant}
        data-full-width={fullWidth ? "true" : undefined}
        data-pending={isBusy ? "true" : undefined}
        aria-busy={isBusy ? "true" : undefined}
      >
        {children}
      </MantineButton>
    );
  },
);
