import { ImageInput, PreparationOperations, prepareImage } from "./image.ts";
import { hashRouteUrl, parseHashRoute, REPOSITORY_BASE_PATH } from "./pwa.ts";

export interface SyntheticBrowserFile {
  bytes: Uint8Array;
  name: string;
  type: string;
}

export interface BrowserRefreshResult {
  requestPath: string;
  restoredRoute: string;
}

/**
 * Browser-shaped fixture for the seams that cannot be exercised by Deno alone:
 * file selection, object URLs, hash refresh, and terminal cleanup.
 */
export class BrowserFixture {
  readonly origin = "https://owner.github.io";
  readonly objectUrls = new Set<string>();
  private selected?: SyntheticBrowserFile;
  private urlCounter = 0;
  private currentUrl: string;

  constructor(route = "/expenses") {
    this.currentUrl = hashRouteUrl(this.origin, REPOSITORY_BASE_PATH, route);
  }

  takePhoto(file: SyntheticBrowserFile): void {
    this.selectFile(file);
  }

  chooseImage(file: SyntheticBrowserFile): void {
    this.selectFile(file);
  }

  refresh(): BrowserRefreshResult {
    const url = new URL(this.currentUrl);
    return {
      requestPath: url.pathname,
      restoredRoute: parseHashRoute(this.currentUrl, REPOSITORY_BASE_PATH),
    };
  }

  scan(
    enabled: boolean,
    operations: PreparationOperations,
    terminal: "cancelled" | "failed" | "succeeded",
  ): { preparation: ImageInput["mimeType"] | "off" | "resize-compress" } {
    if (this.selected === undefined) {
      throw new Error("scan needs a selected image");
    }
    const input: ImageInput = {
      bytes: this.selected.bytes,
      height: 3500,
      mimeType: this.selected.type,
      width: 5200,
    };
    const prepared = prepareImage(input, enabled, operations);
    const preparation = prepared.preparation;
    this.releaseEphemeralImage();
    if (
      terminal === "cancelled" || terminal === "failed" ||
      terminal === "succeeded"
    ) {
      return { preparation };
    }
    return { preparation };
  }

  releaseEphemeralImage(): void {
    this.selected = undefined;
    this.objectUrls.clear();
  }

  get hasEphemeralImage(): boolean {
    return this.selected !== undefined || this.objectUrls.size > 0;
  }

  private selectFile(file: SyntheticBrowserFile): void {
    this.releaseEphemeralImage();
    this.selected = file;
    this.urlCounter += 1;
    this.objectUrls.add(`blob:synthetic/${this.urlCounter}`);
  }
}
