export type SyncNetworkMode = "online" | "offline" | "reconnecting";

export type ConfiguredSyncMode =
  | "synced"
  | "syncing"
  | "recovering"
  | "conflict"
  | "authorization-error"
  | "retryable-error"
  | "error"
  | "retired";

/**
 * A screen view model derived by the shell from the S-402 actor snapshot.
 * The feature does not infer these modes from independent boolean props.
 */
export type SyncConnectionViewModel =
  | { readonly mode: "disconnected" }
  | { readonly mode: "connecting" }
  | {
    readonly mode: "account-switch-confirmation";
    readonly currentAccountEmail: string;
    readonly requestedAccountEmail: string;
  }
  | {
    readonly mode: "configured";
    readonly accountEmail: string;
    readonly network: SyncNetworkMode;
    readonly sync: ConfiguredSyncMode;
    readonly lastSyncedAt: string | null;
    readonly pendingChangeCount: number;
    readonly unresolvedConflictCount: number;
    readonly message?: string;
    /** Safe adapter boundary identifier shown only to aid troubleshooting. */
    readonly diagnosticOperation?: string;
    readonly errorCode?:
      | "aborted"
      | "offline"
      | "unauthorized"
      | "forbidden"
      | "not-found"
      | "conflict"
      | "quota"
      | "corrupt-data"
      | "partial-transport"
      | "rate-limited"
      | "invalid-request"
      | "invalid-output"
      | "invalid"
      | "unsupported"
      | "unavailable"
      | "retired"
      | "unknown";
    readonly recoveryAvailable?: boolean;
  };

export type KnownDeviceViewModel = {
  /** Stable non-presentational identity supplied by the actor-facing owner. */
  readonly stableKey: string;
  readonly label: string;
  readonly lastSeenAt: string;
  readonly current: boolean;
  readonly retirementAcknowledgement:
    | "not-requested"
    | "pending"
    | "acknowledged";
};

export type DiagnosticDeviceViewModel = KnownDeviceViewModel & {
  /** Rendered only inside the explicitly opened technical-details projection. */
  readonly id: string;
  /** The exact source timestamp is diagnostic-only, never ordinary copy. */
  readonly exactLastSeenAt?: string;
};

export type SyncAccountPanelCallbacks = {
  readonly onConnect: () => void;
  readonly onReconnect?: () => void;
  readonly onRetry?: () => void;
  readonly onRecoverCorruptData?: () => void;
  readonly onSyncNow?: () => void;
  readonly onOpenConflicts?: () => void;
  readonly onManageDevices?: () => void;
  readonly onSwitchAccount?: () => void;
  readonly onDisconnect?: () => void;
  readonly onConfirmAccountSwitch?: () => void;
  readonly onCancelAccountSwitch?: () => void;
};

export type SyncAccountPanelProps = SyncAccountPanelCallbacks & {
  readonly view: SyncConnectionViewModel;
  readonly knownDeviceCount: number;
};

export type KnownDeviceListProps = {
  readonly devices: readonly KnownDeviceViewModel[];
  readonly technicalDetails?: readonly DiagnosticDeviceViewModel[];
  readonly onRename?: (
    device: KnownDeviceViewModel,
    nextLabel: string,
  ) => void;
  readonly onAcknowledgeRetirement?: (device: KnownDeviceViewModel) => void;
};
