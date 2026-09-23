import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useKeybind, useKeybinds, useClickBinds } from "@/lib/keybind-provider";
import { chordToLabel, clickModifierToLabel, SCOPE_LABELS, SCOPE_ORDER, CLICK_TARGET_ORDER } from "@/lib/keybinds";
import { Keyboard, MousePointerClick } from "lucide-react";
import { useState } from "react";

export default function KeybindCheatSheet() {
  const [open, setOpen] = useState(false);
  const { registry } = useKeybinds();
  const { clickRegistry } = useClickBinds();

  useKeybind("help.cheatSheet", () => setOpen(v => !v), []);

  const bindingsByScope = SCOPE_ORDER.map(scope => ({
    scope,
    label: SCOPE_LABELS[scope],
    items: registry.filter(k => k.scope === scope),
  })).filter(g => g.items.length > 0);

  const clicksByTarget = CLICK_TARGET_ORDER.map(target => ({
    target,
    items: clickRegistry.filter(c => c.target === target),
  })).filter(g => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} className="text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[11px] font-mono">?</kbd> anytime to toggle this sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {bindingsByScope.map(group => (
            <div key={group.scope}>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                {group.items.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm ${i > 0 ? "border-t border-border" : ""} bg-card`}
                  >
                    <span className="text-foreground/90">{item.description}</span>
                    <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono text-muted-foreground">
                      {chordToLabel(item.chord)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Modifier + Click Actions */}
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MousePointerClick size={13} />Modifier + Click Actions
            </h3>
            <div className="space-y-3">
              {clicksByTarget.map(group => (
                <div key={group.target} className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-1.5 text-xs font-semibold bg-muted/60 text-foreground/80">{group.target}</div>
                  {group.items.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm border-t border-border bg-card"
                    >
                      <span className="text-foreground/90">{item.description}</span>
                      <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono text-muted-foreground">
                        {clickModifierToLabel(item.modifier)}
                      </kbd>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <Link
            href="/settings/keybinds"
            onClick={() => setOpen(false)}
            className="text-sm text-primary hover:underline"
          >
            Edit shortcuts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
