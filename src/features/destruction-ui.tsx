import {
  AdaptiveDialog,
  Badge,
  Button,
  Checkbox,
  ContentContainer,
  DefinitionList,
  FormActions,
  Heading,
  Inline,
  InlineNotice,
  List,
  ListRow,
  PageHeader,
  Stack,
  Text,
  WorkflowProgress,
} from "../design-system/index.ts";
import { useEffect } from "react";
import type { DeleteEverywhereProgressPhase } from "../domain/destruction.ts";

export type DestructionDeviceView = {
  readonly stableKey: string;
  readonly label: string;
  readonly lastSeenAt: string;
  readonly current: boolean;
  readonly acknowledged: boolean;
};

export type LocalEraseView = {
  readonly phase:
    | "idle"
    | "reviewing"
    | "saving"
    | "erasing"
    | "removing-key"
    | "failed"
    | "completed";
  readonly removeGeminiApiKey: boolean;
  readonly error?: string;
};

export type DeleteEverywhereView = {
  readonly phase: "idle" | DeleteEverywhereProgressPhase;
  readonly safetyExported: boolean;
  readonly safetyDeclined: boolean;
  readonly declineConfirmed: boolean;
  readonly generation: number;
  readonly knownDeviceCount: number;
  readonly acknowledgedDeviceCount: number;
  readonly forcedDeviceCount: number;
  readonly error?: string;
  readonly revoking: boolean;
};

export type DataPrivacyScreenProps = {
  readonly connected: boolean;
  readonly localErase: LocalEraseView;
  readonly deleteEverywhere: DeleteEverywhereView;
  readonly devices: readonly DestructionDeviceView[];
  readonly onBack: () => void;
  readonly onDisconnect: () => void;
  readonly onOpenLocalErase: () => void;
  readonly onLocalEraseChoice: (removeGeminiApiKey: boolean) => void;
  readonly onConfirmLocalErase: () => void;
  readonly onRetryLocalErase: () => void;
  readonly onCancelLocalErase: () => void;
  readonly onOpenDeleteEverywhere: () => void;
  readonly onSafetyExport: () => void;
  readonly onDeclineSafetyExport: () => void;
  readonly onConfirmDecline: () => void;
  readonly onConfirmDeleteEverywhere: () => void;
  readonly onForceFinalize: () => void;
  readonly onRetryDeleteEverywhere: () => void;
  readonly onRetryFinalization: () => void;
  readonly onCancelDeleteEverywhere: () => void;
};

const progressSteps = [
  "Publish retirement",
  "Delete Drive generation",
  "Erase this device",
  "Await device acknowledgements",
  "Finalize authorization",
];

function focusDialogFirstAction(label: string): boolean {
  const dialog = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"]'),
  ).find((candidate) => candidate.getAttribute("aria-label") === label);
  const action = dialog?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
  );
  if (!action) return false;
  action.focus();
  return true;
}

function useDialogFirstActionFocus(open: boolean, label: string): void {
  useEffect(() => {
    if (!open) return;
    if (focusDialogFirstAction(label)) return;
    let cancel: () => void;
    const focus = () => focusDialogFirstAction(label);
    if (typeof globalThis.requestAnimationFrame === "function") {
      const frame = globalThis.requestAnimationFrame(focus);
      cancel = () => globalThis.cancelAnimationFrame(frame);
    } else {
      const timer = globalThis.setTimeout(focus, 0);
      cancel = () => globalThis.clearTimeout(timer);
    }
    return cancel;
  }, [label, open]);
}

function progressIndex(phase: DeleteEverywhereView["phase"]): number {
  switch (phase) {
    case "publishing-retirement":
      return 0;
    case "deleting-drive":
      return 1;
    case "erasing-local":
      return 2;
    case "awaiting-devices":
    case "forced-finalization":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function DeviceAcknowledgements({
  devices,
}: {
  readonly devices: readonly DestructionDeviceView[];
}) {
  return (
    <List label="Delete Everywhere device acknowledgements">
      {devices.map((device) => (
        <ListRow key={device.stableKey}>
          <Inline justify="space-between">
            <Stack gap={1}>
              <strong>{device.label}</strong>
              <Text tone="secondary">
                {device.current ? "This device" : device.lastSeenAt}
              </Text>
            </Stack>
            <Badge tone={device.acknowledged ? "positive" : "warning"}>
              {device.acknowledged ? "Acknowledged" : "Waiting"}
            </Badge>
          </Inline>
        </ListRow>
      ))}
    </List>
  );
}

export function DataPrivacyScreen({
  connected,
  localErase,
  deleteEverywhere,
  devices,
  onBack,
  onDisconnect,
  onOpenLocalErase,
  onLocalEraseChoice,
  onConfirmLocalErase,
  onRetryLocalErase,
  onCancelLocalErase,
  onOpenDeleteEverywhere,
  onSafetyExport,
  onDeclineSafetyExport,
  onConfirmDecline,
  onConfirmDeleteEverywhere,
  onForceFinalize,
  onRetryDeleteEverywhere,
  onRetryFinalization,
  onCancelDeleteEverywhere,
}: DataPrivacyScreenProps) {
  const localEraseBusy = localErase.phase === "saving" ||
    localErase.phase === "erasing" || localErase.phase === "removing-key";
  const deleteBusy = [
    "exporting",
    "publishing-retirement",
    "deleting-drive",
    "erasing-local",
    "completed",
  ].includes(deleteEverywhere.phase);
  const deleteOpen = deleteEverywhere.phase !== "idle";
  const localOpen = localErase.phase !== "idle" &&
    localErase.phase !== "completed";
  useDialogFirstActionFocus(localOpen, "Delete this device's data?");
  useDialogFirstActionFocus(deleteOpen, "Delete everywhere?");

  return (
    <ContentContainer size="readable" className="destruction-ui-screen">
      <Stack gap={5}>
        <PageHeader
          title="Data and privacy"
          headingLevel={1}
          leading={<Button variant="quiet" onPress={onBack}>Settings</Button>}
        />
        <DefinitionList
          items={[
            {
              term: "Receipt images",
              description: "Never stored after AI processing",
            },
            {
              term: "Gemini API key",
              description: "Stored only on this device",
            },
          ]}
        />

        <Stack gap={3}>
          <Heading level={2} size="sm">Data actions</Heading>
          <InlineNotice tone="info" title="Choose the scope carefully">
            Disconnect keeps both copies. Local erase removes only this browser.
            Delete Everywhere retires the synchronized generation for every
            device that reconnects.
          </InlineNotice>
          <Button
            variant="secondary"
            isDisabled={!connected}
            onPress={onDisconnect}
          >
            Disconnect this device
          </Button>
          {!connected
            ? (
              <Text tone="secondary">
                This device is already disconnected; local data is unchanged.
              </Text>
            )
            : null}

          <AdaptiveDialog
            trigger={
              <Button variant="danger" onPress={onOpenLocalErase}>
                Delete this device&apos;s data
              </Button>
            }
            title="Delete this device&apos;s data?"
            isOpen={localOpen}
            isDismissable={!localEraseBusy}
            onOpenChange={(open) => {
              if (!open) onCancelLocalErase();
            }}
          >
            {(close) => (
              <Stack gap={4}>
                <InlineNotice tone="danger" title="This browser only">
                  Drive data and other devices remain unchanged. This browser
                  will be disconnected so it cannot immediately download the
                  preserved cloud dataset.
                </InlineNotice>
                <Checkbox
                  isSelected={localErase.removeGeminiApiKey}
                  onChange={onLocalEraseChoice}
                  isDisabled={localEraseBusy}
                >
                  Remove Gemini API key from this device
                </Checkbox>
                {localErase.phase === "failed"
                  ? (
                    <InlineNotice tone="danger" title="Local erase failed">
                      {localErase.error ?? "Local data could not be erased."}
                    </InlineNotice>
                  )
                  : null}
                {localEraseBusy
                  ? (
                    <InlineNotice tone="info" title="Erasing local data">
                      Keep this window open while this browser is erased.
                    </InlineNotice>
                  )
                  : null}
                <FormActions>
                  <Button
                    variant="quiet"
                    onPress={() => {
                      onCancelLocalErase();
                      close();
                    }}
                  >
                    Cancel
                  </Button>
                  {localErase.phase === "failed"
                    ? (
                      <Button variant="secondary" onPress={onRetryLocalErase}>
                        Retry erase
                      </Button>
                    )
                    : (
                      <Button variant="danger" onPress={onConfirmLocalErase}>
                        Delete this device&apos;s data
                      </Button>
                    )}
                </FormActions>
              </Stack>
            )}
          </AdaptiveDialog>
        </Stack>

        <Stack gap={3} className="destruction-ui-everywhere">
          <Heading level={2} size="sm">Delete everywhere</Heading>
          <Text>
            Retire the synchronized generation, remove its Drive data and
            history, and erase this device. A browser that never reconnects
            cannot be erased; its inaccessible local copy is called out in the
            progress view.
          </Text>
          <AdaptiveDialog
            trigger={
              <Button
                variant="danger"
                isDisabled={!connected && deleteEverywhere.phase === "idle"}
                onPress={onOpenDeleteEverywhere}
              >
                Review deletion
              </Button>
            }
            title="Delete everywhere?"
            isOpen={deleteOpen}
            isDismissable={!deleteBusy}
            onOpenChange={(open) => {
              if (!open) onCancelDeleteEverywhere();
            }}
          >
            {(close) => (
              <Stack gap={4}>
                <InlineNotice
                  tone="danger"
                  title="Permanent synchronized deletion"
                >
                  This cannot be undone from the application. Retirement is
                  published before Drive deletion so old devices cannot upload
                  the retired generation again.
                </InlineNotice>
                <DefinitionList
                  items={[
                    {
                      term: "Generation",
                      description: deleteEverywhere.generation,
                    },
                    {
                      term: "Known devices",
                      description: deleteEverywhere.knownDeviceCount,
                    },
                    {
                      term: "Acknowledged",
                      description: deleteEverywhere.acknowledgedDeviceCount,
                    },
                  ]}
                />
                {deleteEverywhere.phase === "reviewing"
                  ? (
                    <Stack gap={3}>
                      <Text>
                        Create a complete JSON safety export before continuing.
                      </Text>
                      <FormActions>
                        <Button variant="secondary" onPress={onSafetyExport}>
                          Export complete safety copy
                        </Button>
                        <Button variant="quiet" onPress={onDeclineSafetyExport}>
                          Decline safety export
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={() => {
                            onCancelDeleteEverywhere();
                            close();
                          }}
                        >
                          Cancel
                        </Button>
                      </FormActions>
                    </Stack>
                  )
                  : null}
                {deleteEverywhere.phase === "confirming-decline"
                  ? (
                    <Stack gap={3}>
                      <InlineNotice
                        tone="warning"
                        title="No recovery copy will be created"
                      >
                        You explicitly declined the safety export. A separate
                        confirmation is required for permanent deletion.
                      </InlineNotice>
                      <FormActions>
                        <Button variant="danger" onPress={onConfirmDecline}>
                          Confirm intentional permanent deletion
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={onCancelDeleteEverywhere}
                        >
                          Cancel
                        </Button>
                      </FormActions>
                    </Stack>
                  )
                  : null}
                {deleteEverywhere.phase === "confirming"
                  ? (
                    <Stack gap={3}>
                      <Text>
                        {deleteEverywhere.safetyExported
                          ? "The complete safety copy is ready."
                          : "You confirmed that no safety copy is wanted."}
                      </Text>
                      <FormActions>
                        <Button
                          variant="danger"
                          onPress={onConfirmDeleteEverywhere}
                        >
                          Delete everywhere
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={onCancelDeleteEverywhere}
                        >
                          Cancel
                        </Button>
                      </FormActions>
                    </Stack>
                  )
                  : null}
                {[
                    "exporting",
                    "publishing-retirement",
                    "deleting-drive",
                    "erasing-local",
                    "awaiting-devices",
                    "forced-finalization",
                    "completed",
                  ].includes(deleteEverywhere.phase)
                  ? (
                    <WorkflowProgress
                      steps={progressSteps}
                      current={progressIndex(deleteEverywhere.phase)}
                      status={deleteEverywhere.revoking
                        ? "Revoking Google authorization"
                        : deleteEverywhere.phase === "awaiting-devices"
                        ? "Waiting for known devices"
                        : deleteEverywhere.phase === "forced-finalization"
                        ? "Forced finalization needs confirmation"
                        : "Delete Everywhere progress"}
                    />
                  )
                  : null}
                {deleteEverywhere.phase === "awaiting-devices"
                  ? (
                    <Stack gap={3}>
                      <InlineNotice
                        tone="warning"
                        title="Offline devices cannot be erased yet"
                      >
                        A browser cannot erase a device which never runs and
                        reconnects. Its inaccessible local copy remains, but the
                        retirement marker prevents a later old-generation
                        upload.
                      </InlineNotice>
                      <DeviceAcknowledgements devices={devices} />
                      <Button variant="danger" onPress={onForceFinalize}>
                        Force finalization for devices that cannot reconnect
                      </Button>
                    </Stack>
                  )
                  : null}
                {deleteEverywhere.phase === "forced-finalization"
                  ? (
                    <Stack gap={3}>
                      <InlineNotice
                        tone="danger"
                        title="The inaccessible browser copy cannot be erased"
                      >
                        Force finalization revokes authorization and completes
                        cloud retirement without claiming that a lost browser
                        was erased.
                      </InlineNotice>
                      <Button
                        variant="danger"
                        onPress={onConfirmDeleteEverywhere}
                      >
                        Confirm forced finalization
                      </Button>
                    </Stack>
                  )
                  : null}
                {deleteEverywhere.phase === "failed"
                  ? (
                    <InlineNotice
                      tone="danger"
                      title="Delete Everywhere needs attention"
                    >
                      {deleteEverywhere.error ??
                        "The destructive workflow failed before completion."}
                      <FormActions>
                        <Button
                          variant="secondary"
                          onPress={onRetryDeleteEverywhere}
                        >
                          Retry workflow
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={onCancelDeleteEverywhere}
                        >
                          Cancel
                        </Button>
                      </FormActions>
                    </InlineNotice>
                  )
                  : null}
                {deleteEverywhere.phase === "completed"
                  ? deleteEverywhere.error
                    ? (
                      <InlineNotice
                        tone="danger"
                        title="Authorization cleanup needs attention"
                      >
                        {deleteEverywhere.error}
                        <FormActions>
                          <Button
                            variant="secondary"
                            onPress={onRetryFinalization}
                          >
                            Retry authorization cleanup
                          </Button>
                        </FormActions>
                      </InlineNotice>
                    )
                    : (
                      <InlineNotice
                        tone="positive"
                        title="Dataset retirement completed"
                      >
                        {deleteEverywhere.revoking
                          ? "Finalizing account authorization."
                          : "Drive data and this device have been erased. Known devices were acknowledged or explicitly forced."}
                      </InlineNotice>
                    )
                  : null}
              </Stack>
            )}
          </AdaptiveDialog>
        </Stack>
      </Stack>
    </ContentContainer>
  );
}
