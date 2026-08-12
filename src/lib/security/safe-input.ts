const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Deep-copy JSON-like input into a plain data object.
 * Drops prototype-pollution keys so form payloads cannot become code/structure.
 */
export function toPlainData<T = unknown>(value: unknown): T {
  if (value === null || typeof value !== "object") {
    return value as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlainData(item)) as T;
  }

  const out: Record<string, unknown> = Object.create(null);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    out[key] = toPlainData(nested);
  }
  return out as T;
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  return { ok: true, data: toPlainData<Record<string, unknown>>(raw) };
}

export function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function booleanField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Evaluation / free-form maps: only string or number values, no prototype keys. */
export function plainStringNumberMap(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    if (typeof nested === "string" || typeof nested === "number") {
      out[key] = nested;
    }
  }
  return out;
}
