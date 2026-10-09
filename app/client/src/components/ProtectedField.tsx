import { useState } from "react";
import { useRecoveryDraft } from "@/lib/use-recovery-draft";
import { dismissSaveFailure, queryClient, type BaselineField, type SaveOptions } from "@/lib/queryClient";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

// Single text fields that save against their own starting value instead of the
// whole-record version. The server accepts exactly these (server/field-baseline.ts).
const baselineLabels: Record<string, Record<string, BaselineField>> = {
  "wo-jobs": {
    "Description (customer-facing)": "description",
    "Tech Notes (internal)": "techNotes",
    "Customer Notes (shows on customer copy)": "customerNotes",
  },
  service: {
    "Work Order Description / Summary": "description",
    "General Tech Notes (internal)": "techNotes",
  },
};

export default function ProtectedField({ label, value, onSave, resource, version, field, multiline, type = "text", rows = 3, compact, className }: {
  label: string; value: string | null | undefined; onSave: (value: string, options: SaveOptions) => Promise<unknown>;
  resource: string; version?: string; field?: BaselineField; multiline?: boolean; type?: string; rows?: number; compact?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const kind = /^\/api\/(wo-jobs|service)\/\d+$/.exec(resource)?.[1];
  const baselineField: BaselineField | undefined = field ?? (kind ? baselineLabels[kind][label] : undefined);
  return <div className={`min-w-0 ${className ?? ""}`}>
    {!compact && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>}
    {editing ? <Editor key={resource + label} {...{ label, value, onSave, resource, version, field: baselineField, multiline, type, rows }} close={() => setEditing(false)} /> :
      <button title={compact ? "Click to rename" : "Click to edit"} onClick={() => setEditing(true)}
        className="w-full text-left text-sm min-h-[44px] hover:bg-accent/50 rounded" style={{ whiteSpace: "pre-wrap" }}>
        {value || "Not set. Click to add"}
      </button>}
  </div>;
}
function Editor({ label, value, onSave, resource, version, field, multiline, type, rows, close }: any) {
  const draft = useRecoveryDraft<string>(`${resource}:${label}`, value ?? "", version, field);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (pending) return;
    setPending(true); setError("");
    try { await onSave(draft.value, await draft.options()); await draft.clear(true); close(); }
    catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  };
  return <div className="space-y-2">
    {multiline ? <textarea aria-label={label} autoFocus disabled={!draft.ready || pending} rows={rows} value={draft.value}
      onChange={e => draft.change(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" /> :
      <Input aria-label={label} autoFocus disabled={!draft.ready || pending} type={type} value={draft.value}
        onChange={e => draft.change(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} />}
    {draft.message && <p role="status" className="text-xs text-muted-foreground">{draft.message}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-1">
      <Button size="sm" disabled={pending || !draft.ready} onClick={save}>{pending ? "Saving..." : "Save"}</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={close}>Close, keep draft</Button>
      {draft.dirty && <Button size="sm" variant="ghost" onClick={draft.download}>Download draft</Button>}
      {draft.dirty && <Button size="sm" variant="ghost" disabled={pending} onClick={async () => { try { await draft.clear(); await queryClient.invalidateQueries(); dismissSaveFailure(resource); close(); } catch { setError("Could not discard the server draft. Reconnect and try again."); } }}>Discard draft</Button>}
    </div>
  </div>;
}
