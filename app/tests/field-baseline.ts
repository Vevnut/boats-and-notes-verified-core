import assert from "node:assert/strict";
import { baselineMatches, baselineSupported, parseFieldBaseline } from "../server/field-baseline.js";

const base = (field: string, value = "Original") => ({ field, value });

// Supported single-field saves parse to the right column.
for (const [collection, field, column] of [
  ["service", "description", "description"],
  ["service", "techNotes", "tech_notes"],
  ["wo-jobs", "description", "description"],
  ["wo-jobs", "techNotes", "tech_notes"],
  ["wo-jobs", "customerNotes", "customer_notes"],
] as const) {
  const parsed = parseFieldBaseline(collection, { [field]: "My edit", __fieldBase: base(field) });
  assert.deepEqual(parsed, { field, column, base: "Original" }, `${collection}.${field}`);
}

// Empty baselines and empty new values are legitimate (clearing or first entry).
assert.deepEqual(parseFieldBaseline("wo-jobs", { customerNotes: "", __fieldBase: base("customerNotes", "") }),
  { field: "customerNotes", column: "customer_notes", base: "" });

// Anything else is rejected, so it keeps the strict record-version check.
const rejected: [string, unknown][] = [
  ["service", { customerNotes: "x", __fieldBase: base("customerNotes") }],                  // not a service field
  ["customers", { description: "x", __fieldBase: base("description") }],                    // unsupported collection
  ["wo-jobs", { description: "x", status: "complete", __fieldBase: base("description") }],  // more than one field
  ["wo-jobs", { description: "x" }],                                                         // no baseline
  ["wo-jobs", { description: 5, __fieldBase: base("description") }],                         // non-string new value
  ["wo-jobs", { description: "x", __fieldBase: { field: "description", value: 5 } }],        // non-string baseline
  ["wo-jobs", { description: "x", __fieldBase: base("techNotes") }],                         // baseline names a different field
  ["wo-jobs", { description: "x", __fieldBase: base("status") }],                            // field not on the allowlist
  ["wo-jobs", { constructor: "x", __fieldBase: base("constructor") }],                       // prototype keys are not fields
  ["wo-jobs", { toString: "x", __fieldBase: base("toString") }],
  ["wo-jobs", { description: "x", __fieldBase: [] }],
  ["wo-jobs", { description: "x", __fieldBase: null }],
  ["wo-jobs", [{ description: "x" }]],
  ["wo-jobs", null],
  ["wo-jobs", undefined],
];
for (const [collection, body] of rejected) assert.equal(parseFieldBaseline(collection, body), null, JSON.stringify([collection, body]));

assert.equal(baselineSupported("service"), true);
assert.equal(baselineSupported("wo-jobs"), true);
assert.equal(baselineSupported("customers"), false);
assert.equal(baselineSupported("constructor"), false);

// The stored value must still equal the editor's starting value.
assert.equal(baselineMatches("Original", "Original"), true);
assert.equal(baselineMatches("Someone else's edit", "Original"), false);
assert.equal(baselineMatches(null, ""), true);
assert.equal(baselineMatches("", ""), true);
assert.equal(baselineMatches(null, "Original"), false);
assert.equal(baselineMatches(undefined, ""), false);   // missing row or column never matches
assert.equal(baselineMatches(5, "5"), false);

console.log("Field baseline policy checks passed");
