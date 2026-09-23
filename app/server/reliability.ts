import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { context, current, getPool, recordVersion, sql } from "./postgres.js";

const collections: Record<string, string> = {
  customers: "customers", boats: "boats", service: "service_records", jobs: "service_records",
  invoices: "service_records", "wo-jobs": "work_order_jobs", parts: "parts",
  "parts-orders": "parts", "parts-catalog": "parts_catalog", "labor-codes": "labor_codes",
  "work-order-templates": "work_order_templates", "common-jobs": "common_jobs",
  "catalog-tabs": "catalog_tabs", "comm-log": "customer_comm_log", photos: "service_photos",
  "scheduled-events": "scheduled_events", schedule: "scheduled_events", "work-orders": "service_records",
};
const canonical: Record<string, string> = {
  service_records: "service", work_order_jobs: "wo-jobs", parts_catalog: "parts-catalog",
  labor_codes: "labor-codes", work_order_templates: "work-order-templates",
  common_jobs: "common-jobs", catalog_tabs: "catalog-tabs", customer_comm_log: "comm-log",
  service_photos: "photos", scheduled_events: "scheduled-events",
};
function decorate(path: string, value: any) {
  const bits = path.split("/").filter(Boolean);
  let table = collections[bits[1]];
  if (bits[1] === "service" && bits[3] === "jobs") table = "work_order_jobs";
  else if (bits[3] && collections[bits[3]]) table = collections[bits[3]];
  else if (bits[3] && !["adjust", "caption", "signature", "clone"].includes(bits[3])) return value;
  const add = (row: any) => {
    const version = row && table && current().versions.get(`${table}/${row.id}`);
    return version ? { ...row, _version: version, _resource: `/api/${canonical[table] ?? table}/${row.id}` } : row;
  };
  return Array.isArray(value) ? value.map(add) : add(value);
}

// Each request leases its own connection. A database advisory lock, not a
// process-local queue, coordinates writes across simultaneous Vercel instances.
// No response body is released until COMMIT succeeds.
export function installReliability(app: Express) {
  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try { client = await getPool().connect(); }
    catch { return res.status(503).json({ error: "The permanent database is unavailable or not configured. No save was confirmed." }); }
    const owner = res.locals.owner as string;
    context.run({ client, owner, versions: new Map() }, async () => {
      const path = req.originalUrl.split("?")[0];
      const write = !["GET", "HEAD", "OPTIONS"].includes(req.method) && path !== "/api/html-to-pdf";
      const system = path.startsWith("/api/recovery/") || path === "/api/preferences";
      const operation = req.get("X-Operation-Id");
      const fingerprint = createHash("sha256").update(JSON.stringify([req.method, req.originalUrl, req.body, req.get("If-Match")])).digest("hex");
      let transaction = false, finishing = false, replay = false;
      const originalEnd = res.end.bind(res);
      res.end = ((chunk?: any, encoding?: any, callback?: any) => {
        if (finishing) return res;
        finishing = true;
        void (async () => {
          let output = chunk, destroy = false;
          try {
            let body: any = null;
            const json = String(res.getHeader("Content-Type")).includes("application/json");
            if (json && chunk != null) {
              body = JSON.parse(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
              if (res.statusCode < 400 && !replay) body = decorate(path, body);
              output = JSON.stringify(body);
            }
            if (transaction) {
              if (res.statusCode < 400) {
                if (write && operation && !system && !replay) {
                  await sql("INSERT INTO bn_private.save_receipts(owner_id,id,fingerprint,status,body) VALUES($1,$2,$3,$4,$5)", [owner, operation, fingerprint, res.statusCode, JSON.stringify(body)]);
                }
                await client.query("COMMIT");
              } else await client.query("ROLLBACK");
              transaction = false;
            }
          } catch {
            destroy = true;
            await client.query("ROLLBACK").catch(() => {});
            transaction = false;
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            output = JSON.stringify({ error: "Save was not confirmed. Keep your draft and retry the same Save when connected." });
          } finally {
            client.release(destroy);
          }
          res.removeHeader("ETag");
          if (output != null) res.setHeader("Content-Length", Buffer.byteLength(output));
          else res.removeHeader("Content-Length");
          (originalEnd as any)(output, typeof encoding === "string" ? encoding : undefined, typeof encoding === "function" ? encoding : callback);
        })();
        return res;
      }) as any;
      try {
        await client.query("BEGIN");
        transaction = true;
        await client.query("SET LOCAL statement_timeout='20000'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout='60000'");
        await client.query("SET LOCAL ROLE authenticated");
        await client.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner, role: "authenticated" })]);
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`boats-and-notes/${owner}`]);
        if (write && !system) {
          if (!operation || !/^[a-zA-Z0-9:_-]{8,180}$/.test(operation))
            return res.status(428).json({ error: "Refresh the app before saving. Save protection is required." });
          const receipt = (await sql("SELECT * FROM bn_private.save_receipts WHERE owner_id=$1 AND id=$2", [owner, operation])).rows[0];
          if (receipt) {
            if (receipt.fingerprint !== fingerprint) return res.status(409).json({ error: "This save identifier was already used for different changes. Reopen the record before trying again." });
            replay = true;
            res.setHeader("X-Save-Replayed", "true");
            res.status(receipt.status);
            return receipt.status === 204 ? res.end() : res.json(receipt.body);
          }
          const match = path.match(/^\/api\/([^/]+)\/(\d+)(?:\/(caption|signature))?$/);
          if (match && (["PATCH", "PUT", "DELETE"].includes(req.method) || match[3] === "signature") && collections[match[1]]) {
            const version = await recordVersion(collections[match[1]], Number(match[2]), true);
            if (!version) return res.status(404).json({ error: "This record no longer exists. Your changes were not applied." });
            if (req.get("If-Match") !== version) return res.status(409).json({
              error: "This record changed in another window or device. Your changes were not applied. Keep or download your draft, then reopen the latest record.",
              currentVersion: version,
            });
          }
        }
        next();
      } catch { res.status(503).json({ error: "The database could not prepare this request. Please retry; no save was confirmed." }); }
    });
  });
  app.get("/api/recovery/drafts", async (req, res) => {
    const rows = await sql("SELECT body FROM bn_private.recovery_drafts WHERE owner_id=$1 AND slot=$2 AND NOT cleared ORDER BY updated_at DESC", [current().owner, String(req.query.slot ?? "")]);
    res.json(rows.rows.map(r => r.body));
  });
  app.put("/api/recovery/drafts/:id", async (req, res) => {
    const draft = req.body;
    if (!draft || typeof draft.slot !== "string" || draft.slot.length > 500 || !Number.isSafeInteger(draft.sequence) ||
      draft.sequence < 0 || JSON.stringify(draft).length > 200000 || String(req.params.id).length > 180)
      return res.status(400).json({ error: "Invalid draft" });
    await sql(`INSERT INTO bn_private.recovery_drafts(owner_id,id,slot,sequence,body) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(owner_id,id) DO UPDATE SET sequence=excluded.sequence,body=excluded.body,updated_at=now()
      WHERE NOT recovery_drafts.cleared AND excluded.sequence>recovery_drafts.sequence`,
    [current().owner, req.params.id, draft.slot, draft.sequence, JSON.stringify(draft)]);
    res.json({ ok: true });
  });
  app.delete("/api/recovery/drafts/:id", async (req, res) => {
    await sql(`INSERT INTO bn_private.recovery_drafts(owner_id,id,slot,sequence,body,cleared)
      VALUES($1,$2,'',0,'{}',true) ON CONFLICT(owner_id,id) DO UPDATE SET cleared=true,updated_at=now()`, [current().owner, req.params.id]);
    res.json({ ok: true });
  });
}
