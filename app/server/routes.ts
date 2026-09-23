import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import supabase from "./supabase";
import type { Browser } from "playwright-core";
import { launchPdfBrowser } from "./browser";
import { renderWorkOrderPdfHtml } from "./pdf-template";
import { SquareClient, SquareEnvironment } from "square";
import {
  insertCustomerSchema, insertBoatSchema, insertServiceRecordSchema,
  insertPartSchema, insertLaborCodeSchema, insertPartsCatalogSchema,
  insertWorkOrderTemplateSchema,
} from "@shared/schema";

// Reserved for a future separately authorized payment integration.
// Production middleware currently blocks all Square routes.
const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const SQUARE_PROXY_URL = "";
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || "L39MMMQ9JR59T";
const SQUARE_ENV = (process.env.SQUARE_ENVIRONMENT || "production") === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
const SQUARE_API_BASE = SQUARE_ENV === SquareEnvironment.Production
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

// ─── Shared Playwright browser singleton (lazy init, reused across PDF requests) ────────────────
let sharedBrowser: Browser | null = null;
export async function closePdfBrowser() {
  await sharedBrowser?.close();
  sharedBrowser = null;
}
async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  sharedBrowser = await launchPdfBrowser();
  sharedBrowser.on("disconnected", () => { sharedBrowser = null; });
  return sharedBrowser;
}

async function isolatedPdfPage(browser: Browser) {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route("**/*", route => {
    const protocol = new URL(route.request().url()).protocol;
    return ["data:", "blob:", "about:"].includes(protocol) ? route.continue() : route.abort();
  });
  return page;
}

export async function registerRoutes(httpServer: Server, app: Express) {
  // ─── Customers ─────────────────────────────────────────────────────────────
  app.get("/api/customers", async (req, res) => {
    try {
      const q = req.query.q as string | undefined;
      const result = q ? await storage.searchCustomers(q) : await storage.getCustomers();
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const c = await storage.getCustomer(Number(req.params.id));
      if (!c) return res.status(404).json({ error: "Not found" });
      res.json(c);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/customers", async (req, res) => {
    try {
      const p = insertCustomerSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createCustomer(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const r = await storage.updateCustomer(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Boats ─────────────────────────────────────────────────────────────────
  app.get("/api/customers/:customerId/boats", async (req, res) => {
    try {
      res.json(await storage.getBoats(Number(req.params.customerId)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/boats", async (req, res) => {
    try {
      const q = req.query.q as string | undefined;
      if (q) return res.json(await storage.searchBoats(q));
      res.json(await storage.getBoats());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/boats/:id", async (req, res) => {
    try {
      const b = await storage.getBoat(Number(req.params.id));
      if (!b) return res.status(404).json({ error: "Not found" });
      res.json(b);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/boats", async (req, res) => {
    try {
      const p = insertBoatSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createBoat(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/boats/:id", async (req, res) => {
    try {
      const r = await storage.updateBoat(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/boats/:id", async (req, res) => {
    try {
      await storage.deleteBoat(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Service Records ───────────────────────────────────────────────────────
  app.get("/api/boats/:boatId/service", async (req, res) => {
    try {
      res.json(await storage.getServiceRecords(Number(req.params.boatId)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Boat at-a-glance (Batch 3) — single round-trip summary stats for boat-detail header
  app.get("/api/boats/:id/at-a-glance", async (req, res) => {
    try {
      res.json(await storage.getBoatAtAGlance(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Parts history for a boat — all parts used across all WOs
  app.get("/api/boats/:boatId/parts-history", async (req, res) => {
    try {
      const records = await storage.getServiceRecords(Number(req.params.boatId));
      const recordIds = records.map((r: any) => r.id);
      if (recordIds.length === 0) return res.json([]);
      const { data } = await supabase
        .from("parts")
        .select("id, part_number, description, quantity, unit_price, service_record_id")
        .in("service_record_id", recordIds)
        .order("id", { ascending: false });
      // Attach WO number and date to each part
      const recordMap = Object.fromEntries(records.map((r: any) => [r.id, r]));
      const result = (data ?? []).map((p: any) => ({
        id: p.id,
        partNumber: p.part_number,
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unit_price,
        serviceRecordId: p.service_record_id,
        woDate: recordMap[p.service_record_id]?.date ?? null,
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/jobs", async (_req, res) => {
    try {
      res.json(await storage.getAllOpenJobs());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/boats/:boatId/service", async (req, res) => {
    try {
      const p = insertServiceRecordSchema.safeParse({ ...req.body, boatId: Number(req.params.boatId) });
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createServiceRecord(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/service/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const prev = await storage.getServiceRecord(id);
      const r = await storage.updateServiceRecord(id, req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      // Log status change
      if (req.body.status && prev && req.body.status !== prev.status) {
        await supabase.from("status_history").insert({ service_record_id: id, status: req.body.status });
      }
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Status history
  app.get("/api/service/:id/status-history", async (req, res) => {
    try {
      const { data } = await supabase
        .from("status_history")
        .select("id, status, changed_at")
        .eq("service_record_id", Number(req.params.id))
        .order("changed_at", { ascending: true });
      res.json(data ?? []);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/service/:id", async (req, res) => {
    try {
      await storage.deleteServiceRecord(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Parts ─────────────────────────────────────────────────────────────────
  app.get("/api/service/:serviceId/parts", async (req, res) => {
    try {
      res.json(await storage.getParts(Number(req.params.serviceId)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/service/:serviceId/parts", async (req, res) => {
    try {
      const p = insertPartSchema.safeParse({ ...req.body, serviceRecordId: Number(req.params.serviceId) });
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createPart(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/parts/:id", async (req, res) => {
    try {
      const r = await storage.updatePart(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/parts/:id", async (req, res) => {
    try {
      await storage.deletePart(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Labor Codes ───────────────────────────────────────────────────────────
  app.get("/api/labor-codes", async (_req, res) => {
    try {
      res.json(await storage.getLaborCodes());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/labor-codes", async (req, res) => {
    try {
      const p = insertLaborCodeSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createLaborCode(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/labor-codes/:id", async (req, res) => {
    try {
      const r = await storage.updateLaborCode(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/labor-codes/:id", async (req, res) => {
    try {
      await storage.deleteLaborCode(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Work Order Templates ──────────────────────────────────────────────────
  app.get("/api/work-order-templates", async (_req, res) => {
    try {
      res.json(await storage.getWorkOrderTemplates());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/work-order-templates", async (req, res) => {
    try {
      res.status(201).json(await storage.createWorkOrderTemplate(req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/work-order-templates/:id", async (req, res) => {
    try {
      const r = await storage.updateWorkOrderTemplate(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/work-order-templates/:id", async (req, res) => {
    try {
      await storage.deleteWorkOrderTemplate(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Activity ──────────────────────────────────────────────────────────────
  app.get("/api/activity", async (_req, res) => {
    try {
      res.json(await storage.getRecentActivity(20));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Export ────────────────────────────────────────────────────────────────
  app.get("/api/export/csv", async (_req, res) => {
    try {
      const data = await storage.exportAll();

      let csv = "=== CUSTOMERS ===\r\n";
      csv += "ID,Name,Phone,Email,Address,Notes\r\n";
      data.customers.forEach(c => {
        csv += [c.id, c.name, c.phone ?? "", c.email ?? "", c.address ?? "", c.notes ?? ""]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(",") + "\r\n";
      });

      csv += "\r\n=== BOATS ===\r\n";
      csv += "ID,CustomerID,Make,Model,Year,Color,Length,EngineType,EngineMake,EngineModel,EngineHours,HP,HullID,Registration,Storage\r\n";
      data.boats.forEach(b => {
        csv += [b.id, b.customerId, b.make, b.model ?? "", b.year ?? "", b.color ?? "",
          b.length ?? "", b.engineType ?? "", b.engineMake ?? "", b.engineModel ?? "",
          b.engineHours ?? "", b.horsepower ?? "", b.hullId ?? "", b.registrationNumber ?? "", b.storageLocation ?? ""]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(",") + "\r\n";
      });

      csv += "\r\n=== SERVICE RECORDS ===\r\n";
      csv += "ID,BoatID,Date,Description,TechNotes,LaborHours,LaborRate,Cost,Status,Deposit,Paid\r\n";
      data.serviceRecords.forEach(s => {
        csv += [s.id, s.boatId, s.date, s.description, s.techNotes ?? "",
          s.laborHours ?? "", s.laborRate ?? "", s.cost ?? "", s.status,
          s.depositAmount ?? "", s.paid ? "Yes" : "No"]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(",") + "\r\n";
      });

      csv += "\r\n=== PARTS ===\r\n";
      csv += "ID,ServiceRecordID,PartNumber,Description,Quantity,UnitPrice,LineTotal\r\n";
      data.parts.forEach(p => {
        csv += [p.id, p.serviceRecordId, p.partNumber ?? "", p.description,
          p.quantity, p.unitPrice, (p.quantity * p.unitPrice).toFixed(2)]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(",") + "\r\n";
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="boats-and-notes-export-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Parts Catalog ─────────────────────────────────────────────────────────
  app.get("/api/parts-catalog", async (req, res) => {
    try {
      const q = req.query.q as string | undefined;
      res.json(await storage.getPartsCatalog(q));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/parts-catalog/:id", async (req, res) => {
    try {
      const item = await storage.getPartsCatalogItem(Number(req.params.id));
      if (!item) return res.status(404).json({ error: "Not found" });
      res.json(item);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/parts-catalog", async (req, res) => {
    try {
      const p = insertPartsCatalogSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: p.error });
      res.status(201).json(await storage.createPartsCatalogItem(p.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/parts-catalog/:id", async (req, res) => {
    try {
      const r = await storage.updatePartsCatalogItem(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/parts-catalog/:id", async (req, res) => {
    try {
      await storage.deletePartsCatalogItem(Number(req.params.id));
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/parts-catalog/:id/adjust", async (req, res) => {
    try {
      const { qtyChange } = req.body;
      const r = await storage.adjustInventory(Number(req.params.id), Number(qtyChange));
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Parts URL Import ────────────────────────────────────────────────────────
  app.post("/api/parts-catalog/import-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ error: "url required" });

      // Fetch the page HTML
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BoatsAndNotes/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return res.status(400).json({ error: `Page returned ${response.status}` });
      const html = await response.text();

      // --- Extract data from HTML using heuristics ---
      const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();

      // Part number: look for common patterns in text/meta
      const pnPatterns = [
        /part[\s\-_#]*(?:number|no|num|#)[\s:]*([A-Z0-9][A-Z0-9\-\.]{2,30})/i,
        /(?:sku|item|model|oem)[\s:]*([A-Z0-9][A-Z0-9\-\.]{2,30})/i,
        /\b([A-Z0-9]{2,5}-[A-Z0-9]{4,}(?:-[A-Z0-9]+)*)\b/,
      ];
      let partNumber = "";
      for (const re of pnPatterns) {
        const m = html.match(re);
        if (m) { partNumber = m[1].trim(); break; }
      }

      // Title / description: og:title or <title> or h1
      let description = "";
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      if (ogTitle) description = ogTitle[1].trim();
      if (!description) {
        const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
        if (h1) description = stripTags(h1[1]);
      }
      if (!description) {
        const title = html.match(/<title>(.*?)<\/title>/is);
        if (title) description = stripTags(title[1]).split("|")[0].split("-")[0].trim();
      }

      // Price: look for structured price data or common price patterns
      let sellPrice = 0;
      const priceJsonLd = html.match(/"price"\s*:\s*"?([\d]+\.?[\d]*)"?/);
      if (priceJsonLd) sellPrice = parseFloat(priceJsonLd[1]);
      if (!sellPrice) {
        // Try og:price
        const ogPrice = html.match(/<meta[^>]+(?:property=["'](?:product:price:amount|og:price:amount)["']|name=["']price["'])[^>]+content=["']([\d.,]+)["']/i)
          || html.match(/<meta[^>]+content=["']([\d.,]+)["'][^>]*(?:price|amount)[^>]*>/i);
        if (ogPrice) sellPrice = parseFloat(ogPrice[1].replace(",", ""));
      }
      if (!sellPrice) {
        // Scan visible price text patterns like $12.99
        const prices: number[] = [];
        const priceRe = /\$\s*([\d,]+\.\d{2})/g;
        let pm;
        while ((pm = priceRe.exec(html)) !== null) {
          const v = parseFloat(pm[1].replace(",", ""));
          if (v > 0.5 && v < 10000) prices.push(v);
        }
        if (prices.length) sellPrice = prices[0];
      }

      // Cost: estimate at 62% of sell
      const costPrice = sellPrice ? Math.round(sellPrice * 0.62 * 100) / 100 : 0;

      // Brand/category guess from URL or title
      const urlLower = url.toLowerCase();
      const descLower = (description + " " + html.slice(0, 5000)).toLowerCase();
      let category = "";
      if (urlLower.includes("yamaha") || descLower.includes("yamaha")) category = "Yamaha - ";
      else if (urlLower.includes("mercruiser") || descLower.includes("mercruiser")) category = "MerCruiser - ";
      else if (urlLower.includes("mercury") || descLower.includes("mercury marine")) category = "Mercury Outboard - ";
      else if (urlLower.includes("volvo") || descLower.includes("volvo penta")) category = "Volvo Penta - ";

      res.json({ partNumber, description, sellPrice, costPrice, category, sourceUrl: url });
    } catch (err: any) {
      const msg = err.name === "TimeoutError" ? "Page took too long to load" : err.message;
      res.status(500).json({ error: msg });
    }
  });

  // ─── Parts Order Queue ──────────────────────────────────────────────────────
  app.get("/api/parts-orders", async (_req, res) => {
    try {
      res.json(await storage.getAllPendingOrderParts());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Catalog Tabs ───────────────────────────────────────────────────────────
  app.get("/api/catalog-tabs", async (_req, res) => {
    try {
      res.json(await storage.getCatalogTabs());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/catalog-tabs", async (req, res) => {
    try {
      const { label, matchPrefix } = req.body;
      if (!label) return res.status(400).json({ error: "label required" });
      const tab = await storage.createCatalogTab(String(label), String(matchPrefix ?? label.toLowerCase().replace(/\s+/g, "_")));
      res.status(201).json(tab);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/catalog-tabs/:id", async (req, res) => {
    try {
      const { label, matchPrefix } = req.body;
      await storage.updateCatalogTab(Number(req.params.id), String(label), String(matchPrefix));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/catalog-tabs/:id", async (req, res) => {
    try {
      await storage.deleteCatalogTab(Number(req.params.id));
      res.status(204).end();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/catalog-tabs/reorder", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: "ids array required" });
      await storage.reorderCatalogTabs(ids.map(Number));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Dashboard Stats ────────────────────────────────────────────────────────
  app.get("/api/dashboard", async (_req, res) => {
    try {
      const [jobs, allCatalog, activity] = await Promise.all([
        storage.getAllOpenJobs(),
        storage.getPartsCatalog(),
        storage.getRecentActivity(10),
      ]);

      const statusCounts: Record<string, number> = {};
      let laborHoursSold = 0;
      let laborRevenue = 0;
      let openEstimates = 0;

      for (const j of jobs) {
        statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
        const lines = await storage.getWorkOrderJobs(j.id);
        if (lines.length) {
          for (const line of lines) {
            laborHoursSold += line.laborHours ?? 0;
            laborRevenue += line.pricingType === "flat" ? (line.flatRate ?? 0) : (line.laborHours ?? 0) * (line.laborRate ?? 110);
          }
        } else {
          laborHoursSold += j.laborHours ?? 0;
          laborRevenue += (j.laborHours ?? 0) * (j.laborRate ?? 110);
        }
        if (j.status === "open") openEstimates++;
      }

      const lowStockParts = allCatalog.filter(
        p => p.qtyOnHand !== null && p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint
      ).length;

      res.json({
        statusCounts,
        totalOpen: jobs.length,
        laborHoursSold: Math.round(laborHoursSold * 10) / 10,
        laborRevenue: Math.round(laborRevenue),
        openEstimates,
        lowStockParts,
        recentActivity: activity,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Single service record (for WO detail page) ─────────────────────────────
  app.get("/api/service/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [openJobs, invoicedJobs] = await Promise.all([
        storage.getAllOpenJobs(),
        storage.getInvoicedJobs(),
      ]);
      const found = openJobs.find(j => j.id === id) || invoicedJobs.find(j => j.id === id);
      if (!found) return res.status(404).json({ error: "Not found" });
      res.json(found);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Invoices (completed + invoiced WOs) ───────────────────────────────────
  app.get("/api/invoices", async (_req, res) => {
    try {
      const invJobs = await storage.getInvoicedJobs();
      const withTotals = await Promise.all(invJobs.map(async j => {
        const [jobLines, partsOnJob] = await Promise.all([
          storage.getWorkOrderJobs(j.id),
          storage.getParts(j.id),
        ]);
        const laborTotal = jobLines.reduce((sum, jl) => {
          if (jl.pricingType === "flat") return sum + (jl.flatRate ?? 0);
          return sum + (jl.laborHours ?? 0) * (jl.laborRate ?? 110);
        }, 0);
        const partsTotal = partsOnJob.reduce((sum, p) => sum + (p.quantity ?? 1) * (p.unitPrice ?? 0), 0);
        return { ...j, laborTotal: Math.round(laborTotal * 100) / 100, partsTotal: Math.round(partsTotal * 100) / 100, grandTotal: Math.round((laborTotal + partsTotal) * 100) / 100 };
      }));
      res.json(withTotals);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Work Order Jobs ────────────────────────────────────────────────────────
  app.get("/api/service/:serviceId/jobs", async (req, res) => {
    try {
      res.json(await storage.getWorkOrderJobs(Number(req.params.serviceId)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/service/:serviceId/jobs", async (req, res) => {
    try {
      const job = await storage.createWorkOrderJob({
        ...req.body,
        serviceRecordId: Number(req.params.serviceId),
      });
      res.json(job);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/wo-jobs/:id", async (req, res) => {
    try {
      const job = await storage.updateWorkOrderJob(Number(req.params.id), req.body);
      res.json(job);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/wo-jobs/:id", async (req, res) => {
    try {
      await storage.deleteWorkOrderJob(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Common Jobs ─────────────────────────────────────────────────────────────
  app.get("/api/common-jobs", async (_req, res) => {
    try {
      res.json(await storage.getCommonJobs());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/common-jobs", async (req, res) => {
    try {
      res.json(await storage.createCommonJob(req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/common-jobs/:id", async (req, res) => {
    try {
      res.json(await storage.updateCommonJob(Number(req.params.id), req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/common-jobs/:id", async (req, res) => {
    try {
      await storage.deleteCommonJob(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Customer Communication Log ───────────────────────────────────────────────
  app.get("/api/customers/:id/comm-log", async (req, res) => {
    try {
      res.json(await storage.getCommLog(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/customers/:id/comm-log", async (req, res) => {
    try {
      const entry = await storage.createCommLogEntry({
        ...req.body,
        customerId: Number(req.params.id),
        timestamp: new Date().toISOString(),
      });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/comm-log/:id", async (req, res) => {
    try {
      res.json(await storage.updateCommLogEntry(Number(req.params.id), req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/comm-log/:id", async (req, res) => {
    try {
      await storage.deleteCommLogEntry(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── All photos for a customer (across all their service records + general) ───
  // POST: save a general customer photo (not tied to a specific service record)
  app.post("/api/customers/:id/photos", async (req, res) => {
    try {
      const { storageUrl, storagePath, dataUrl, filename, caption } = req.body;
      if (!filename) { res.status(400).json({ error: "filename required" }); return; }
      const photo = await storage.addServicePhoto({
        serviceRecordId: null,
        customerId: Number(req.params.id),
        filename,
        caption: caption ?? null,
        dataUrl: dataUrl ?? null,
        storageUrl: storageUrl ?? null,
        storagePath: storagePath ?? null,
        uploadedAt: new Date().toISOString(),
      });
      res.json(photo);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/customers/:id/photos", async (req, res) => {
    try {
      const customerId = Number(req.params.id);
      // Get all boats for this customer
      const boats = await storage.getBoats(customerId);
      // Get all service records for each boat
      const serviceRecordArrays = await Promise.all(boats.map(b => storage.getServiceRecords(b.id)));
      const serviceRecords = serviceRecordArrays.flat();
      // Get photos for each service record (with service context attached)
      const photoArrays = await Promise.all(serviceRecords.map(async sr => {
        const photos = await storage.getServicePhotos(sr.id);
        return photos.map(p => ({ ...p, serviceDate: sr.date, serviceDescription: sr.description }));
      }));
      // Also get general customer-level photos (not tied to a service record)
      const generalPhotos = await storage.getCustomerGeneralPhotos(customerId);
      const allPhotos = [
        ...generalPhotos.map(p => ({ ...p, serviceDate: null, serviceDescription: null })),
        ...photoArrays.flat(),
      ];
      res.json(allPhotos);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Service Photos ────────────────────────────────────────────────────────
  app.get("/api/service/:id/photos", async (req, res) => {
    try {
      res.json(await storage.getServicePhotos(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/service/:id/photos", async (req, res) => {
    try {
      const { dataUrl, storageUrl, storagePath, filename, caption } = req.body as {
        dataUrl?: string; storageUrl?: string; storagePath?: string;
        filename: string; caption?: string;
      };
      if (!filename) { res.status(400).json({ error: "filename required" }); return; }
      const photo = await storage.addServicePhoto({
        serviceRecordId: Number(req.params.id),
        filename,
        caption: caption ?? null,
        dataUrl: dataUrl ?? null,
        storageUrl: storageUrl ?? null,
        storagePath: storagePath ?? null,
        uploadedAt: new Date().toISOString(),
      });
      res.json(photo);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/photos/:id/caption", async (req, res) => {
    try {
      const { caption } = req.body as { caption: string };
      await storage.updateServicePhotoCaption(Number(req.params.id), caption ?? "");
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/photos/:id", async (req, res) => {
    try {
      await storage.deleteServicePhoto(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Square Payment Links ───────────────────────────────────────────────────
  app.post("/api/square/checkout/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const hasSquare = SQUARE_TOKEN || SQUARE_PROXY_URL;
    if (!hasSquare) {
      res.status(503).json({ error: "Square not configured" });
      return;
    }

    try {
      const [allOpen, allInv] = await Promise.all([
        storage.getAllOpenJobs(),
        storage.getInvoicedJobs(),
      ]);
      const job = allOpen.find(j => j.id === id) || allInv.find(j => j.id === id);
      if (!job) { res.status(404).json({ error: "Work order not found" }); return; }

      const [jobLines, partsOnJob] = await Promise.all([
        storage.getWorkOrderJobs(id),
        storage.getParts(id),
      ]);
      const laborTotal = jobLines.reduce((sum, jl) => {
        if (jl.pricingType === "flat") return sum + (jl.flatRate ?? 0);
        return sum + (jl.laborHours ?? 0) * (jl.laborRate ?? 110);
      }, 0);
      const partsTotal = partsOnJob.reduce((sum, p) => sum + (p.quantity ?? 1) * (p.unitPrice ?? 0), 0);
      const grandTotal = Math.round((laborTotal + partsTotal) * 100); // cents

      if (grandTotal <= 0) {
        res.status(400).json({ error: "Work order total must be greater than $0" });
        return;
      }

      const woNumber = `WO-${String(id).padStart(4, "0")}`;
      const customerName = (job as any).customerName || "Customer";
      const boatDesc = [(job as any).boatYear, (job as any).boatMake, (job as any).boatModel].filter(Boolean).join(" ");

      const idempotencyKey = `${woNumber}-${Date.now()}`;
      const squareBody = {
        idempotency_key: idempotencyKey,
        order: {
          location_id: SQUARE_LOCATION_ID,
          reference_id: woNumber,
          line_items: [
            {
              name: `${woNumber} – ${boatDesc || "Boat Service"} (${customerName})`,
              quantity: "1",
              base_price_money: { amount: grandTotal, currency: "USD" },
            },
          ],
        },
        checkout_options: {
          merchant_support_email: "BradleysBoatCare@gmail.com",
        },
        payment_note: `Bradley's Boat Care — ${woNumber}`,
      };

      // Use proxy URL when available (published sandbox), otherwise hit Square directly with the token
      const squareEndpoint = SQUARE_PROXY_URL
        ? `${SQUARE_PROXY_URL}/v2/online-checkout/payment-links`
        : `${SQUARE_API_BASE}/v2/online-checkout/payment-links`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Square-Version": "2024-02-22",
      };
      if (!SQUARE_PROXY_URL && SQUARE_TOKEN) {
        headers["Authorization"] = `Bearer ${SQUARE_TOKEN}`;
      }

      const squareRes = await fetch(squareEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(squareBody),
      });
      const squareData: any = await squareRes.json();

      if (!squareRes.ok) {
        console.error("Square API error:", squareData);
        res.status(502).json({ error: squareData?.errors?.[0]?.detail || "Square API error" });
        return;
      }

      const url = squareData?.payment_link?.url || squareData?.payment_link?.long_url;
      if (!url) {
        console.error("Square response missing URL:", JSON.stringify(squareData));
        res.status(500).json({ error: "Square did not return a payment URL" });
        return;
      }

      res.json({ url, amount: grandTotal / 100, woNumber });
    } catch (err: any) {
      console.error("Square checkout error:", err);
      res.status(500).json({ error: err?.message || "Square error" });
    }
  });

  // ─── HTML to PDF ────────────────────────────────────────────────────────────
  app.post("/api/html-to-pdf", async (req: Request, res: Response) => {
    const { html, filename } = req.body as { html: string; filename?: string };
    if (!html) { res.status(400).json({ error: "html required" }); return; }
    let browser;
    try {
      browser = await launchPdfBrowser();
      const page = await isolatedPdfPage(browser);
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      const fname = (filename || "customer-copy").replace(/[^a-zA-Z0-9_\-]/g, "_") + ".pdf";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      console.error("PDF render error:", err);
      res.status(500).json({ error: "PDF generation failed", detail: err?.message });
    } finally {
      if (browser) await browser.close();
    }
  });

  // ─── Schedule (weekly calendar) ──────────────────────────────────────────────────────────────────────────────
  app.get("/api/schedule", async (req, res) => {
    try {
      const start = req.query.start as string | undefined;
      const end = req.query.end as string | undefined;
      if (!start || !end) return res.status(400).json({ error: "start and end query params (YYYY-MM-DD) are required" });
      res.json(await storage.getScheduledEvents(start, end));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/schedule/work-orders", async (req, res) => {
    try {
      const start = req.query.start as string | undefined;
      const end = req.query.end as string | undefined;
      if (!start || !end) return res.status(400).json({ error: "start and end query params (YYYY-MM-DD) are required" });
      res.json(await storage.getWorkOrderDueEvents(start, end));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/schedule", async (req, res) => {
    try {
      if (!req.body?.title || !req.body?.scheduledDate) {
        return res.status(400).json({ error: "title and scheduledDate are required" });
      }
      res.status(201).json(await storage.createScheduledEvent(req.body));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/schedule/:id", async (req, res) => {
    try {
      const r = await storage.updateScheduledEvent(Number(req.params.id), req.body);
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/schedule/:id", async (req, res) => {
    try {
      await storage.deleteScheduledEvent(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Global Search ────────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/search", async (req, res) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      const limit = req.query.limit ? Number(req.query.limit) : 8;
      if (!q) return res.json({ customers: [], boats: [], workOrders: [] });
      res.json(await storage.globalSearch(q, limit));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Customer Service History ──────────────────────────────────────────────────────────────────────────
  app.get("/api/customers/:id/history", async (req, res) => {
    try {
      res.json(await storage.getCustomerHistory(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Customer at-a-glance (Batch 3) — single round-trip summary stats for customer-detail header
  // v10.1 republish trigger
  app.get("/api/customers/:id/at-a-glance", async (req, res) => {
    try {
      res.json(await storage.getCustomerAtAGlance(Number(req.params.id)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Duplicate / Clone Work Order ────────────────────────────────────────────────────────────────────────
  app.post("/api/work-orders/:id/clone", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const original = await storage.getServiceRecord(id);
      if (!original) return res.status(404).json({ error: "Not found" });
      const { boatId, date } = req.body ?? {};
      const created = await storage.cloneWorkOrder(id, { boatId, date });
      res.status(201).json(created);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Work Order PDF export (Playwright, server-rendered) ─────────────────────────────────────────────────────────────────
  // Module-level singleton browser instance, lazily launched on first request and reused
  // across subsequent requests so only the first PDF pays the Chromium cold-start cost.
  app.get("/api/work-orders/:id/pdf", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const job = await storage.getServiceRecord(id);
      if (!job) return res.status(404).json({ error: "Not found" });
      const boat = await storage.getBoat(job.boatId);
      const customer = boat ? await storage.getCustomer(boat.customerId) : undefined;
      const parts = await storage.getParts(id);
      const woJobs = await storage.getWorkOrderJobs(id);

      const html = renderWorkOrderPdfHtml({
        job,
        customer: customer ?? { name: "Unknown" },
        boat: boat ?? {},
        woJobs,
        parts,
      });

      const browser = await getSharedBrowser();
      const page = await isolatedPdfPage(browser);
      try {
        await page.setContent(html, { waitUntil: "networkidle" });
        const pdfBuffer = await page.pdf({
          format: "Letter",
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });
        const fname = `WO-${String(id).padStart(4, "0")}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${fname}"`);
        res.send(Buffer.from(pdfBuffer));
      } finally {
        await page.close();
      }
    } catch (err: any) {
      console.error("Work order PDF error:", err);
      res.status(500).json({ error: "PDF generation failed", detail: err?.message });
    }
  });

  // ─── Digital signature capture (Feature C, Batch 2) ──────────────────────────────────────────────────────────
  // Requires the batch2-migration.sql columns (signature_data_url, signed_by, signed_at) to
  // already be applied to service_records — not yet applied as of this batch. See migration file.
  app.post("/api/work-orders/:id/signature", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { signatureDataUrl, signedBy } = req.body as { signatureDataUrl?: string; signedBy?: string };
      if (!signatureDataUrl) return res.status(400).json({ error: "signatureDataUrl required" });
      const r = await storage.updateServiceRecord(id, {
        signatureDataUrl,
        signedBy: signedBy ?? null,
        signedAt: new Date().toISOString(),
      });
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (err: any) {
      console.error("Signature save error:", err);
      res.status(500).json({ error: err?.message || "Failed to save signature" });
    }
  });
}
