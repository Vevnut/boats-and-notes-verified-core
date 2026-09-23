import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import ts from "typescript";

// Unlike the bundled local server or tsx, this exercises Node's native ESM
// resolution against separately emitted files, as the Vercel runtime does.
// No database connection, owner credentials, or record writes are used.
const root = await mkdtemp(join(tmpdir(), "boats-notes-runtime-"));
let server;
process.env.VERCEL = "1";
delete process.env.DATABASE_URL;
try {
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
  await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
  for (const dir of ["api", "server", "shared"]) {
    await mkdir(join(root, dir), { recursive: true });
    for (const name of await readdir(dir)) {
      if (!name.endsWith(".ts")) continue;
      const source = await readFile(join(dir, name), "utf8");
      const result = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
        fileName: name,
      });
      await writeFile(join(root, dir, name.replace(/\.ts$/, ".js")), result.outputText);
    }
  }
  const { default: handler } = await import(pathToFileURL(join(root, "api/index.js")).href);
  server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    service: "boats-and-notes", storage: "postgres", configured: false,
  });
  const config = await fetch(`${base}/api/config`);
  assert.equal(config.status, 200);
  assert.match((await config.json()).supabaseUrl, /^https:\/\//);
  assert.equal((await fetch(`${base}/api/customers`)).status, 401);
  console.log("PASS Native ESM startup, health, public config, and unauthenticated record protection");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
