import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import pg from "pg";
import type { RequestHandler } from "express";

// Tests MUST use a disposable, local database. Never a Supabase URL.
const uri = process.env.TEST_DATABASE_URL;
if (!uri || !["localhost", "127.0.0.1"].includes(new URL(uri).hostname) || new URL(uri).pathname !== "/boats_notes_qa" || process.env.VERCEL)
  throw new Error("Set TEST_DATABASE_URL to a disposable local PostgreSQL database");
process.env.DATABASE_URL = uri;
const admin = new pg.Client({ connectionString: uri });
await admin.connect();
await admin.query("TRUNCATE public.customers,public.activity_log,public.parts_catalog,public.common_jobs,public.catalog_tabs,public.labor_codes,public.work_order_templates,bn_private.save_receipts,bn_private.recovery_drafts,bn_private.preferences RESTART IDENTITY CASCADE");
const owner = "77228746-e36f-4d72-84fd-d9c74aa532dc";
const { createApp } = await import("../server/index");
const { getPool } = await import("../server/postgres");
const testAuth: RequestHandler = (req, res, next) => {
  if (req.get("Authorization") !== "Bearer disposable-test-token") return res.status(401).json({ error: "Unauthorized" });
  res.locals.owner = owner; next();
};
const app = await createApp(testAuth);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}`;
const auth = { Authorization: "Bearer disposable-test-token" };
let total = 0;
const pass = (name: string) => { total++; console.log(`PASS ${name}`); };
async function call(route: string, method = "GET", body?: any, id = crypto.randomUUID(), version?: string, versionHeader = "X-Record-Version") {
  const response = await fetch(base + route, {
    method, headers: { ...auth, "Content-Type": "application/json", "X-Operation-Id": id, ...(version ? { [versionHeader]: version } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, replay: response.headers.get("X-Save-Replayed"),
    data: response.status === 204 ? null : await response.json() };
}
try {
  assert.equal((await fetch(base + "/api/customers")).status, 401);
  assert.equal((await call("/api/test/reset", "POST", { confirm: "RESET SAMPLE DATA" })).status, 404);
  assert.equal((await call("/api/square/checkout", "POST", {})).status, 403);
  pass("Unauthenticated access, sample reset and payments blocked");
  const op = crypto.randomUUID(), payload = { name: "Production QA", email: "qa@example.test" };
  const [first, replay] = await Promise.all([call("/api/customers", "POST", payload, op), call("/api/customers", "POST", payload, op)]);
  assert.equal(first.status, 201); assert.equal(replay.status, 201); assert.equal(first.data.id, replay.data.id);
  assert.ok(first.replay === "true" || replay.replay === "true");
  assert.equal((await call("/api/customers", "POST", { name: "Wrong" }, op)).status, 409);
  pass("Concurrent create retries have one record and one durable receipt");
  const c = first.data, route = `/api/customers/${c.id}`;
  const changed = await call(route, "PATCH", { notes: "Newer" }, crypto.randomUUID(), c._version);
  assert.equal(changed.status, 200); assert.ok(changed.data._version);
  assert.equal((await call(route, "PATCH", { notes: "Older" }, crypto.randomUUID(), c._version)).status, 409);
  assert.equal((await call(route)).data.notes, "Newer");
  pass("Stale edits rejected using real PostgreSQL row versions");
  const boat = await call("/api/boats", "POST", { customerId: c.id, make: "QA Boat", year: 2024 });
  assert.equal(boat.status, 201);
  const work = await call(`/api/boats/${boat.data.id}/service`, "POST", { description: "QA service", date: "2026-09-23" });
  assert.equal(work.status, 201);
  const job = await call(`/api/service/${work.data.id}/jobs`, "POST", { title: "QA line", pricingType: "flat", flatRate: 245.5 });
  assert.equal(job.status, 200);
  const line = (await call(`/api/service/${work.data.id}/jobs`)).data[0];
  assert.equal(line.flatRate, 245.5); assert.ok(line._version);
  pass("Customer, boat, work order and priced job round-trip");
  const workRoute = `/api/service/${work.data.id}`;
  const workBefore = (await call(workRoute)).data;
  assert.ok(workBefore._version);
  const editId = crypto.randomUUID(), editBody = { techNotes: "Verified work-order notes" };
  const oldClientEdit = await call(workRoute, "PATCH", editBody, editId, workBefore._version, "If-Match");
  assert.equal(oldClientEdit.status, 200);
  const migratedReplay = await call(workRoute, "PATCH", editBody, editId, workBefore._version);
  assert.equal(migratedReplay.status, 200); assert.equal(migratedReplay.replay, "true");
  assert.equal(migratedReplay.data._version, oldClientEdit.data._version);
  const workEdited = await call(workRoute, "PATCH", { description: "Updated QA work order" }, crypto.randomUUID(), oldClientEdit.data._version);
  assert.equal(workEdited.status, 200);
  assert.equal((await call(workRoute)).data.techNotes, editBody.techNotes);
  assert.equal((await call(workRoute, "PATCH", { techNotes: "Stale must not overwrite" }, crypto.randomUUID(), workBefore._version)).status, 409);
  assert.equal((await call(workRoute, "PATCH", { techNotes: "Missing version must not overwrite" })).status, 409);
  const conflicting = await fetch(base + workRoute, {
    method: "PATCH", headers: { ...auth, "Content-Type": "application/json", "X-Operation-Id": crypto.randomUUID(),
      "X-Record-Version": workEdited.data._version, "If-Match": "different" },
    body: JSON.stringify({ techNotes: "Conflicting must not overwrite" }),
  });
  assert.equal(conflicting.status, 400);
  const lineEdit = await call(`/api/wo-jobs/${line.id}`, "PATCH", { title: "Updated QA line", flatRate: 275 }, crypto.randomUUID(), line._version);
  assert.equal(lineEdit.status, 200);
  const savedLine = (await call(`/api/service/${work.data.id}/jobs`)).data[0];
  assert.equal(savedLine.title, "Updated QA line"); assert.equal(savedLine.flatRate, 275);
  assert.equal((await call(`/api/wo-jobs/${line.id}`, "PATCH", { title: "Stale line" }, crypto.randomUUID(), line._version)).status, 409);
  pass("Work-order and job edits save with custom version header; old receipts replay and stale/missing/conflicting versions stay blocked");
  await admin.query(`CREATE FUNCTION public.qa_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected test failure'; END$$;
    CREATE TRIGGER qa_failure BEFORE INSERT ON public.work_order_jobs FOR EACH ROW EXECUTE FUNCTION public.qa_fail();`);
  const before = (await admin.query("SELECT count(*) FROM public.service_records")).rows[0].count;
  const failedId = crypto.randomUUID();
  assert.equal((await call(`/api/work-orders/${work.data.id}/clone`, "POST", {}, failedId)).status, 500);
  assert.equal((await admin.query("SELECT count(*) FROM public.service_records")).rows[0].count, before);
  assert.equal(Number((await admin.query("SELECT count(*) FROM bn_private.save_receipts WHERE id=$1", [failedId])).rows[0].count), 0);
  await admin.query("DROP TRIGGER qa_failure ON public.work_order_jobs; DROP FUNCTION public.qa_fail();");
  pass("Multi-step write failure rolls back both records and receipt");
  const draft = { id: "qa-draft", slot: "qa-slot", sequence: 2, value: "new draft" };
  await call("/api/recovery/drafts/qa-draft", "PUT", draft);
  await call("/api/recovery/drafts/qa-draft", "PUT", { ...draft, sequence: 1, value: "old" });
  assert.equal((await call("/api/recovery/drafts?slot=qa-slot")).data[0].value, "new draft");
  await call("/api/recovery/drafts/qa-draft", "DELETE");
  await call("/api/recovery/drafts/qa-draft", "PUT", { ...draft, sequence: 9 });
  assert.deepEqual((await call("/api/recovery/drafts?slot=qa-slot")).data, []);
  pass("Draft ordering and discard tombstones survive late requests");
  const otherApp = await createApp(testAuth);
  const second = otherApp.listen(0, "127.0.0.1"); await once(second, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(second.address() as any).port}/api/customers`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json", "X-Operation-Id": op }, body: JSON.stringify(payload),
    });
    assert.equal(response.headers.get("X-Save-Replayed"), "true");
    assert.equal((await response.json()).id, c.id);
  } finally { second.close(); }
  pass("A fresh app instance reuses durable save receipts");
  await call("/api/preferences", "PUT", { key: "boatsandnotes:qa", value: "dark" });
  assert.equal((await call("/api/preferences")).data["boatsandnotes:qa"], "dark");
  const backup = await call("/api/backup");
  assert.equal(backup.status, 200); assert.equal(backup.data.format, "boats-and-notes-postgres-v1");
  assert.equal(backup.data.data.customers[0].name, payload.name);
  pass("Preferences and complete core-record backup");
  const pdf = await fetch(base + `/api/work-orders/${work.data.id}/pdf`, { headers: auth });
  assert.equal(pdf.status, 200, await pdf.clone().text());
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(), "%PDF");
  pass("Packaged Chromium generates a real work-order PDF");
  await admin.query("BEGIN; SET LOCAL ROLE authenticated");
  await admin.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: "00000000-0000-0000-0000-000000000001" })]);
  assert.equal(Number((await admin.query("SELECT count(*) FROM public.customers")).rows[0].count), 0);
  assert.equal(Number((await admin.query("SELECT count(*) FROM bn_private.save_receipts")).rows[0].count), 0);
  await admin.query("ROLLBACK");
  pass("Database row policies isolate the owner and save receipts");
  console.log(`${total} production regression checks passed.`);
} finally {
  await (await import("../server/routes")).closePdfBrowser();
  server.close(); await getPool().end(); await admin.end();
}
