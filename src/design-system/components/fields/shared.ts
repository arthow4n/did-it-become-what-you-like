import type { ComponentProps, ReactNode } from "react";

export type FieldStateProps = {
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: ValidationBehavior;
  slot?: string;
};

export type ValidationBehavior = "aria" | "native";

export type ValidationAttributes = {
  required?: boolean;
  "aria-required"?: "true";
};

export function validationAttributes(
  isRequired: boolean | undefined,
  validationBehavior: ValidationBehavior | undefined,
  supportsNativeValidation = true,
): ValidationAttributes {
  if (!isRequired) return {};
  if (validationBehavior === "aria" || !supportsNativeValidation) {
    return { "aria-required": "true" };
  }
  return { required: true };
}

export type SharedTextFieldProps =
  & Omit<
    ComponentProps<"input">,
    | "children"
    | "className"
    | "defaultValue"
    | "onChange"
    | "value"
  >
  & {
    label: ReactNode;
    placeholder?: string;
    description?: ReactNode;
    error?: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    className?: string;
  }
  & FieldStateProps;

export function inputValue(
  value: ComponentProps<"input">["value"],
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0];
  return String(value);
}

export function emitInputChange(
  onChange: ComponentProps<"input">["onChange"],
  value: string,
): void {
  const input = { value };
  onChange?.(
    { currentTarget: input, target: input } as React.ChangeEvent<
      HTMLInputElement
    >,
  );
}

export function emitFileChange(
  onChange: ComponentProps<"input">["onChange"],
  files: readonly File[],
): void {
  const fileList = files as unknown as FileList;
  onChange?.({
    currentTarget: { files: fileList },
    target: { files: fileList },
  } as React.ChangeEvent<HTMLInputElement>);
}

export const fileExtensionMimeTypes: Record<string, string> = {
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function dropzoneAcceptFor(
  accept: string | undefined,
): Record<string, string[]> | undefined {
  if (!accept) return undefined;
  const result: Record<string, string[]> = {};
  for (const entry of accept.split(",").map((value) => value.trim())) {
    if (!entry) continue;
    if (entry.includes("/")) {
      result[entry] ??= [];
      continue;
    }
    if (entry.startsWith(".")) {
      const mimeType = fileExtensionMimeTypes[entry.toLowerCase()] ??
        "application/octet-stream";
      result[mimeType] ??= [];
      result[mimeType].push(entry);
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export type SelectOption = { id: string; label: string; disabled?: boolean };
