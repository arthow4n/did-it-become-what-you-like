import type { ReactNode } from "react";

import { cx } from "../shared.ts";

export type IconProps = {
  children: ReactNode;
  label?: string;
  size?: number;
  className?: string;
};

export function Icon({ children, label, size = 20, className }: IconProps) {
  return (
    <span
      className={cx("ds-icon", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ width: size, height: size, display: "inline-flex" }}
    >
      {children}
    </span>
  );
}
