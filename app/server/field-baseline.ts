export type BaselineField = "description" | "techNotes" | "customerNotes";

// Single text fields whose save may ignore unrelated changes to the same record.
// The save is allowed only while the stored value still equals the value the
// editor started from. Every other write keeps the strict record-version check.
const columns: Record<string, Partial<Record<BaselineField, string>>> = {
  service: { description: "description", techNotes: "tech_notes" },
  "wo-jobs": { description: "description", techNotes: "tech_notes", customerNotes: "customer_notes" },
};

export type FieldBaselineSave = { field: BaselineField; column: string; base: string };

export function baselineSupported(collection: string): boolean {
  return Object.prototype.hasOwnProperty.call(columns, collection);
}

// Returns the validated single-field save, or null when the request is not
// exactly { [field]: string, __fieldBase: { field, value: string } } for a
// supported collection and field.
export function parseFieldBaseline(collection: string, body: unknown): FieldBaselineSave | null {
  if (!baselineSupported(collection) || !body || typeof body !== "object" || Array.isArray(body)) return null;
  const patch = body as Record<string, unknown>;
  const baseline = patch.__fieldBase;
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) return null;
  const { field, value } = baseline as Record<string, unknown>;
  if (typeof field !== "string" || typeof value !== "string") return null;
  const allowed = columns[collection];
  if (!Object.prototype.hasOwnProperty.call(allowed, field)) return null;
  const column = allowed[field as BaselineField];
  if (!column) return null;
  const keys = Object.keys(patch);
  if (keys.length !== 2 || !keys.includes(field) || typeof patch[field] !== "string") return null;
  return { field: field as BaselineField, column, base: value };
}

// The editor displays null as an empty string, so both compare equal.
export function baselineMatches(current: unknown, base: string): boolean {
  if (current !== null && typeof current !== "string") return false;
  return (current ?? "") === base;
}
