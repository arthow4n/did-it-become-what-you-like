import { useRef } from "react";
import {} from "../../domain/index.ts";
import {
  ActionCard,
  AdaptiveDialog,
  Button,
  ContentContainer,
  FormActions,
  Heading,
  PageHeader,
  Skeleton,
  Stack,
  Text,
} from "../../design-system/index.ts";
import type {} from "./types.ts";
export function FirstUseScreen({
  onCreateProject,
  onRestoreBackup,
  onConnectDrive,
}: {
  onCreateProject?: () => void;
  onRestoreBackup?: () => void;
  onConnectDrive?: () => void;
}) {
  return (
    <ContentContainer size="readable">
      <Stack gap={8} className="local-ui-first-use">
        <Stack gap={3}>
          <Text size="label" tone="muted">After Midnight</Text>
          <Heading level={1} size="lg">Start tracking expenses</Heading>
          <Text tone="secondary">
            Keep your expense history on this device, with sync and scanning
            available when you choose them.
          </Text>
        </Stack>
        <Stack gap={3}>
          <ActionCard
            title="Create first project"
            onPress={onCreateProject}
          />
          <ActionCard
            title="Restore JSON backup"
            onPress={onRestoreBackup}
          />
          <ActionCard
            title="Connect Google Drive"
            onPress={onConnectDrive}
          />
        </Stack>
      </Stack>
    </ContentContainer>
  );
}
export function DirtyExitGuard({
  isOpen,
  onKeepEditing,
  onDiscard,
  discardDisabled = false,
}: {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  discardDisabled?: boolean;
}) {
  const discardIntentRef = useRef(false);
  return (
    <AdaptiveDialog
      trigger={
        <Button
          className="local-ui-dirty-exit-trigger"
          aria-hidden="true"
          isDisabled
          variant="quiet"
        >
          Open unsaved changes guard
        </Button>
      }
      title="Unsaved changes"
      isOpen={isOpen}
      isDismissable={false}
      onOpenChange={(open) => {
        if (open) return;
        if (discardIntentRef.current) {
          discardIntentRef.current = false;
          return;
        }
        onKeepEditing();
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Text>
            You have unsaved changes. Keep editing or discard them?
          </Text>
          <FormActions>
            <Button
              variant="quiet"
              onPress={() => {
                onKeepEditing();
                close();
              }}
            >
              Keep editing
            </Button>
            <Button
              variant="danger"
              isDisabled={discardDisabled}
              onPress={() => {
                discardIntentRef.current = true;
                onDiscard();
                close();
              }}
            >
              {discardDisabled ? "Finishing save…" : "Discard changes"}
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
export type LoadingScreenProps = { readonly title?: string };
export function LoadingScreen(props?: LoadingScreenProps) {
  const title = props?.title ?? "Loading local data";
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader headingLevel={1} title={title} />
        <Skeleton style={{ width: "12rem", height: "2rem" }} />
        <Skeleton style={{ width: "100%", height: "6rem" }} />
      </Stack>
    </ContentContainer>
  );
}
