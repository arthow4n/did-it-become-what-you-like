import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import {
  Badge,
  Card,
  Heading,
  IconButton,
  Inline,
  MoneyText,
  Stack,
  Text,
} from "../primitives.tsx";

export type ReceiptMetadataViewModel = {
  merchant?: string;
  date: string;
  time?: string;
  currency: string;
  printedTotal: string;
};

export type ReceiptMetadataProps = {
  metadata: ReceiptMetadataViewModel;
  onEdit?: () => void;
  totalLabel?: ReactNode;
};

export function ReceiptMetadata(
  { metadata, onEdit, totalLabel = "Receipt total" }: ReceiptMetadataProps,
) {
  const merchantName = metadata.merchant?.trim();
  return (
    <Card as="section">
      <Inline justify="space-between">
        <Stack gap={1}>
          {merchantName
            ? <Heading size="sm">{merchantName}</Heading>
            : (
              <Inline gap={2}>
                <Heading size="sm">No merchant</Heading>
                <Badge tone="warning">Not filled</Badge>
              </Inline>
            )}
          <Text tone="secondary">
            {metadata.date}
            {metadata.time ? ` · ${metadata.time}` : ""} · {metadata.currency}
          </Text>
        </Stack>
        {onEdit
          ? (
            <IconButton
              icon={<Pencil size={18} />}
              aria-label="Edit"
              variant="quiet"
              onPress={onEdit}
            />
          )
          : null}
      </Inline>
      <Inline justify="space-between">
        <Text tone="secondary">{totalLabel}</Text>
        <MoneyText
          amount={metadata.printedTotal}
          currency={metadata.currency}
        />
      </Inline>
    </Card>
  );
}
