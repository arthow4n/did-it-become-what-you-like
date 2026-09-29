import type { ReactNode } from "react";
import { Box as MantineBox } from "@mantine/core";
import { cx } from "../shared.ts";

export type AppFrameProps = {
  children: ReactNode;
  navigation?: ReactNode;
  className?: string;
};

export function AppFrame({ children, navigation, className }: AppFrameProps) {
  return (
    <MantineBox className={cx("ds-app-frame", className)}>
      {navigation
        ? (
          <MantineBox component="aside" className="ds-app-frame__navigation">
            {navigation}
          </MantineBox>
        )
        : null}
      <MantineBox component="main" className="ds-app-frame__main">
        {children}
      </MantineBox>
    </MantineBox>
  );
}
