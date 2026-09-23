import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { sampleData } from "./test-seed";

const directory = path.resolve(process.cwd(), "test-data");
mkdirSync(directory, { recursive: true });
const db = new Database(path.join(directory, "sample.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL, id INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, body TEXT NOT NULL);
`);
const allowed = new Set([
  "customers", "boats", "service_records", "parts", "parts_catalog", "labor_codes",
  "work_order_templates", "activity_log", "work_order_jobs", "common_jobs",
  "service_photos", "customer_comm_log", "catalog_tabs", "scheduled_events", "status_history",
]);
const read = (table: string): any[] =>
  (db.prepare("SELECT body FROM records WHERE collection = ? ORDER BY id").all(table) as any[])
    .map(row => JSON.parse(row.body));
const put = (table: string, row: any) => {
  db.prepare("INSERT OR REPLACE INTO records(collection,id,body) VALUES (?,?,?)")
    .run(table, row.id, JSON.stringify(row));
  return row;
};
function deleteRow(table: string, id: number) {
  const children: Record<string, [string, string][]> = {
    customers: [["boats", "customer_id"], ["customer_comm_log", "customer_id"], ["service_photos", "customer_id"], ["scheduled_events", "customer_id"]],
    boats: [["service_records", "boat_id"], ["scheduled_events", "boat_id"]],
    service_records: [["work_order_jobs", "service_record_id"], ["parts", "service_record_id"], ["service_photos", "service_record_id"], ["status_history", "service_record_id"], ["scheduled_events", "service_record_id"]],
  };
  for (const [child, field] of children[table] ?? [])
    for (const row of read(child).filter(r => r[field] === id)) deleteRow(child, row.id);
  if (table === "work_order_jobs")
    for (const row of read("parts").filter(r => r.job_id === id)) put("parts", { ...row, job_id: null });
  db.prepare("DELETE FROM records WHERE collection = ? AND id = ?").run(table, id);
}
function joined(table: string, row: any, selection: string): any {
  if (selection.includes("boats(") && row.boat_id != null) {
    const boat = read("boats").find(b => b.id === row.boat_id);
    row = { ...row, boats: boat ? joined("boats", boat, selection) : null };
  }
  if (selection.includes("customers(") && row.customer_id != null)
    row = { ...row, customers: read("customers").find(c => c.id === row.customer_id) ?? null };
  return row;
}
const like = (value: any, pattern: string) => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(String(value ?? ""));
};

type QueryResult<T> = { data: T; error: { message: string } | null; count: number };
class Query<T = any[]> implements PromiseLike<QueryResult<T>> {
  private filters: ((row: any) => boolean)[] = [];
  private sorting: [string, boolean][] = [];
  private mode = "select";
  private payload: any;
  private selection = "*";
  private one = false;
  private max = Infinity;
  constructor(private table: string) {
    if (!allowed.has(table)) throw new Error(`Unsupported test collection: ${table}`);
  }
  select(selection = "*", _options?: any) { this.selection = selection; return this; }
  insert(value: any) { this.mode = "insert"; this.payload = value; return this; }
  update(value: any) { this.mode = "update"; this.payload = value; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(key: string, value: any) { this.filters.push(r => r[key] === value); return this; }
  is(key: string, value: any) { this.filters.push(r => value === null ? r[key] == null : r[key] === value); return this; }
  in(key: string, values: any[]) { this.filters.push(r => values.includes(r[key])); return this; }
  not(key: string, operator: string, value: any) {
    if (operator === "is") this.filters.push(r => value === null ? r[key] != null : r[key] !== value);
    else if (operator === "in") {
      const values = JSON.parse(`[${String(value).slice(1, -1)}]`);
      this.filters.push(r => !values.includes(r[key]));
    } else throw new Error(`Unsupported test filter ${operator}`);
    return this;
  }
  gte(key: string, value: any) { this.filters.push(r => r[key] != null && r[key] >= value); return this; }
  lte(key: string, value: any) { this.filters.push(r => r[key] != null && r[key] <= value); return this; }
  ilike(key: string, pattern: string) { this.filters.push(r => like(r[key], pattern)); return this; }
  or(expression: string) {
    const terms = expression.split(",").map(term => {
      const [key, op, ...value] = term.split(".");
      if (op !== "ilike") throw new Error("Unsupported test OR filter");
      return (row: any) => like(row[key], value.join("."));
    });
    this.filters.push(r => terms.some(test => test(r))); return this;
  }
  order(key: string, options?: { ascending?: boolean }) {
    this.sorting.push([key, options?.ascending !== false]); return this;
  }
  limit(value: number) { this.max = Math.max(0, value); return this; }
  single(): Query<any> { this.one = true; return this as Query<any>; }
  private execute() {
    return db.transaction(() => {
      let rows = read(this.table).filter(r => this.filters.every(test => test(r)));
      if (this.mode === "insert") {
        let id = Math.max(0, ...read(this.table).map(r => r.id)) + 1;
        rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(value =>
          put(this.table, { created_at: new Date().toISOString(), ...value, id: id++ }));
      } else if (this.mode === "update") {
        const changes = Object.fromEntries(Object.entries(this.payload).filter(([, v]) => v !== undefined));
        rows = rows.map(row => put(this.table, { ...row, ...changes, id: row.id }));
      } else if (this.mode === "delete") {
        rows.forEach(row => deleteRow(this.table, row.id));
      }
      rows.sort((a, b) => {
        for (const [key, asc] of this.sorting) {
          if (a[key] === b[key]) continue;
          return (a[key] == null ? -1 : b[key] == null ? 1 : a[key] < b[key] ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
      const count = rows.length;
      rows = rows.slice(0, this.max).map(r => joined(this.table, r, this.selection));
      return { data: (this.one ? rows[0] ?? null : rows) as T, error: null, count };
    })();
  }
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }
}
export const sandboxDatabase = { from: (table: string) => new Query(table) };
export function preferences() {
  const row = db.prepare("SELECT body FROM metadata WHERE key='preferences'").get() as any;
  return row ? JSON.parse(row.body) : {};
}
export function setPreference(key: string, value: string) {
  const values = { ...preferences(), [key]: value };
  db.prepare("INSERT OR REPLACE INTO metadata(key,body) VALUES ('preferences',?)").run(JSON.stringify(values));
}
export function resetSamples() {
  db.transaction(() => {
    db.prepare("DELETE FROM records").run();
    db.prepare("DELETE FROM metadata").run();
    for (const [table, rows] of Object.entries(sampleData()))
      rows.forEach((row: any, index: number) => put(table, { ...row, id: row.id ?? index + 1 }));
    db.prepare("INSERT INTO metadata(key,body) VALUES ('initialized','true')").run();
  })();
}
if (!db.prepare("SELECT key FROM metadata WHERE key='initialized'").get()) resetSamples();
