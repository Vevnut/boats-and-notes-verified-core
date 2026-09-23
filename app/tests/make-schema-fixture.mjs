// Development-only: mechanically convert the read-only schema inspection
// response into a disposable local fixture. No customer records are included.
import fs from "node:fs";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).result.result;
const payload = JSON.parse(raw.slice(raw.indexOf("\n[") + 1, raw.indexOf("\n</untrusted-data")));
const schema = payload[0].schema;
const identifier = s => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Error("Invalid identifier");
  return `"${s}"`;
};
const tables = [...new Set(schema.columns.map(c => c.table_name))];
let sql = `-- Metadata-only fixture for a disposable local database.\nCREATE SCHEMA IF NOT EXISTS auth;\n`;
sql += `DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
sql += `DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
sql += `CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;\nGRANT USAGE ON SCHEMA auth TO authenticated;\n`;
for (const table of tables) {
  const columns = schema.columns.filter(c => c.table_name === table).map(c => {
    let type = c.data_type;
    if (c.column_default?.startsWith("nextval(")) type = "bigserial";
    return `${identifier(c.column_name)} ${type}${c.is_nullable === "NO" ? " NOT NULL" : ""}${c.column_default && type !== "bigserial" ? ` DEFAULT ${c.column_default}` : ""}`;
  });
  sql += `CREATE TABLE public.${identifier(table)} (${columns.join(",")});\n`;
}
for (const c of [...schema.constraints].sort((a,b) => Number(b.definition.startsWith("PRIMARY KEY")) - Number(a.definition.startsWith("PRIMARY KEY"))))
  sql += `ALTER TABLE public.${identifier(c.table_name)} ADD ${c.definition};\n`;
for (const table of tables) {
  sql += `ALTER TABLE public.${identifier(table)} ENABLE ROW LEVEL SECURITY;\n`;
  sql += `CREATE POLICY owner_only ON public.${identifier(table)} FOR ALL USING (auth.uid()='77228746-e36f-4d72-84fd-d9c74aa532dc'::uuid) WITH CHECK (auth.uid()='77228746-e36f-4d72-84fd-d9c74aa532dc'::uuid);\n`;
}
sql += "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;\nGRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;\n";
fs.writeFileSync(new URL("./schema-fixture.sql", import.meta.url), sql);
