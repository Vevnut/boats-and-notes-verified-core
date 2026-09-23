import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { preferences, setPreference, resetSamples } from "./test-database";

// Fail closed: no recovered route can use fetch to contact an external service.
globalThis.fetch = async () => { throw new Error("External network access is disabled in this isolated test copy."); };

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "12mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.path.startsWith("/api/square") || req.path === "/api/parts-catalog/import-url") {
    return res.status(403).json({ error: "Disabled in the isolated test copy. No payment or external request was made." });
  }
  next();
});
app.get("/api/test/status", (_req, res) => res.json({
  mode: "isolated-test", database: "local SQLite", productionConnected: false,
  externalRequests: false, payments: false, sampleData: true,
}));
app.get("/api/test/preferences", (_req, res) => res.json(preferences()));
app.put("/api/test/preferences", (req, res) => {
  const { key, value } = req.body ?? {};
  if (typeof key !== "string" || !key.startsWith("boatsandnotes:") || typeof value !== "string" || value.length > 50000)
    return res.status(400).json({ error: "Invalid test preference" });
  setPreference(key, value); res.json({ ok: true });
});
app.post("/api/test/reset", (req, res) => {
  if (req.body?.confirm !== "RESET SAMPLE DATA") return res.status(400).json({ error: "Explicit reset confirmation required" });
  resetSamples(); res.json({ ok: true });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Unknown test API route" }));

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "127.0.0.1",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
