import type { CSSProperties, ReactNode } from "react";
import { Pill as MantinePill } from "@mantine/core";
import { X } from "lucide-react";
import { cx } from "../shared.ts";
import { IconButton } from "./icon-button.tsx";

export type ChipProps = {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
  style?: CSSProperties;
};

export function Chip({ children, onRemove, className, style }: ChipProps) {
  return (
    <MantinePill
      component="span"
      size="md"
      radius="xl"
      className={cx("ds-chip", className)}
      style={style}
    >
      {children}
      {onRemove
        ? (
          <IconButton
            aria-label={`Remove ${String(children)}`}
            icon={<X size={16} />}
            onPress={onRemove}
            className="ds-chip__remove"
          />
        )
        : null}
    </MantinePill>
  );
}
