import { type ReactNode, startTransition } from "react";
import { useOpenState } from "./shared.ts";
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
  const [expanded, setExpanded] = useOpenState(
    isExpanded,
    onExpandedChange,
    defaultExpanded,
  );
  return (
    <MantineAccordion
      className={cx("ds-disclosure", className)}
      value={expanded ? "disclosure" : null}
      onChange={(value) => {
        if (value === "disclosure") startTransition(() => setExpanded(true));
        else setExpanded(false);
      }}
      keepMounted={false}
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
