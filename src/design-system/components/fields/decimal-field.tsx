import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FocusEvent } from "react";
import { TextField } from "./text-field.tsx";
import type { SharedTextFieldProps } from "./shared.ts";

export type DecimalFieldProps = Omit<
  SharedTextFieldProps,
  "inputMode" | "type"
>;

export function DecimalField({
  value,
  defaultValue,
  onChange,
  onBlur,
  ...props
}: DecimalFieldProps) {
  const [localValue, setLocalValue] = useState(value ?? defaultValue ?? "");
  const pendingValuesRef = useRef(new Set<string>());

  useEffect(() => {
    const nextPropValue = value ?? "";
    if (pendingValuesRef.current.has(nextPropValue)) {
      pendingValuesRef.current.delete(nextPropValue);
      return;
    }
    pendingValuesRef.current.clear();
    setLocalValue(nextPropValue);
  }, [value]);

  const handleChange = useCallback((nextValue: string) => {
    pendingValuesRef.current.add(nextValue);
    setLocalValue(nextValue);
    startTransition(() => {
      onChange?.(nextValue);
    });
  }, [onChange]);

  const handleBlur = useCallback((event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
  }, [onBlur]);

  return (
    <TextField
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      inputMode="decimal"
      type="text"
    />
  );
}
