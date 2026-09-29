import type { ReactNode } from "react";
import { Button as MantineButton } from "@mantine/core";
import { cx } from "../shared.ts";
import { Icon } from "./icon.tsx";
import {
  type ButtonProps,
  type InjectedClickProps,
  invokePress,
} from "./button.tsx";

export type ActionCardProps = Omit<ButtonProps, "children"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

export function ActionCard(
  {
    title,
    description,
    icon,
    pending = false,
    onPress,
    isDisabled,
    isPending,
    slot,
    ...props
  }: ActionCardProps,
) {
  const isBusy = pending || Boolean(isPending);
  const injectedOnClick =
    (props as ActionCardProps & InjectedClickProps).onClick;
  return (
    <MantineButton
      {...props}
      variant="default"
      component="button"
      disabled={isDisabled}
      loading={isBusy}
      slot={slot ?? undefined}
      onClick={(event) => {
        injectedOnClick?.(event);
        invokePress(onPress, event);
      }}
      className={cx("ds-action-card", props.className)}
      data-pending={isBusy ? "true" : undefined}
      aria-busy={isBusy ? "true" : undefined}
    >
      {icon ? <Icon>{icon}</Icon> : null}
      <strong>{title}</strong>
      {description
        ? <span className="ds-action-card__description">{description}</span>
        : null}
    </MantineButton>
  );
}
