import type { CSSProperties } from "react";

export type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Tone = "neutral" | "positive" | "warning" | "danger" | "info";
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export const toneColors: Record<Tone, string> = {
  neutral: "surface2",
  positive: "positive",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function gapStyle(gap: Space | undefined): CSSProperties | undefined {
  return gap === undefined
    ? undefined
    : { "--ds-gap": `var(--space-${gap})` } as CSSProperties;
}

export function mantineSpacing(gap: Space): string {
  return `ds-${gap}`;
}
