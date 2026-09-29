import type { ReactNode } from "react";
import { Button, Card, ResponsiveGrid, Stack } from "../primitives.tsx";
import { EmptyState } from "../feedback.tsx";

export type ReceiptSourcePickerProps = {
  preview?: ReactNode;
  previews?: readonly ReactNode[];
  onTakePhoto?: () => void;
  onChooseImage?: () => void;
  onRemove?: () => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  takePhotoLabel?: ReactNode;
  chooseImageLabel?: ReactNode;
};

export function ReceiptSourcePicker(
  {
    preview,
    previews,
    onTakePhoto,
    onChooseImage,
    onRemove,
    emptyTitle = "No receipt selected",
    emptyDescription =
      "Choose an image or PDF, or take a photo to preview it before sending.",
    takePhotoLabel = "Take photo",
    chooseImageLabel = "Choose image",
  }: ReceiptSourcePickerProps,
) {
  const hasPreviews = previews && previews.length > 0;
  return (
    <Stack gap={4}>
      {hasPreviews
        ? (
          <ResponsiveGrid columns={previews.length === 1 ? 1 : 2} gap={3}>
            {previews}
          </ResponsiveGrid>
        )
        : preview
        ? <Card>{preview}</Card>
        : (
          <EmptyState title={emptyTitle}>
            {emptyDescription}
          </EmptyState>
        )}
      <div className="ds-receipt-source-picker__actions">
        <div className="ds-receipt-source-picker__primary-actions">
          <Button variant="secondary" onPress={onTakePhoto}>
            {takePhotoLabel}
          </Button>
          <Button variant="secondary" onPress={onChooseImage}>
            {chooseImageLabel}
          </Button>
        </div>
        {(preview || hasPreviews) && onRemove
          ? <Button variant="quiet" onPress={onRemove}>Remove</Button>
          : null}
      </div>
    </Stack>
  );
}
