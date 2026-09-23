import { useEffect, useState } from "react";
import { saveListeners, saveState } from "@/lib/queryClient";
export default function SaveStatus() {
  const [, render] = useState(0);
  useEffect(() => { const fn = () => render(n => n + 1); saveListeners.add(fn); return () => { saveListeners.delete(fn); }; }, []);
  const failed = [...saveState.failures.values()];
  return <div role="status" aria-live="polite" data-testid="save-status"
    className={`px-4 py-2 text-xs border-b ${failed.length ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground"}`}>
    {saveState.pending ? "Saving to your permanent database. Please keep this page open." :
      failed.length ? "Some saves are not confirmed. Review the affected form and retry Save." :
      saveState.confirmed ? `Last save confirmed by database at ${saveState.confirmed}. Unfinished drafts still need Save.` :
      "Save status: no record save confirmed in this session. Drafts are separate from saved records."}
    {failed.length > 0 && <details className="mt-1"><summary>Save details</summary>{failed.map((m, i) => <p key={i}>{m}</p>)}</details>}
  </div>;
}
