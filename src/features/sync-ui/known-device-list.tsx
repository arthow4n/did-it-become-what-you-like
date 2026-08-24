import { ArrowLeft, Check, Edit3 } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  ContentContainer,
  Disclosure,
  EmptyState,
  Heading,
  Icon,
  Inline,
  List,
  ListRow,
  PageHeader,
  Section,
  Stack,
  StatusMessage,
  Text,
  TextField,
} from "../../design-system/index.ts";
import type {
  DiagnosticDeviceViewModel,
  KnownDeviceListProps,
  KnownDeviceViewModel,
} from "./types.ts";

function DeviceRetirementStatus({
  device,
  onAcknowledge,
}: {
  readonly device: KnownDeviceViewModel;
  readonly onAcknowledge?: (device: KnownDeviceViewModel) => void;
}) {
  if (device.retirementAcknowledgement === "not-requested") return null;
  if (device.retirementAcknowledgement === "acknowledged") {
    return <Badge tone="positive">Retirement acknowledged</Badge>;
  }
  return (
    <Inline gap={2} className="sync-ui-device-row__retirement">
      <StatusMessage tone="warning">
        This device is awaiting retirement acknowledgement.
      </StatusMessage>
      {onAcknowledge
        ? (
          <Button
            variant="secondary"
            onPress={() => onAcknowledge(device)}
          >
            Acknowledge retirement
          </Button>
        )
        : null}
    </Inline>
  );
}

function DeviceRow({
  device,
  editing,
  draft,
  onStartRename,
  onDraftChange,
  onCancelRename,
  onSaveRename,
  onAcknowledge,
}: {
  readonly device: KnownDeviceViewModel;
  readonly editing: boolean;
  readonly draft: string;
  readonly onStartRename: () => void;
  readonly onDraftChange: (value: string) => void;
  readonly onCancelRename: () => void;
  readonly onSaveRename: () => void;
  readonly onAcknowledge?: (device: KnownDeviceViewModel) => void;
}) {
  return (
    <ListRow
      className="sync-ui-device-row"
      trailing={!editing
        ? (
          <Button
            variant="quiet"
            onPress={onStartRename}
            aria-label={`Rename ${device.label}`}
          >
            <Icon>
              <Edit3 />
            </Icon>
            Rename
          </Button>
        )
        : null}
    >
      <Stack gap={3} className="sync-ui-device-row__content">
        <Stack gap={1}>
          <Heading level={3} size="sm">{device.label}</Heading>
          <Inline gap={2}>
            {device.current
              ? <Badge tone="positive">Current device</Badge>
              : null}
            <Text tone="secondary" size="caption">
              Seen {device.lastSeenAt}
            </Text>
          </Inline>
        </Stack>

        <DeviceRetirementStatus
          device={device}
          onAcknowledge={onAcknowledge}
        />

        {editing
          ? (
            <Stack gap={3} className="sync-ui-device-rename">
              <TextField
                label={`New label for ${device.label}`}
                value={draft}
                onChange={onDraftChange}
                autoFocus
                description="Use a recognizable label up to 120 characters."
              />
              <Inline>
                <Button
                  onPress={onSaveRename}
                  isDisabled={draft.trim().length === 0}
                >
                  <Icon>
                    <Check />
                  </Icon>
                  Save name
                </Button>
                <Button variant="secondary" onPress={onCancelRename}>
                  Cancel
                </Button>
              </Inline>
            </Stack>
          )
          : null}
      </Stack>
    </ListRow>
  );
}

function TechnicalDetails({
  details,
}: {
  readonly details: readonly DiagnosticDeviceViewModel[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Disclosure
      title="Show technical details"
      isExpanded={expanded}
      onExpandedChange={setExpanded}
    >
      {expanded
        ? (
          <List label="Device technical details">
            {details.map((device) => (
              <ListRow key={`${device.stableKey}-technical`}>
                <Stack gap={1}>
                  <Text>{device.label}</Text>
                  <Text tone="secondary" size="caption">
                    Technical device identifier: {device.id}
                  </Text>
                </Stack>
              </ListRow>
            ))}
          </List>
        )
        : null}
    </Disclosure>
  );
}

export function KnownDeviceList({
  devices,
  technicalDetails,
  onRename,
  onAcknowledgeRetirement,
}: KnownDeviceListProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editingDevice = devices.find((device) =>
    device.stableKey === editingKey
  );

  const startRename = (device: KnownDeviceViewModel) => {
    setEditingKey(device.stableKey);
    setDraft(device.label);
  };
  const cancelRename = () => {
    setEditingKey(null);
    setDraft("");
  };
  const saveRename = () => {
    if (editingDevice === undefined || draft.trim().length === 0) return;
    onRename?.(editingDevice, draft.trim());
    cancelRename();
  };

  return (
    <Section className="sync-ui-device-list">
      <Stack gap={4}>
        <Heading level={2} size="sm">Known devices</Heading>
        {devices.length === 0
          ? (
            <EmptyState title="No known devices">
              Devices appear here after they connect to this synchronized
              dataset.
            </EmptyState>
          )
          : (
            <List label="Known devices">
              {devices.map((device) => (
                <DeviceRow
                  key={device.stableKey}
                  device={device}
                  editing={device.stableKey === editingKey}
                  draft={draft}
                  onStartRename={() => startRename(device)}
                  onDraftChange={setDraft}
                  onCancelRename={cancelRename}
                  onSaveRename={saveRename}
                  onAcknowledge={onAcknowledgeRetirement}
                />
              ))}
            </List>
          )}
        <Text tone="secondary">
          Devices receive changes only when the app reconnects. Inactive devices
          are not removed automatically.
        </Text>
        {technicalDetails && technicalDetails.length > 0
          ? <TechnicalDetails details={technicalDetails} />
          : null}
      </Stack>
    </Section>
  );
}

export type KnownDevicesScreenProps = KnownDeviceListProps & {
  readonly onBack?: () => void;
};

export function KnownDevicesScreen(
  { onBack, ...props }: KnownDevicesScreenProps,
) {
  return (
    <ContentContainer size="readable" className="sync-ui-screen">
      <Stack gap={5}>
        <PageHeader
          title="Known devices"
          eyebrow="Google Drive"
          leading={onBack
            ? (
              <Button
                variant="quiet"
                onPress={() => onBack()}
                aria-label="Back to Google Drive synchronization"
              >
                <Icon>
                  <ArrowLeft />
                </Icon>
                <span>Google Drive</span>
              </Button>
            )
            : null}
        />
        <KnownDeviceList {...props} />
      </Stack>
    </ContentContainer>
  );
}
