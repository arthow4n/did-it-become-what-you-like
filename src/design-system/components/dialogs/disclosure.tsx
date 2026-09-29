import type { ReactNode } from "react";
import { Accordion as MantineAccordion } from "@mantine/core";
import { ChevronRight } from "lucide-react";
import { cx } from "../shared.ts";
import { Icon } from "../primitives.tsx";

export type DisclosureProps = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
};

export function Disclosure(
  {
    title,
    children,
    className,
    isExpanded,
    defaultExpanded,
    onExpandedChange,
  }: DisclosureProps,
) {
  return (
    <MantineAccordion
      className={cx("ds-disclosure", className)}
      value={isExpanded === undefined
        ? undefined
        : isExpanded
        ? "disclosure"
        : null}
      defaultValue={defaultExpanded ? "disclosure" : undefined}
      onChange={(value) => onExpandedChange?.(value === "disclosure")}
      chevron={
        <Icon>
          <ChevronRight />
        </Icon>
      }
      chevronPosition="right"
      disableChevronRotation
      transitionDuration={0}
      order={3}
      classNames={{
        control: "ds-disclosure__trigger",
        panel: "ds-disclosure__panel",
      }}
    >
      <MantineAccordion.Item value="disclosure">
        <MantineAccordion.Control>{title}</MantineAccordion.Control>
        <MantineAccordion.Panel>{children}</MantineAccordion.Panel>
      </MantineAccordion.Item>
    </MantineAccordion>
  );
}
