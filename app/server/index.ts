import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { installReliability } from "./reliability.js";
import { authenticate } from "./auth.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { current, database, sql, tables } from "./postgres.js";

declare module "http" { interface IncomingMessage { rawBody: unknown; } }
export function log(message: string, source = "express") { console.log(`[${source}] ${message}`); }
export async function createApp(authenticateRequest = authenticate) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: false, limit: "4mb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.get("/api/config", (_req, res) => res.json({
    supabaseUrl: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY,
  }));
  app.get("/api/health", (_req, res) => res.json({ service: "boats-and-notes", storage: "postgres", configured: Boolean(process.env.DATABASE_URL) }));
  app.use("/api", authenticateRequest);
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/test/")) return res.status(404).json({ error: "Sample/reset tools are not available in production." });
    if (req.path.startsWith("/square") || req.path === "/parts-catalog/import-url")
      return res.status(403).json({ error: "Payments and external catalog imports are not enabled. No external action was taken." });
    next();
  });
  installReliability(app);
  app.get("/api/preferences", async (_req, res) => {
    const rows = await sql("SELECT key,value FROM bn_private.preferences WHERE owner_id=$1", [current().owner]);
    res.json(Object.fromEntries(rows.rows.map(r => [r.key, r.value])));
  });
  app.put("/api/preferences", async (req, res) => {
    const { key, value } = req.body ?? {};
    if (typeof key !== "string" || !key.startsWith("boatsandnotes:") || key.length > 200 || typeof value !== "string" || value.length > 50000)
      return res.status(400).json({ error: "Invalid preference" });
    await sql("INSERT INTO bn_private.preferences VALUES($1,$2,$3) ON CONFLICT(owner_id,key) DO UPDATE SET value=excluded.value", [current().owner, key, value]);
    res.json({ ok: true });
  });
  app.get("/api/backup", async (_req, res) => {
    // Lock all app tables in a fixed order to produce one consistent export,
    // including against writes made outside this application's advisory lock.
    await sql(`LOCK TABLE ${[...tables].sort().map(t => `public."${t}"`).join(",")} IN SHARE MODE`);
    const data: Record<string, any> = {};
    for (const table of tables) data[table] = (await database.from(table).select()).data;
    const preferences = (await sql("SELECT key,value FROM bn_private.preferences WHERE owner_id=$1", [current().owner])).rows;
    res.setHeader("Content-Disposition", `attachment; filename="boats-and-notes-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ format: "boats-and-notes-postgres-v1", createdAt: new Date().toISOString(), data, preferences,
      note: "Photo URLs are references, not copies of externally stored image files. Inline photo data is included." });
  });
  await registerRoutes(createServer(app), app);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Unknown API route" }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!res.headersSent) res.status(err.type === "entity.too.large" ? 413 : 500).json({ error:
      err.type === "entity.too.large" ? "This upload is too large. Choose a smaller file." : "The request failed. Your changes were not confirmed." });
  });
  if (!process.env.VERCEL) serveStatic(app);
  return app;
}
