import type { ReactNode } from "react";
import { Field } from "./field.tsx";

export type ColorChoiceFieldProps = {
  label: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  choices?: string[];
  description?: ReactNode;
  isDisabled?: boolean;
};

export function ColorChoiceField({
  label,
  value,
  onValueChange,
  choices = ["#78DCCA", "#8FC8F8", "#F0C674", "#FF9E9E"],
  description,
  isDisabled = false,
}: ColorChoiceFieldProps) {
  return (
    <Field label={label} description={description}>
      <div
        className="ds-color-choice-group"
        role="group"
        aria-label={String(label)}
      >
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className="ds-color-choice__swatch"
            aria-label={`Choose ${choice}`}
            aria-pressed={value === choice}
            disabled={isDisabled}
            onClick={() => onValueChange?.(choice)}
            style={{
              background: choice,
              boxShadow: value === choice
                ? "0 0 0 2px var(--color-canvas), 0 0 0 4px var(--color-focus-ring)"
                : undefined,
            }}
          />
        ))}
        <label className="ds-color-choice__custom">
          <span>Custom</span>
          <input
            type="color"
            aria-label={"Choose custom " + String(label)}
            value={value ?? choices[0] ?? "#78DCCA"}
            disabled={isDisabled}
            onChange={(event) => onValueChange?.(event.currentTarget.value)}
          />
        </label>
      </div>
    </Field>
  );
}
