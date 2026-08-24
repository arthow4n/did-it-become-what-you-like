interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_COMMIT__: string;
