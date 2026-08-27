import {
  adapterError,
  type ClockPort,
  type IdPort,
  type JsonValue,
  type LocalPort,
} from "../ports/index.ts";
import {
  type Device,
  DeviceSchema,
  StableIdSchema,
} from "../../domain/index.ts";

export const DEVICE_REGISTRY_KEY = "s402:device-registry";
export const DEVICE_REGISTRY_VERSION = 1 as const;

export type DeviceRegistryState = {
  readonly version: typeof DEVICE_REGISTRY_VERSION;
  readonly currentDeviceId: string;
  readonly accountEmail: string | null;
  readonly devices: readonly Device[];
  readonly acknowledgements: Readonly<Record<string, boolean>>;
};

export type KnownDeviceProjection = {
  readonly label: string;
  readonly lastSeenAt: string;
  readonly acknowledged: boolean;
  readonly current: boolean;
};

export type DiagnosticDeviceProjection = KnownDeviceProjection & {
  readonly id: string;
};

export type DeviceRegistry = {
  readonly hydrate: () => Promise<DeviceRegistryState>;
  readonly state: () => DeviceRegistryState;
  readonly revision: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly configureAccount: (
    accountEmail: string,
    confirmed: boolean,
  ) => Promise<"configured" | "confirmation-required">;
  readonly register: (
    deviceId: string,
    label?: string,
    options?: { readonly acknowledge?: boolean },
  ) => Promise<void>;
  readonly rename: (deviceId: string, label: string) => Promise<void>;
  readonly touch: (deviceId?: string) => Promise<void>;
  readonly acknowledge: (deviceId: string) => Promise<void>;
  readonly merge: (devices: readonly Device[]) => Promise<void>;
  readonly ordinaryProjection: () => readonly KnownDeviceProjection[];
  readonly diagnosticProjection: () => readonly DiagnosticDeviceProjection[];
  readonly portableDevices: () => readonly Device[];
};

type PersistedRegistry = DeviceRegistryState & {
  readonly type: "s402-device-registry";
};

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" &&
      !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeLabel(label: string): string {
  const normalized = label.trim();
  if (normalized.length === 0 || normalized.length > 120) {
    throw adapterError("invalid-request", "sync.device.rename");
  }
  return normalized;
}

function parseState(value: unknown): DeviceRegistryState {
  const object = asObject(value);
  if (
    object?.type !== "s402-device-registry" ||
    object.version !== DEVICE_REGISTRY_VERSION ||
    typeof object.currentDeviceId !== "string" ||
    typeof object.accountEmail !== "string" && object.accountEmail !== null ||
    !Array.isArray(object.devices) ||
    object.acknowledgements === null ||
    typeof object.acknowledgements !== "object" ||
    Array.isArray(object.acknowledgements)
  ) {
    throw adapterError("corrupt-data", "sync.device-registry");
  }
  const currentDeviceId = StableIdSchema.safeParse(object.currentDeviceId);
  if (!currentDeviceId.success) {
    throw adapterError("corrupt-data", "sync.device-registry");
  }
  const devices: Device[] = [];
  for (const value of object.devices) {
    const parsed = DeviceSchema.safeParse(value);
    if (!parsed.success) {
      throw adapterError("corrupt-data", "sync.device-registry");
    }
    devices.push(parsed.data);
  }
  const acknowledgements: Record<string, boolean> = {};
  for (const [key, acknowledged] of Object.entries(object.acknowledgements)) {
    if (
      !StableIdSchema.safeParse(key).success ||
      typeof acknowledged !== "boolean"
    ) {
      throw adapterError("corrupt-data", "sync.device-registry");
    }
    acknowledgements[key] = acknowledged;
  }
  if (!devices.some((device) => device.id === currentDeviceId.data)) {
    throw adapterError("corrupt-data", "sync.device-registry");
  }
  return {
    version: DEVICE_REGISTRY_VERSION,
    currentDeviceId: currentDeviceId.data,
    accountEmail: object.accountEmail,
    devices,
    acknowledgements,
  };
}

function defaultState(
  deviceId: string,
  now: string,
): DeviceRegistryState {
  const currentDeviceId = StableIdSchema.parse(deviceId);
  const device = DeviceSchema.parse({
    schemaVersion: 1,
    type: "device",
    id: currentDeviceId,
    label: "Device 1",
    createdAt: now,
    lastSeenAt: now,
  });
  return {
    version: DEVICE_REGISTRY_VERSION,
    currentDeviceId,
    accountEmail: null,
    devices: [device],
    acknowledgements: { [currentDeviceId]: true },
  };
}

export function createDeviceRegistry(options: {
  readonly local: LocalPort;
  readonly deviceId: string;
  readonly clock: Pick<ClockPort, "now">;
  readonly ids?: Pick<IdPort, "next">;
}): DeviceRegistry {
  let current = defaultState(options.deviceId, options.clock.now());
  let currentRevision = 0;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    currentRevision += 1;
    for (const listener of listeners) listener();
  };

  const persist = async (): Promise<void> => {
    const value: PersistedRegistry = {
      type: "s402-device-registry",
      ...current,
    };
    await options.local.transaction("readwrite", async (transaction) => {
      await transaction.put(
        "sync-metadata",
        DEVICE_REGISTRY_KEY,
        asJsonValue(value),
      );
    });
  };

  const hydrate = async (): Promise<DeviceRegistryState> => {
    const value = await options.local.transaction(
      "readonly",
      (transaction) =>
        transaction.get<JsonValue>("sync-metadata", DEVICE_REGISTRY_KEY),
    );
    if (value === undefined) {
      await persist();
      return current;
    }
    current = parseState(value);
    notify();
    return current;
  };

  const findDevice = (deviceId: string): Device => {
    const parsed = StableIdSchema.safeParse(deviceId);
    if (!parsed.success) throw adapterError("invalid-request", "sync.device");
    const device = current.devices.find((candidate) =>
      candidate.id === parsed.data
    );
    if (device === undefined) throw adapterError("not-found", "sync.device");
    return device;
  };

  const replaceDevice = (next: Device): void => {
    current = {
      ...current,
      devices: current.devices.map((device) =>
        device.id === next.id ? next : device
      ),
    };
  };

  return {
    hydrate,
    state: () => structuredClone(current),
    revision: () => currentRevision,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    configureAccount: async (accountEmail, confirmed) => {
      if (accountEmail.trim().length === 0) {
        throw adapterError("invalid-request", "sync.account.configure");
      }
      if (
        current.accountEmail !== null &&
        current.accountEmail !== accountEmail &&
        !confirmed
      ) return "confirmation-required";
      current = { ...current, accountEmail };
      await persist();
      notify();
      return "configured";
    },
    register: async (deviceId, label, registerOptions = {}) => {
      const parsedId = StableIdSchema.safeParse(deviceId);
      if (!parsedId.success) {
        throw adapterError("invalid-request", "sync.device.register");
      }
      if (current.devices.some((device) => device.id === parsedId.data)) {
        if (registerOptions.acknowledge) {
          await (async () => {
            current = {
              ...current,
              acknowledgements: {
                ...current.acknowledgements,
                [parsedId.data]: true,
              },
            };
            await persist();
            notify();
          })();
        }
        return;
      }
      const nextLabel = label === undefined
        ? `Device ${current.devices.length + 1}`
        : normalizeLabel(label);
      const now = options.clock.now();
      const device = DeviceSchema.parse({
        schemaVersion: 1,
        type: "device",
        id: parsedId.data,
        label: nextLabel,
        createdAt: now,
        lastSeenAt: now,
      });
      current = {
        ...current,
        devices: [...current.devices, device],
        acknowledgements: {
          ...current.acknowledgements,
          [parsedId.data]: registerOptions.acknowledge === true,
        },
      };
      await persist();
      notify();
    },
    rename: async (deviceId, label) => {
      const device = findDevice(deviceId);
      replaceDevice({ ...device, label: normalizeLabel(label) });
      await persist();
      notify();
    },
    touch: async (deviceId = current.currentDeviceId) => {
      const device = findDevice(deviceId);
      replaceDevice({ ...device, lastSeenAt: options.clock.now() });
      await persist();
      notify();
    },
    acknowledge: async (deviceId) => {
      findDevice(deviceId);
      current = {
        ...current,
        acknowledgements: {
          ...current.acknowledgements,
          [deviceId]: true,
        },
      };
      await persist();
      notify();
    },
    merge: async (devices) => {
      for (const candidate of devices) {
        const parsed = DeviceSchema.safeParse(candidate);
        if (!parsed.success) {
          throw adapterError("corrupt-data", "sync.device.merge");
        }
        const existing = current.devices.find((device) =>
          device.id === parsed.data.id
        );
        if (existing === undefined) {
          current = {
            ...current,
            devices: [...current.devices, parsed.data],
            acknowledgements: {
              ...current.acknowledgements,
              [parsed.data.id]: false,
            },
          };
        } else if (existing.id !== current.currentDeviceId) {
          replaceDevice(parsed.data);
        }
      }
      await persist();
      notify();
    },
    ordinaryProjection: () =>
      current.devices.map((device) => ({
        label: device.label ?? "Unnamed device",
        lastSeenAt: device.lastSeenAt,
        acknowledged: current.acknowledgements[device.id] === true,
        current: device.id === current.currentDeviceId,
      })),
    diagnosticProjection: () =>
      current.devices.map((device) => ({
        id: device.id,
        label: device.label ?? "Unnamed device",
        lastSeenAt: device.lastSeenAt,
        acknowledged: current.acknowledgements[device.id] === true,
        current: device.id === current.currentDeviceId,
      })),
    portableDevices: () => structuredClone(current.devices),
  };
}
