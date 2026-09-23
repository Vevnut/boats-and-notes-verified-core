import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function TestBanner() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reset = async () => {
    setBusy(true); setError("");
    try {
      await apiRequest("POST", "/api/test/reset", { confirm: "RESET SAMPLE DATA" });
      queryClient.clear();
      window.location.hash = "#/";
      window.location.reload();
    } catch { setError("Reset failed. Your test data has not been cleared by this screen."); setBusy(false); }
  };
  return <>
    <section className="test-banner" aria-label="Isolated test environment" data-testid="test-mode-banner">
      <FlaskConical size={17} className="shrink-0" />
      <div className="min-w-0">
        <strong>ISOLATED TEST COPY</strong>
        <span className="block sm:inline sm:ml-2">Sample data only. Live app disconnected.</span>
        <span className="hidden xl:inline ml-2 opacity-80">Payments & external imports disabled.</span>
      </div>
      <button type="button" data-testid="reset-samples" onClick={() => setOpen(true)} className="ml-auto shrink-0 flex items-center gap-1.5 rounded px-2 py-2 hover:bg-amber-200/50">
        <RotateCcw size={14} /><span>Reset samples</span>
      </button>
    </section>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset this test copy?</DialogTitle>
          <DialogDescription>This removes edits, uploads, and preferences in this test copy and restores fictional sample records. Your live app and real records are not connected and will not change.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep test edits</Button>
          <Button disabled={busy} onClick={reset}>{busy ? "Resetting..." : "Reset sample data"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
