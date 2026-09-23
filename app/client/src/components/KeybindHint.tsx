import { usePendingSequence } from "@/lib/keybind-provider";

/**
 * Small floating pill shown in the bottom-right while a leader-key sequence
 * (e.g. "g") is buffered, waiting for its follow-up key. Prevents "did that
 * even register?" confusion.
 */
export default function KeybindHint() {
  const pending = usePendingSequence();
  if (!pending || pending.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150"
      data-testid="keybind-sequence-hint"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border border-border bg-popover/95 backdrop-blur-sm text-sm font-mono">
        {pending.map((k, i) => (
          <kbd key={i} className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground text-xs">
            {k}
          </kbd>
        ))}
        <span className="text-muted-foreground text-xs">…</span>
      </div>
    </div>
  );
}
