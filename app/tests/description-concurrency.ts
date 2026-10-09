import assert from "node:assert/strict";
import { descriptionMergeAllowed as allowed } from "../server/description-concurrency.js";
const base = { field: "description", value: "Original" };
for (const resource of ["service", "wo-jobs"]) {
  assert.equal(allowed("PATCH", resource, { description: "My edit" }, base, "Original"), true);
  assert.equal(allowed("PATCH", resource, { description: "My edit" }, base, "Someone else's edit"), false);
  assert.equal(allowed("PATCH", resource, { description: "My edit", status: "complete" }, base, "Original"), false);
  assert.equal(allowed("PATCH", resource, { description: "My edit" }, undefined, "Original"), false);
  assert.equal(allowed("PATCH", resource, { description: "My edit" }, { field: "description", value: "" }, null), true);
  assert.equal(allowed("PATCH", resource, { description: "My edit" }, base, undefined), false);
  assert.equal(allowed("DELETE", resource, {}, base, "Original"), false);
}
assert.equal(allowed("PATCH", "customers", { description: "My edit" }, base, "Original"), false);
console.log("Description concurrency policy checks passed");
