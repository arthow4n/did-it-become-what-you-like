import { AlertTriangle, ArrowLeft, Cloud } from "lucide-react";
import {
  Button,
  Card,
  ConfirmDialog,
  ContentContainer,
  DefinitionList,
  ErrorState,
  Heading,
  Icon,
  Inline,
  InlineNotice,
  PageHeader,
  Progress,
  Section,
  Stack,
  StatusDot,
  StatusPanel,
  Text,
} from "../../design-system/index.ts";
import {
  canSyncNow,
  configuredModeLabel,
  syncNowDisabledReason,
  syncStatusCopy,
} from "./sync-status.ts";
import type { SyncAccountPanelProps } from "./types.ts";

function LastSync({ value }: { readonly value: string | null }) {
  return value === null ? "Not synchronized yet" : value;
}

function DisconnectedPanel(
  { onConnect }: Pick<SyncAccountPanelProps, "onConnect">,
) {
  return (
    <Section className="sync-ui-account-panel">
      <Stack gap={4}>
        <Inline gap={3}>
          <Icon>
            <Cloud />
          </Icon>
          <Stack gap={1}>
            <Heading level={2} size="sm">Connect Google Drive</Heading>
            <Text tone="secondary">
              Synchronize this dataset through Google's hidden application-data
              folder.
            </Text>
          </Stack>
        </Inline>
        <InlineNotice title="Not connected" tone="info">
          Local expenses remain available without an account. Connection asks
          only for access to this app's private Drive data.
        </InlineNotice>
        <Inline>
          <Button onPress={() => onConnect()}>Connect Google Drive</Button>
        </Inline>
      </Stack>
    </Section>
  );
}

function ConnectingPanel() {
  return (
    <Section className="sync-ui-account-panel">
      <StatusPanel
        title="Connecting to Google Drive"
        detail="Complete the Google authorization window to continue."
        tone="info"
      />
      <Progress label="Connecting to Google Drive" indeterminate />
    </Section>
  );
}

function AccountSwitchPanel({
  view,
  onConfirmAccountSwitch,
  onCancelAccountSwitch,
}: Pick<
  SyncAccountPanelProps,
  "view" | "onConfirmAccountSwitch" | "onCancelAccountSwitch"
>) {
  if (view.mode !== "account-switch-confirmation") return null;
  return (
    <Section className="sync-ui-account-panel">
      <InlineNotice title="Switch Google account?" tone="warning">
        <Stack gap={3}>
          <Text>
            The current account is{" "}
            <strong>{view.currentAccountEmail}</strong>. Switching to{" "}
            <strong>{view.requestedAccountEmail}</strong>{" "}
            requires explicit confirmation and never merges accounts
            automatically.
          </Text>
          <Inline>
            <Button
              onPress={() => onConfirmAccountSwitch?.()}
              isDisabled={!onConfirmAccountSwitch}
            >
              Switch account
            </Button>
            <Button
              variant="secondary"
              onPress={() => onCancelAccountSwitch?.()}
              isDisabled={!onCancelAccountSwitch}
            >
              Cancel
            </Button>
          </Inline>
        </Stack>
      </InlineNotice>
    </Section>
  );
}

function ConfiguredPanel(props: SyncAccountPanelProps) {
  const { view } = props;
  if (view.mode !== "configured") return null;
  const copy = syncStatusCopy(view);
  const syncNowAllowed = canSyncNow(view);
  const disabledReason = syncNowDisabledReason(view);
  const hasConflicts = view.unresolvedConflictCount > 0 ||
    view.sync === "conflict";

  return (
    <Section className="sync-ui-account-panel">
      <Stack gap={5}>
        <StatusPanel
          title="Connected account"
          detail={view.accountEmail}
          tone="positive"
          action={<StatusDot tone="positive">Connected</StatusDot>}
        />

        <StatusPanel
          title={`Status: ${configuredModeLabel(view.sync)}`}
          detail={copy.detail}
          tone={copy.tone}
          action={<StatusDot tone={copy.tone}>{copy.label}</StatusDot>}
        />

        <DefinitionList
          items={[
            {
              term: "Last successful sync",
              description: <LastSync value={view.lastSyncedAt} />,
            },
            {
              term: "Pending local changes",
              description: view.pendingChangeCount,
            },
            { term: "Known devices", description: props.knownDeviceCount },
          ]}
        />

        {view.sync === "syncing"
          ? <Progress label="Synchronization in progress" indeterminate />
          : null}
        {view.sync === "recovering"
          ? (
            <Stack gap={2}>
              <Progress
                label="Repairing malformed Google Drive sync data"
                indeterminate
              />
              <Text tone="secondary">
                Removing only the hidden causal sync file. Local data stays on
                this device.
              </Text>
            </Stack>
          )
          : null}

        {view.network === "offline"
          ? (
            <InlineNotice title="Offline" tone="warning">
              Locally saved changes remain pending and will sync after the app
              reconnects.
            </InlineNotice>
          )
          : null}
        {view.network === "reconnecting"
          ? (
            <InlineNotice title="Reconnecting" tone="warning">
              Synchronization is waiting for the connection to return.
            </InlineNotice>
          )
          : null}

        {view.sync === "authorization-error"
          ? (
            <ErrorState
              title="Google Drive authorization failed"
              action={
                <Button
                  onPress={() => props.onReconnect?.()}
                  isDisabled={!props.onReconnect}
                >
                  Reconnect Google Drive
                </Button>
              }
            >
              {view.message ??
                "Reconnect to authorize synchronization again. Local data stays on this device."}
            </ErrorState>
          )
          : null}
        {view.sync === "retryable-error" || view.sync === "error"
          ? (
            <ErrorState
              title={view.sync === "retryable-error"
                ? "Synchronization needs a retry"
                : "Synchronization failed"}
              action={
                <Stack gap={2}>
                  <Button
                    onPress={() => props.onRetry?.()}
                    isDisabled={!props.onRetry}
                  >
                    Retry synchronization
                  </Button>
                  {view.sync === "error" &&
                      view.errorCode === "corrupt-data" &&
                      view.recoveryAvailable
                    ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="danger">
                            Reset hidden Drive sync file
                          </Button>
                        }
                        title="Reset hidden Google Drive sync file?"
                        description={
                          <>
                            This deletes the malformed hidden cloud sync file
                            only. It does not delete or replace this device's
                            local IndexedDB data, and it never deletes the
                            dataset retirement marker. Unsynced changes on other
                            devices may be lost, so reconnect those devices and
                            verify their data afterward.
                          </>
                        }
                        confirmLabel="Delete remote sync file"
                        confirmVariant="danger"
                        onConfirm={() => props.onRecoverCorruptData?.()}
                      />
                    )
                    : null}
                </Stack>
              }
            >
              {view.message ??
                "No local changes were lost. Review the error and retry when ready."}
              {view.diagnosticOperation
                ? (
                  <>
                    <br />
                    Diagnostic code: {view.diagnosticOperation}
                  </>
                )
                : null}
            </ErrorState>
          )
          : null}
        {view.sync === "retired"
          ? (
            <ErrorState title="This dataset is retired">
              {view.message ??
                "This device will not upload to the retired dataset. Disconnect it or follow the deletion workflow."}
            </ErrorState>
          )
          : null}

        <Stack gap={2} className="sync-ui-account-panel__primary-action">
          <Button
            onPress={() => props.onSyncNow?.()}
            isDisabled={!syncNowAllowed || !props.onSyncNow}
            pending={view.sync === "syncing"}
          >
            Sync now
          </Button>
          {disabledReason
            ? <Text tone="secondary" size="caption">{disabledReason}</Text>
            : null}
        </Stack>

        {hasConflicts
          ? (
            <Card className="sync-ui-conflict-summary">
              <Stack gap={3}>
                <Inline gap={2}>
                  <Icon>
                    <AlertTriangle />
                  </Icon>
                  <Heading level={2} size="sm">Conflicts need review</Heading>
                </Inline>
                <Text>
                  {view.unresolvedConflictCount}{" "}
                  unresolved conflict{view.unresolvedConflictCount === 1
                    ? ""
                    : "s"}{" "}
                  remain. Non-conflicting data can continue synchronizing.
                </Text>
                <Button
                  variant="secondary"
                  onPress={() => props.onOpenConflicts?.()}
                  isDisabled={!props.onOpenConflicts}
                >
                  Review conflicts
                </Button>
              </Stack>
            </Card>
          )
          : null}

        <Stack gap={3}>
          <Button
            variant="secondary"
            onPress={() => props.onManageDevices?.()}
            isDisabled={!props.onManageDevices}
          >
            Manage devices ({props.knownDeviceCount})
          </Button>
          <Inline>
            <Button
              variant="quiet"
              onPress={() => props.onSwitchAccount?.()}
              isDisabled={!props.onSwitchAccount}
            >
              Switch Google account
            </Button>
            <Button
              variant="quiet"
              onPress={() => props.onDisconnect?.()}
              isDisabled={!props.onDisconnect}
            >
              Disconnect this device
            </Button>
          </Inline>
        </Stack>
      </Stack>
    </Section>
  );
}

export function SyncAccountPanel(props: SyncAccountPanelProps) {
  if (props.view.mode === "disconnected") {
    return <DisconnectedPanel onConnect={props.onConnect} />;
  }
  if (props.view.mode === "connecting") return <ConnectingPanel />;
  if (props.view.mode === "account-switch-confirmation") {
    return <AccountSwitchPanel {...props} />;
  }
  return <ConfiguredPanel {...props} />;
}

export type GoogleDriveSyncScreenProps = SyncAccountPanelProps & {
  readonly onBack?: () => void;
};

export function GoogleDriveSyncScreen(
  { onBack, ...props }: GoogleDriveSyncScreenProps,
) {
  return (
    <ContentContainer size="readable" className="sync-ui-screen">
      <Stack gap={5}>
        <PageHeader
          title="Google Drive and synchronization"
          headingLevel={1}
          leading={onBack
            ? (
              <Button
                variant="quiet"
                onPress={() => onBack()}
                aria-label="Back to settings"
              >
                <Icon>
                  <ArrowLeft />
                </Icon>
                <span>Settings</span>
              </Button>
            )
            : null}
        />
        <SyncAccountPanel {...props} />
      </Stack>
    </ContentContainer>
  );
}
