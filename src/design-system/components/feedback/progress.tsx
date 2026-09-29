import { Progress as MantineProgress } from "@mantine/core";
import { cx } from "../shared.ts";

export type ProgressProps = {
  label: string;
  value?: number;
  indeterminate?: boolean;
  minValue?: number;
  maxValue?: number;
  className?: string;
};

export function Progress(
  {
    label,
    value,
    indeterminate = false,
    minValue = 0,
    maxValue = 100,
    className,
  }: ProgressProps,
) {
  const currentValue = value ?? minValue;
  const percentage = maxValue > minValue
    ? Math.min(
      100,
      Math.max(0, ((currentValue - minValue) / (maxValue - minValue)) * 100),
    )
    : 0;
  return (
    <div
      aria-label={label}
      className={cx("ds-progress", className)}
      data-indeterminate={indeterminate ? "true" : "false"}
      role="progressbar"
      aria-valuemin={minValue}
      aria-valuemax={maxValue}
      {...(indeterminate ? {} : {
        "aria-valuenow": currentValue,
        "aria-valuetext": `${Math.round(percentage)}%`,
      })}
    >
      <div
        className="ds-inline"
        style={{ justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span>
          {indeterminate ? "In progress" : `${Math.round(percentage)}%`}
        </span>
      </div>
      <MantineProgress.Root
        className="ds-progress__track"
        aria-hidden="true"
        transitionDuration={0}
      >
        <MantineProgress.Section
          value={indeterminate ? 35 : percentage}
          color="accent"
          className="ds-progress__bar"
          withAria={false}
          animated={false}
        />
      </MantineProgress.Root>
    </div>
  );
}
