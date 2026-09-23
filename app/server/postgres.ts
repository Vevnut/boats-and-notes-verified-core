import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

// The existing application uses numeric IDs. Reject IDs outside JS's safe range.
pg.types.setTypeParser(20, value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error("Record ID exceeds the supported range");
  return n;
});
pg.types.setTypeParser(1082, value => value); // date-only values must not shift timezone
pg.types.setTypeParser(1184, value => new Date(value).toISOString());

export const tables = [
  "customers", "boats", "service_records", "parts", "parts_catalog", "labor_codes",
  "work_order_templates", "activity_log", "work_order_jobs", "common_jobs",
  "service_photos", "customer_comm_log", "catalog_tabs", "scheduled_events", "status_history",
] as const;
const allowed = new Set<string>(tables);
export const context = new AsyncLocalStorage<{
  client: pg.PoolClient; owner: string; versions: Map<string, string>;
}>();
let pool: pg.Pool | undefined;
export function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("Database setting missing"), { code: "BN_DB_MISSING" });
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash)
      throw new Error("Invalid database address");
  } catch {
    throw Object.assign(new Error("Database setting invalid"), { code: "BN_DB_INVALID" });
  }
  const local = ["127.0.0.1", "localhost"].includes(url.hostname) && !process.env.VERCEL;
  // Do not let URL options silently disable certificate verification.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  pool = new pg.Pool({
    connectionString: url.toString(), max: 3, connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000, allowExitOnIdle: true,
    ssl: local ? false : {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}),
    },
  });
  pool.on("error", () => console.error("An idle database connection closed"));
  return pool;
}
export function current() {
  const value = context.getStore();
  if (!value) throw new Error("Database access requires an authenticated request transaction");
  return value;
}
export function sql(text: string, values: any[] = []) { return current().client.query(text, values); }
export function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Invalid database identifier");
  return `"${value}"`;
}
export function tableName(table: string) {
  if (!allowed.has(table)) throw new Error("Unsupported collection");
  return `public.${identifier(table)}`;
}
const versionExpr = `xmin::text || ':' || ctid::text`;
export async function recordVersion(table: string, id: number, lock = false) {
  const result = await sql(`SELECT ${versionExpr} AS version FROM ${tableName(table)} WHERE id=$1${lock ? " FOR UPDATE" : ""}`, [id]);
  return result.rows[0]?.version ?? null;
}
function capture(table: string, rows: any[]) {
  return rows.map(({ __revision, ...row }) => {
    if (__revision) current().versions.set(`${table}/${row.id}`, __revision);
    return row;
  });
}
type Result<T> = { data: T; error: { message: string } | null; count: number };
class Query<T = any[]> implements PromiseLike<Result<T>> {
  private conditions: string[] = [];
  private args: any[] = [];
  private sorting: string[] = [];
  private mode = "select";
  private payload: any;
  private selection = "*";
  private one = false;
  private max?: number;
  constructor(private table: string) { tableName(table); }
  private param(value: any) { this.args.push(value); return `$${this.args.length}`; }
  select(value = "*", _options?: any) { this.selection = value; return this; }
  insert(value: any) { this.mode = "insert"; this.payload = value; return this; }
  update(value: any) { this.mode = "update"; this.payload = value; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(key: string, value: any) { this.conditions.push(`${identifier(key)} = ${this.param(value)}`); return this; }
  is(key: string, value: any) { this.conditions.push(`${identifier(key)} IS NOT DISTINCT FROM ${this.param(value)}`); return this; }
  in(key: string, values: any[]) { this.conditions.push(`${identifier(key)} = ANY(${this.param(values)})`); return this; }
  not(key: string, operator: string, value: any) {
    if (operator === "is") this.conditions.push(`${identifier(key)} IS DISTINCT FROM ${this.param(value)}`);
    else if (operator === "in") {
      const values = JSON.parse(`[${String(value).slice(1, -1)}]`);
      this.conditions.push(`NOT (${identifier(key)} = ANY(${this.param(values)}))`);
    } else throw new Error("Unsupported filter");
    return this;
  }
  gte(key: string, value: any) { this.conditions.push(`${identifier(key)} >= ${this.param(value)}`); return this; }
  lte(key: string, value: any) { this.conditions.push(`${identifier(key)} <= ${this.param(value)}`); return this; }
  ilike(key: string, value: string) { this.conditions.push(`${identifier(key)} ILIKE ${this.param(value)}`); return this; }
  or(expression: string) {
    const terms = expression.split(",").map(term => {
      const [key, op, ...value] = term.split(".");
      if (op !== "ilike") throw new Error("Unsupported search filter");
      return `${identifier(key)} ILIKE ${this.param(value.join("."))}`;
    });
    this.conditions.push(`(${terms.join(" OR ")})`); return this;
  }
  order(key: string, options?: { ascending?: boolean }) {
    this.sorting.push(`${identifier(key)} ${options?.ascending === false ? "DESC" : "ASC"}`); return this;
  }
  limit(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid row limit");
    this.max = value; return this;
  }
  single(): Query<any> { this.one = true; return this as Query<any>; }
  private async execute(): Promise<Result<T>> {
    const table = tableName(this.table);
    const where = this.conditions.length ? ` WHERE ${this.conditions.join(" AND ")}` : "";
    const returning = `*, ${versionExpr} AS __revision`;
    let rows: any[];
    if (this.mode === "insert") {
      rows = [];
      for (const item of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const entries = Object.entries(item).filter(([, v]) => v !== undefined);
        const query = entries.length
          ? `INSERT INTO ${table} (${entries.map(([k]) => identifier(k)).join(",")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(",")}) RETURNING ${returning}`
          : `INSERT INTO ${table} DEFAULT VALUES RETURNING ${returning}`;
        rows.push(...(await sql(query, entries.map(([, v]) => v))).rows);
      }
    } else if (this.mode === "update") {
      const entries = Object.entries(this.payload).filter(([k, v]) => v !== undefined && k !== "id");
      if (!entries.length) rows = (await sql(`SELECT ${returning} FROM ${table}${where}`, this.args)).rows;
      else {
        const assignments = entries.map(([key, value]) => `${identifier(key)}=${this.param(value)}`);
        rows = (await sql(`UPDATE ${table} SET ${assignments.join(",")}${where} RETURNING ${returning}`, this.args)).rows;
      }
    } else if (this.mode === "delete") {
      // The original schema has no FK for parts.job_id. Preserve the tested behavior.
      if (this.table === "work_order_jobs") {
        await sql(`UPDATE public.parts SET job_id=NULL WHERE job_id IN (SELECT id FROM ${table}${where})`, this.args);
      }
      rows = (await sql(`DELETE FROM ${table}${where} RETURNING *`, this.args)).rows;
    } else {
      const order = this.sorting.length ? ` ORDER BY ${this.sorting.join(",")}` : "";
      const limit = this.max === undefined ? "" : ` LIMIT ${this.max}`;
      rows = (await sql(`SELECT ${returning} FROM ${table}${where}${order}${limit}`, this.args)).rows;
    }
    rows = capture(this.table, rows);
    for (const row of rows) {
      if (this.selection.includes("boats(") && row.boat_id != null) {
        row.boats = (await new Query<any>("boats").select(this.selection.replace("boats(", "")).eq("id", row.boat_id).single()).data;
      }
      if (this.selection.includes("customers(") && row.customer_id != null) {
        row.customers = (await new Query<any>("customers").eq("id", row.customer_id).single()).data;
      }
    }
    return { data: (this.one ? rows[0] ?? null : rows) as T, error: null, count: rows.length };
  }
  then<A = Result<T>, B = never>(
    resolve?: ((value: Result<T>) => A | PromiseLike<A>) | null,
    reject?: ((reason: any) => B | PromiseLike<B>) | null,
  ): Promise<A | B> { return this.execute().then(resolve, reject); }
}
export const database = { from: (table: string) => new Query(table) };
