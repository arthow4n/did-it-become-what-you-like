import type { ComponentPropsWithRef, ReactNode } from "react";
import {
  AdaptiveDialog,
  Button,
  NativeDateField,
  SelectField,
  TextField,
} from "./index.ts";
import type {
  AdaptiveDialogProps,
  ButtonProps,
  NativeDateFieldProps,
  SelectFieldProps,
} from "./index.ts";

declare const Deno: {
  test(name: string, fn: () => void): void;
};

type HasKey<Value, Key extends PropertyKey> = Key extends keyof Value ? true
  : false;
type ContractChecks = [
  HasKey<ButtonProps, "onPress">,
  HasKey<ButtonProps, "isDisabled">,
  HasKey<ButtonProps, "pending">,
  HasKey<SelectFieldProps, "value">,
  HasKey<SelectFieldProps, "onValueChange">,
  HasKey<SelectFieldProps, "isOpen">,
  HasKey<SelectFieldProps, "onOpenChange">,
  HasKey<AdaptiveDialogProps, "onOpenChange">,
  HasKey<NativeDateFieldProps, "ref">,
];

const representativeProps: {
  button: Partial<ButtonProps>;
  field: ComponentPropsWithRef<typeof TextField>;
  select: Pick<
    SelectFieldProps,
    "label" | "options" | "value" | "onValueChange"
  >;
  dialog: Pick<
    AdaptiveDialogProps,
    "trigger" | "title" | "children" | "isOpen" | "onOpenChange"
  >;
  nativeDate: Pick<NativeDateFieldProps, "label" | "id" | "ref" | "onChange">;
} = {
  button: {
    children: "Save expense" as ReactNode,
    pending: true,
    isDisabled: false,
    onPress: () => undefined,
  },
  field: {
    label: "Merchant",
    value: "ICA Maxi",
    isRequired: true,
    onChange: () => undefined,
  },
  select: {
    label: "Currency",
    options: [{ id: "SEK", label: "SEK" }],
    value: "SEK",
    onValueChange: () => undefined,
  },
  dialog: {
    trigger: "Open details",
    title: "Details",
    children: "Details content",
    isOpen: false,
    onOpenChange: () => undefined,
  },
  nativeDate: {
    label: "Expense date",
    id: "expense-date",
    ref: () => undefined,
    onChange: () => undefined,
  },
};

const contractChecks: ContractChecks = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

Deno.test("design-system barrel preserves representative public contracts", () => {
  if (!representativeProps || !contractChecks.every(Boolean)) {
    throw new Error("Representative design-system API contract failed");
  }
  for (
    const component of [
      AdaptiveDialog,
      Button,
      NativeDateField,
      SelectField,
      TextField,
    ]
  ) {
    if (
      typeof component !== "function" &&
      (typeof component !== "object" || component === null)
    ) {
      throw new Error("Design-system barrel export is not callable");
    }
  }
});
