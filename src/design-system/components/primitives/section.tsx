import { Paper as MantinePaper } from "@mantine/core";
import { cx } from "../shared.ts";
import type { CardProps } from "./card.tsx";

export function Section(
  { children, className, as: Tag = "section", style }: CardProps,
) {
  return (
    <MantinePaper
      component={Tag as "div"}
      withBorder
      radius="md"
      shadow="none"
      className={cx("ds-section", className)}
      style={style}
    >
      {children}
    </MantinePaper>
  );
}
