import { useEffect, useRef, useState } from "react";
import { apiRequest, type SaveOptions } from "./queryClient";

type Draft<T> = { id: string; slot: string; sequence: number; value: T; version?: string; seed?: string; ancestors?: string[]; baseValue?: T };
const openDrafts = new Map<string, Draft<any>>();
window.addEventListener("beforeunload", event => {
  if (openDrafts.size) { event.preventDefault(); event.returnValue = ""; }
});
export function useRecoveryDraft<T>(slot: string, initial: T, version?: string, field?: "description") {
  const current = useRef<Draft<T>>({ id: crypto.randomUUID(), slot, sequence: 0, value: initial, version, baseValue: initial });
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  const confirmed = useRef(0);
  useEffect(() => {
    active.current = true;
    const recover = (rows: Draft<T>[]) => {
      if (!active.current) return;
      const local = [...openDrafts.values()].filter(d => d.slot === slot).at(-1);
      if (local) rows = [local];
      if (rows[0]) {
        current.current = { ...rows[0], id: crypto.randomUUID(), seed: rows[0].seed ?? rows[0].id,
          ancestors: [...(rows[0].ancestors ?? []), rows[0].id] };
        openDrafts.set(current.current.id, current.current);
        setValue(rows[0].value); setDirty(true);
        setMessage("Recovered unfinished draft. Review it, then click Save.");
      }
    };
    apiRequest("GET", `/api/recovery/drafts?slot=${encodeURIComponent(slot)}`).then(r => r.json()).then(recover).catch(() => {
      recover([]);
      if (active.current) setMessage("Draft recovery unavailable. Keep this page open or download your draft.");
    }).finally(() => { if (active.current) setReady(true); });
    return () => {
      active.current = false;
      if (current.current.sequence > 0) {
        const snapshot = { ...current.current };
        void apiRequest("PUT", `/api/recovery/drafts/${snapshot.id}`, snapshot).catch(() => {});
      }
    };
  }, [slot]);
  const change = (next: T) => {
    current.current = { ...current.current, value: next, sequence: current.current.sequence + 1 };
    openDrafts.set(current.current.id, current.current);
    setValue(next); setDirty(true); setRevision(n => n + 1);
    setMessage("Draft changed. Backing it up...");
  };
  useEffect(() => {
    if (!dirty || !ready) return;
    const persist = async () => {
      const snapshot = { ...current.current };
      try {
        await apiRequest("PUT", `/api/recovery/drafts/${snapshot.id}`, snapshot);
        confirmed.current = Math.max(confirmed.current, snapshot.sequence);
        if (active.current && current.current.sequence === snapshot.sequence)
          setMessage("Draft backed up to your database. Click Save to update the record.");
      } catch {
        if (active.current) setMessage("Draft not backed up. Keep this page open or download your draft.");
      }
    };
    const timer = setTimeout(persist, 350);
    const retry = setInterval(() => { if (confirmed.current < current.current.sequence) void persist(); }, 5000);
    return () => { clearTimeout(timer); clearInterval(retry); };
  }, [dirty, ready, revision]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const options = async (): Promise<SaveOptions> => {
    const d = current.current;
    const bytes = new TextEncoder().encode(JSON.stringify([d.seed ?? d.id, d.slot, d.sequence, d.value, d.version, field, d.baseValue]));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return { version: d.version, operationId: "draft_" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join(""),
      ...(field && typeof d.baseValue === "string" ? { fieldBase: { field, value: d.baseValue } } : {}) };
  };
  const clear = async (saved = false) => {
    for (const id of [current.current.id, ...(current.current.ancestors ?? [])]) {
      try { await apiRequest("DELETE", `/api/recovery/drafts/${id}`); }
      catch (error) { if (!saved) throw error; }
      openDrafts.delete(id);
    }
    setDirty(false); setMessage("");
    current.current = { id: crypto.randomUUID(), slot, sequence: 0, value: current.current.value, version, baseValue: current.current.value };
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(current.current, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "boats-and-notes-unfinished-draft.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return { value, change, ready, dirty, message, options, clear, download };
}
