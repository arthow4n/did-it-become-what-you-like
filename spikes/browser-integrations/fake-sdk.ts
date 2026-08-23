export const DRIVE_APP_DATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";
export const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
export const DRIVE_USER_FIELDS = "user(displayName,emailAddress,permissionId)";

export type TokenCallback = (response: FakeTokenResponse) => void;

export interface FakeTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
}

export interface TokenClientConfig {
  callback: TokenCallback;
  client_id: string;
  scope: string;
}

export interface TokenClient {
  requestAccessToken(): void;
}

export interface DriveFile {
  etag: string;
  id: string;
  mimeType: string;
  modifiedTime: string;
  name: string;
  parents: ["appDataFolder"];
  body: string;
}

export interface DriveListRequest {
  fields: string;
  pageSize: number;
  pageToken?: string;
  spaces: "appDataFolder";
}

export interface DriveCreateRequest {
  media: {
    body: string;
    mimeType: "application/json";
  };
  requestBody: {
    mimeType: "application/json";
    name: string;
    parents: ["appDataFolder"];
  };
}

export interface DriveUpdateRequest {
  fileId: string;
  ifMatch: string;
  media: {
    body: string;
    mimeType: "application/json";
  };
}

export type DriveCall =
  | { method: "about.get"; fields: string }
  | { method: "files.list"; request: DriveListRequest }
  | { method: "files.create"; request: DriveCreateRequest }
  | { method: "files.update"; request: DriveUpdateRequest };

function requireAccessToken(token: string): void {
  if (token !== "synthetic-drive-token") {
    throw new Error("fake Drive call rejected: token is not synthetic");
  }
}

/**
 * A small model of the GIS token client. The real client only opens its
 * account/consent dialog from a user gesture; this fixture makes that rule
 * explicit instead of silently accepting background authorization.
 */
export class FakeGoogleIdentity {
  readonly tokenResponses: FakeTokenResponse[] = [];
  private gestureDepth = 0;
  private nextTokenClient?: TokenClientConfig;

  initTokenClient(config: TokenClientConfig): TokenClient {
    if (config.scope !== DRIVE_APP_DATA_SCOPE) {
      throw new Error("fake GIS client rejected an unexpected scope");
    }
    if (config.client_id.length === 0) {
      throw new Error("fake GIS client requires a web client ID");
    }

    this.nextTokenClient = config;
    return {
      requestAccessToken: () => {
        if (this.gestureDepth === 0) {
          throw new Error("requestAccessToken must follow a user gesture");
        }
        const response: FakeTokenResponse = {
          access_token: "synthetic-drive-token",
          expires_in: 3600,
          scope: DRIVE_APP_DATA_SCOPE,
          token_type: "Bearer",
        };
        this.tokenResponses.push(response);
        this.nextTokenClient?.callback(response);
      },
    };
  }

  runUserGesture(action: () => void): void {
    this.gestureDepth += 1;
    try {
      action();
    } finally {
      this.gestureDepth -= 1;
    }
  }
}

/**
 * A fake of the REST/gapi boundary used by the future browser adapter. It
 * refuses ordinary Drive-space requests and records the exact request shape.
 */
export class FakeDriveApi {
  readonly calls: DriveCall[] = [];
  private readonly files = new Map<string, DriveFile>();
  private nextId = 1;
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  aboutGet(fields: string): { user: { emailAddress: string } } {
    requireAccessToken(this.token);
    if (fields !== DRIVE_USER_FIELDS) {
      throw new Error(
        "fake Drive about.get requires an explicit user field set",
      );
    }
    this.calls.push({ method: "about.get", fields });
    return { user: { emailAddress: "synthetic-owner@example.test" } };
  }

  filesList(request: DriveListRequest): {
    files: DriveFile[];
    nextPageToken?: string;
  } {
    requireAccessToken(this.token);
    if (request.spaces !== "appDataFolder") {
      throw new Error("fake Drive list is restricted to appDataFolder");
    }
    if (request.pageSize < 1 || request.pageSize > 1000) {
      throw new Error("fake Drive list pageSize must be between 1 and 1000");
    }
    this.calls.push({ method: "files.list", request });
    const allFiles = [...this.files.values()];
    const offset = request.pageToken === undefined
      ? 0
      : Number.parseInt(request.pageToken, 10);
    const files = allFiles.slice(offset, offset + request.pageSize);
    const nextOffset = offset + files.length;
    return {
      files,
      ...(nextOffset < allFiles.length
        ? { nextPageToken: String(nextOffset) }
        : {}),
    };
  }

  filesCreate(request: DriveCreateRequest): DriveFile {
    requireAccessToken(this.token);
    if (request.requestBody.parents[0] !== "appDataFolder") {
      throw new Error("fake Drive create requires appDataFolder parent");
    }
    this.calls.push({ method: "files.create", request });
    const id = `synthetic-file-${this.nextId++}`;
    const file: DriveFile = {
      body: request.media.body,
      etag: `"${id}-1"`,
      id,
      mimeType: request.requestBody.mimeType,
      modifiedTime: "2026-08-23T12:00:00.000Z",
      name: request.requestBody.name,
      parents: ["appDataFolder"],
    };
    this.files.set(id, file);
    return file;
  }

  filesUpdate(request: DriveUpdateRequest): DriveFile {
    requireAccessToken(this.token);
    const current = this.files.get(request.fileId);
    if (current === undefined) {
      throw new Error("fake Drive update cannot find the app-data file");
    }
    if (current.etag !== request.ifMatch) {
      throw new Error("fake Drive update rejected a stale ETag");
    }
    this.calls.push({ method: "files.update", request });
    const revision =
      Number.parseInt(current.etag.split("-").at(-1) ?? "1", 10) + 1;
    const updated: DriveFile = {
      ...current,
      body: request.media.body,
      etag: `"${current.id}-${revision}"`,
      modifiedTime: "2026-08-23T12:01:00.000Z",
    };
    this.files.set(updated.id, updated);
    return updated;
  }
}

export interface JsonSchema {
  additionalProperties?: boolean;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type:
    | "array"
    | "boolean"
    | "integer"
    | "null"
    | "number"
    | "object"
    | "string"
    | Array<
      | "array"
      | "boolean"
      | "integer"
      | "null"
      | "number"
      | "object"
      | "string"
    >;
}

export interface GeminiModel {
  baseModelId: string;
  inputTokenLimit: number;
  name: string;
  supportedGenerationMethods: string[];
}

export interface GeminiListRequest {
  pageSize?: number;
  pageToken?: string;
}

export interface GeminiListResponse {
  models: GeminiModel[];
  nextPageToken?: string;
}

export interface GeminiGenerateRequest {
  config: {
    responseMimeType: "application/json";
    responseSchema: JsonSchema;
    systemInstruction: string;
  };
  contents: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  >;
  model: string;
}

export interface GeminiGenerateResponse {
  text: string;
}

/** Fake surface aligned with `ai.models.list` and `ai.models.generateContent`. */
export class FakeGoogleGenAI {
  readonly listRequests: GeminiListRequest[] = [];
  readonly generateRequests: GeminiGenerateRequest[] = [];
  readonly models = {
    generateContent: (
      request: GeminiGenerateRequest,
    ): GeminiGenerateResponse => {
      this.generateRequests.push(request);
      if (request.model !== "gemini-receipt-test") {
        throw new Error(
          "fake Gemini rejected a model without a synthetic test",
        );
      }
      if (request.config.responseMimeType !== "application/json") {
        throw new Error("fake Gemini requires JSON structured output");
      }
      if (request.contents.length !== 2 || !("text" in request.contents[0])) {
        throw new Error("fake Gemini requires text before the image");
      }
      if (!this.isSyntheticImage(request.contents[1])) {
        throw new Error("fake Gemini requires the synthetic image fixture");
      }
      return { text: JSON.stringify(SYNTHETIC_RECEIPT_OUTPUT) };
    },
    list: (request: GeminiListRequest = {}): GeminiListResponse => {
      this.listRequests.push(request);
      const pageSize = Math.min(request.pageSize ?? 50, 1000);
      const models: GeminiModel[] = [
        {
          baseModelId: "gemini-receipt-test",
          inputTokenLimit: 32_000,
          name: "models/receipt-needs-test",
          supportedGenerationMethods: ["generateContent"],
        },
        {
          baseModelId: "gemini-text-only",
          inputTokenLimit: 16_000,
          name: "models/text-only",
          supportedGenerationMethods: ["countTokens"],
        },
      ];
      const offset = request.pageToken === undefined
        ? 0
        : Number.parseInt(request.pageToken, 10);
      const page = models.slice(offset, offset + pageSize);
      const nextOffset = offset + page.length;
      return {
        models: page,
        ...(nextOffset < models.length
          ? { nextPageToken: String(nextOffset) }
          : {}),
      };
    },
  };

  private isSyntheticImage(
    content: { text: string } | {
      inlineData: { data: string; mimeType: string };
    },
  ): content is { inlineData: { data: string; mimeType: string } } {
    return "inlineData" in content &&
      content.inlineData.mimeType === "image/jpeg" &&
      content.inlineData.data === "c3ludGhldGljLWltYWdl";
  }
}

export const SYNTHETIC_RECEIPT_OUTPUT = {
  currency: "SEK",
  date: "2026-08-23",
  lines: [
    {
      amount: "-1.00",
      categoryId: "uncategorized",
      description: "Synthetic item",
      kind: "purchase",
      selected: true,
    },
  ],
  merchant: "Synthetic shop",
  mismatch: null,
  printedTotal: "-1.00",
  schemaVersion: "receipt.v1",
  uncertainty: [],
} as const;
