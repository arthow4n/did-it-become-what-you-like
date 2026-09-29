import type { CSSProperties } from "react";
import { Divider as MantineDivider } from "@mantine/core";
import { cx } from "../shared.ts";

export function Divider({
  className,
  style,
}: { className?: string; style?: CSSProperties }) {
  return (
    <MantineDivider
      component="hr"
      className={cx("ds-divider", className)}
      style={style}
    />
  );
}
