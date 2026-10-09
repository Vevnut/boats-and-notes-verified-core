export function descriptionMergeAllowed(method: string, collection: string, body: unknown, base: unknown, currentValue: unknown): boolean {
  if (method !== "PATCH" || !["service", "wo-jobs"].includes(collection)) return false;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const patch = body as Record<string, unknown>;
  if (Object.keys(patch).length !== 1 || typeof patch.description !== "string") return false;
  if (!base || typeof base !== "object" || Array.isArray(base)) return false;
  const baseline = base as Record<string, unknown>;
  if (baseline.field !== "description" || typeof baseline.value !== "string") return false;
  // The editor displays null as an empty description.
  if (currentValue !== null && typeof currentValue !== "string") return false;
  return (currentValue ?? "") === baseline.value;
}
