const SENSITIVE_KEY =
  /(?:api[-_]?key|authorization|cookie|password|secret|token)/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi;
const GOOGLE_KEY = /AIza[0-9A-Za-z_-]{20,}/g;

export const REDACTED = "[REDACTED]";

export function redactText(
  value: string,
  secrets: readonly string[] = [],
): string {
  let redacted = value.replace(BEARER, `Bearer ${REDACTED}`)
    .replace(GOOGLE_KEY, REDACTED);
  for (const secret of secrets) {
    if (secret.length > 0) redacted = redacted.split(secret).join(REDACTED);
  }
  return redacted;
}

export function redactValue(
  value: unknown,
  secrets: readonly string[] = [],
): unknown {
  if (typeof value === "string") return redactText(value, secrets);
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redactValue(entry, secrets),
      ]),
    );
  }
  return value;
}

export function redactLogLine(
  event: string,
  fields: Record<string, unknown> = {},
  secrets: readonly string[] = [],
): string {
  return JSON.stringify(redactValue({ event, ...fields }, secrets));
}
