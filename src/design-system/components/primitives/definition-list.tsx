import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type DefinitionListProps = {
  items: Array<{ term: ReactNode; description: ReactNode }>;
  className?: string;
};

export function DefinitionList({ items, className }: DefinitionListProps) {
  return (
    <MantineBox component="dl" className={cx("ds-definition-list", className)}>
      {items.map((item, index) => (
        <MantineBox key={index} component="div" style={{ display: "contents" }}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </MantineBox>
      ))}
    </MantineBox>
  );
}
