import type { TestClock } from "./clock.ts";
import type { IdFactory } from "./ids.ts";

export type DriveFile = {
  fileId: string;
  name: string;
  body: string;
  etag: string;
  updatedAt: string;
};

export type DriveWriteResult =
  | { ok: true; file: DriveFile }
  | { ok: false; reason: "not-found" | "precondition-failed" };

export type FakeDrivePort = {
  listAppData(): Promise<DriveFile[]>;
  readAppData(name: string): Promise<DriveFile | undefined>;
  writeAppData(
    name: string,
    body: string,
    expectedEtag?: string,
  ): Promise<DriveWriteResult>;
  deleteAppData(name: string, expectedEtag?: string): Promise<boolean>;
  readonly writes: readonly DriveFile[];
};

export function createFakeDrivePort(
  clock: TestClock,
  ids: IdFactory,
): FakeDrivePort {
  const files = new Map<string, DriveFile>();
  const writes: DriveFile[] = [];

  return {
    listAppData: () => Promise.resolve([...files.values()].map(cloneFile)),
    readAppData: (name) => {
      const file = files.get(name);
      return Promise.resolve(file ? cloneFile(file) : undefined);
    },
    writeAppData: (name, body, expectedEtag) => {
      const current = files.get(name);
      if (expectedEtag !== undefined && current?.etag !== expectedEtag) {
        return Promise.resolve(
          {
            ok: false,
            reason: current ? "precondition-failed" : "not-found",
          } as const,
        );
      }
      const file: DriveFile = {
        fileId: current?.fileId ?? ids.next("drive-file"),
        name,
        body,
        etag: ids.next("etag"),
        updatedAt: clock.nowIso(),
      };
      files.set(name, file);
      writes.push(cloneFile(file));
      return Promise.resolve({ ok: true, file: cloneFile(file) } as const);
    },
    deleteAppData: (name, expectedEtag) => {
      const current = files.get(name);
      if (!current) return Promise.resolve(false);
      if (expectedEtag !== undefined && expectedEtag !== current.etag) {
        return Promise.resolve(false);
      }
      files.delete(name);
      return Promise.resolve(true);
    },
    get writes() {
      return writes;
    },
  };
}

function cloneFile(file: DriveFile): DriveFile {
  return { ...file };
}
