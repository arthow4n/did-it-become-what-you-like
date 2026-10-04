import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";
import { Upload } from "lucide-react";
import {
  Button,
  Card,
  Heading,
  ResponsiveGrid,
  Stack,
  Text,
} from "../primitives.tsx";
import { cx } from "../shared.ts";

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
  onFilesSelected?: (files: readonly File[]) => void;
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
    onFilesSelected,
  }: ReceiptSourcePickerProps,
) {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasPreviews = previews && previews.length > 0;

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onFilesSelected?.(Array.from(event.dataTransfer.files));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChooseImage?.();
    }
  };

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
          <div
            className={cx(
              "ds-receipt-source-picker__dropzone",
              isDragOver && "ds-receipt-source-picker__dropzone--active",
            )}
            role="button"
            tabIndex={0}
            onClick={() => onChooseImage?.()}
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label={`${emptyTitle}. Click to choose image or drag and drop.`}
          >
            <div className="ds-receipt-source-picker__dropzone-body">
              <Upload
                size={22}
                className="ds-receipt-source-picker__dropzone-icon"
                aria-hidden="true"
              />
              <div className="ds-receipt-source-picker__dropzone-text">
                <Heading size="sm">{emptyTitle}</Heading>
                {emptyDescription
                  ? <Text tone="secondary">{emptyDescription}</Text>
                  : null}
              </div>
            </div>
            <div
              className="ds-receipt-source-picker__dropzone-actions"
              onClick={(event) => event.stopPropagation()}
            >
              <Button variant="secondary" onPress={onTakePhoto}>
                {takePhotoLabel}
              </Button>
              <Button variant="secondary" onPress={onChooseImage}>
                {chooseImageLabel}
              </Button>
            </div>
          </div>
        )}
      {preview || hasPreviews
        ? (
          <div className="ds-receipt-source-picker__actions">
            <div className="ds-receipt-source-picker__primary-actions">
              <Button variant="secondary" onPress={onTakePhoto}>
                {takePhotoLabel}
              </Button>
              <Button variant="secondary" onPress={onChooseImage}>
                {chooseImageLabel}
              </Button>
            </div>
            {onRemove
              ? <Button variant="quiet" onPress={onRemove}>Remove</Button>
              : null}
          </div>
        )
        : null}
    </Stack>
  );
}
