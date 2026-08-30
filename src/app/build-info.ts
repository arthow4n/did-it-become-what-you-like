export {
  APP_NAME,
  APP_VERSION,
  LICENSE_NAME,
  LICENSE_URL,
  NOTICES_URL,
  SOURCE_URL,
} from "./provenance.ts";

export const APP_COMMIT = typeof __APP_COMMIT__ === "string"
  ? __APP_COMMIT__
  : "development";
