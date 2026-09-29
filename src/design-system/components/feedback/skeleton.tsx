import type { CSSProperties } from "react";
import { Skeleton as MantineSkeleton } from "@mantine/core";
import { cx } from "../shared.ts";

export type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <MantineSkeleton
      className={cx("ds-skeleton", className)}
      aria-hidden="true"
      animate={false}
      style={style}
    />
  );
}
