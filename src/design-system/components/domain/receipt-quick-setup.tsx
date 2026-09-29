import type { ReactNode } from "react";
import { Button, Card, Heading, Stack } from "../primitives.tsx";
import { FormActions } from "../layout.tsx";
import { SecretField } from "../fields.tsx";
import { InlineNotice } from "../feedback.tsx";

export type ReceiptQuickSetupProps = {
  providerName: string;
  providerDisclosure?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  error?: string;
  busy?: boolean;
  showHeading?: boolean;
  autoFocus?: boolean;
};

export function ReceiptQuickSetup(
  {
    providerName,
    providerDisclosure,
    value,
    onChange,
    onSave,
    error,
    busy,
    showHeading = true,
    autoFocus = false,
  }: ReceiptQuickSetupProps,
) {
  return (
    <Card as="section">
      <Stack gap={4}>
        {showHeading
          ? <Heading size="sm">Set up {providerName}</Heading>
          : null}
        <SecretField
          label="API key"
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          description="Stored on this device. It is not a browser secret and can be read by code running on this origin."
          error={error}
        />
        <InlineNotice tone="warning" title="Before you continue">
          The selected receipt image, extraction schema and instructions, active
          category IDs and names, device locale, and project currency code are
          sent to {providerName}. {providerDisclosure}{" "}
          Expense history, project names, Drive data, other device details, and
          sync metadata are excluded. The image is used only for this scan and
          is not uploaded publicly or stored by this app.
        </InlineNotice>
        <FormActions>
          <Button
            pending={busy}
            isDisabled={busy || value.trim().length === 0}
            onPress={onSave}
          >
            Save and continue
          </Button>
        </FormActions>
      </Stack>
    </Card>
  );
}
