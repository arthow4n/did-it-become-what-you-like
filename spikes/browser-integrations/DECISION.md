# F-003 browser integration compatibility decision

Status: executable synthetic proof passes. This is a compatibility spike, not a
production adapter, screen, deployment, or live-service integration.

## Decision

The MVP can remain browser-only for the approved Google Drive and Gemini
workflows. No backend is required by this compatibility proof.

- Drive uses Google Identity Services' browser token model and a short-lived
  access token held only in memory. The only requested Drive scope is
  `https://www.googleapis.com/auth/drive.appdata`. The adapter must check the
  granted scope before enabling sync, obtain a new token from a user gesture
  after expiry, and never persist the token in IndexedDB, localStorage, a
  snapshot, an export, or logs.
- Drive requests are limited to `about.get` for the current account identity and
  `files.list`, `files.create`, `files.get`/`files.update` equivalents in
  `spaces=appDataFolder`. New files use `parents: ["appDataFolder"]`, JSON
  media, explicit fields, and conditional ETag updates. No ordinary Drive
  folder, Picker, `drive`, `drive.file`, `drive.metadata`, or shared-drive
  access is part of this contract.
- The browser OAuth client is registered with the production JavaScript origin,
  `https://owner.github.io`, not the repository path. Local development uses the
  exact origin including its port, for example `http://localhost:8000`. The
  token model uses the GIS dialog/popup UX and has no application redirect URI.
  Hash routes and `/did-it-become-what-you-like/` are application routing
  details, not OAuth origins.
- An authorization-code redirect flow is explicitly not selected: Google
  requires a server endpoint to receive/exchange the code and the configured
  redirect URI must exactly match the registered scheme, host, and path with no
  hash fragment. Adding that flow would be a backend/product architecture change
  requiring owner approval.
- Gemini uses `@google/genai`'s browser-compatible `GoogleGenAI({ apiKey })`
  surface. The key is runtime-entered and namespaced in localStorage per the
  approved product risk; it is never bundled, committed, synchronized, exported,
  or logged. The SDK's own warning that browser keys are exposed is retained in
  the product disclosure.
- `ai.models.list` is paginated. Metadata exposing `generateContent` is not
  treated as proof of image or receipt-schema support. Unknown capability is
  labeled **Needs test** and must pass a synthetic configuration call with a 1x1
  image and the exact versioned receipt schema before a model is usable. Real
  receipt data is never used for this configuration test.
- Receipt generation uses `ai.models.generateContent` with text before the
  image, `config.responseMimeType = "application/json"`, and
  `config.responseSchema = RECEIPT_JSON_SCHEMA`. The raw response is parsed and
  validated again in the browser; malformed, extra-field, hostile, or
  wrong-version output cannot enter review.
- Image state is ephemeral. Camera/file selection creates a preview object URL
  only for the active workflow; success, failure, cancellation, replacement, and
  discard revoke it and release in-memory source/prepared bytes. Preparation on
  performs an explicit local resize/compress policy. Preparation off keeps
  source dimensions and skips those operations. Both paths always remove
  embedded metadata first.
- The default browser input allowlist is JPEG, PNG, and WebP. Gemini's API also
  documents HEIC and HEIF, but the supported-browser matrix does not make their
  decoding universal. The production adapter may offer HEIC/HEIF only after a
  runtime decode probe; it must otherwise explain the unsupported format and ask
  for JPEG/PNG/WebP. The spike's lossless metadata fixture is JPEG; production
  must use equivalent lossless metadata removal or a safe decode/re-encode path
  for every accepted format.
- The authoritative Gemini transport limits recorded here are a 20,000,000 byte
  total inline request budget, 3,600 image files per request, 384-pixel
  low-resolution token behavior, and 768-pixel tiling behavior. The local
  starting preparation policy is a 4,096-pixel maximum dimension and JPEG
  quality 0.85. The latter two are conservative product tuning values, not
  claims that Gemini imposes a 4K or quality limit; A-301 must recheck
  representative synthetic receipt-like legibility fixtures before locking them
  in the production adapter.
- CSP is self-hosted by default. It permits only the GIS client script and the
  three required Google origins for connections, plus same-origin assets,
  blob/data image previews, and a same-origin worker. It has no unsafe inline or
  eval script source and no unrelated CDN. The GenAI bundle must be bundled into
  the app; the SDK's direct browser entry is not a permission to load a runtime
  CDN module.
- The PWA uses `/did-it-become-what-you-like/` as the repository base path, hash
  routes, repository-relative assets, and a worker registered with exactly that
  path as scope. The proof rejects sibling repositories, prefix-collision paths,
  other origins, and Google API requests from the worker scope.

## Evidence and test coverage

`deno run -A spikes/browser-integrations/verify.ts` runs 11 deterministic proofs
without network access or credentials:

1. user-gesture GIS token acquisition, exact scope, in-memory token handling,
   account lookup, app-data create/list/conditional update;
2. rejection of an ordinary Drive parent;
3. paginated model listing and synthetic image/schema capability testing;
4. strict structured-output validation, including hostile extra fields;
5. EXIF, XMP, and JPEG comment removal with scan-payload preservation;
6. preparation on/off dimensions, operations, and mandatory sanitization;
7. camera/file preview lifetime and success/failure/cancel cleanup;
8. official image MIME set and transport-limit constants;
9. restrictive CSP allowlist;
10. base-path asset resolution and hash-route refresh;
11. exact service-worker registration scope, sibling isolation, and API
    non-interception.

The browser fixture deliberately models file/object-URL and navigation seams so
the runner works directly under Deno. It is not a claim that Chromium, iOS
Safari, Android Chrome, canvas decoding, or a real service-worker process was
run here.

## Unavailable checks

No credentials or personal data were available or used. Therefore this spike
does not claim:

- a live GIS consent, token-expiry, account-switch, or Drive round trip;
- a live `@google/genai` model list, quota, image decode, OCR/receipt-legibility
  result, or service response;
- a real Chromium/Playwright/agent-browser run (no Chromium executable is
  installed in this worker environment);
- iOS Safari, Android Chrome, Firefox, Edge, or any other cross-browser/mobile
  manual check; or
- a production build, CSP header delivery, real hash refresh, or real
  service-worker registration. Those belong to F-004/F-005 and later PWA gates.

## Primary references consulted

- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Identity Services setup and authorized origins](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google Identity Services code model and redirect constraints](https://developers.google.com/identity/oauth2/web/guides/use-code-model)
- [Drive appDataFolder storage](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Drive OAuth scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Drive `about.get` authorization](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get)
- [Gemini JavaScript SDK browser warning](https://github.com/googleapis/js-genai#initialization)
- [Gemini model listing](https://ai.google.dev/api/models)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini image understanding and input limits](https://ai.google.dev/gemini-api/docs/image-understanding)
