import { preEncodeImage } from "./image.ts";
import type { ImagePreparationReply } from "./image-preparation.ts";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ file: File; degrees: number }>) => void;
  postMessage: (
    reply: ImagePreparationReply,
    transfer?: Transferable[],
  ) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    const image = await preEncodeImage(data.file, data.degrees);
    scope.postMessage({ image }, [image.bytes.buffer as ArrayBuffer]);
  } catch {
    scope.postMessage({
      error: "Receipt image preparation failed. Select the image again.",
    });
  }
};
