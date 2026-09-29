import { forwardRef } from "react";
import type { ReactNode } from "react";
import { ActionIcon as MantineActionIcon } from "@mantine/core";
import { cx, mantineButtonVariants } from "../shared.ts";
import {
  type ButtonProps,
  type InjectedClickProps,
  invokePress,
} from "./button.tsx";

export type IconButtonProps = Omit<ButtonProps, "children"> & {
  icon: ReactNode;
  "aria-label": string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      className,
      variant = "quiet",
      pending = false,
      onPress,
      isDisabled,
      isPending,
      slot,
      ...props
    },
    ref,
  ) {
    const isBusy = pending || Boolean(isPending);
    const injectedOnClick = (props as IconButtonProps & InjectedClickProps)
      .onClick;
    return (
      <MantineActionIcon
        {...props}
        ref={ref}
        variant={variant === "secondary"
          ? "outline"
          : variant === "danger"
          ? "light"
          : mantineButtonVariants[variant]}
        color={variant === "danger" ? "negative" : "accent"}
        disabled={isDisabled}
        loading={isBusy}
        slot={slot ?? undefined}
        onClick={(event) => {
          injectedOnClick?.(event);
          invokePress(onPress, event);
        }}
        className={cx("ds-icon-button", className)}
        data-variant={variant}
        data-pending={isBusy ? "true" : undefined}
        aria-busy={isBusy ? "true" : undefined}
      >
        {icon}
      </MantineActionIcon>
    );
  },
);
