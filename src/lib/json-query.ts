/**
 * Parameterized lookups for the JSON document store.
 * Values are compared by equality only — never concatenated into a query language.
 */

export function findByField<T>(
  rows: readonly T[],
  field: keyof T,
  value: unknown
): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return rows.find((row) => row[field] === value);
}

export function findByNormalizedString<T>(
  rows: readonly T[],
  field: keyof T,
  value: string,
  normalize: (input: string) => string = (input) => input
): T | undefined {
  const needle = normalize(value);
  if (!needle) return undefined;
  return rows.find((row) => {
    const current = row[field];
    return typeof current === "string" && normalize(current) === needle;
  });
}
