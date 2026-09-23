import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, RotateCcw, Printer, AlertTriangle, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useKeybinds, useClickBinds } from "@/lib/keybind-provider";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  chordToLabel, parseChord, normalizeEventKey, SCOPE_LABELS, SCOPE_ORDER,
  clickModifierToLabel, CLICK_TARGET_ORDER, type ClickModifier,
} from "@/lib/keybinds";

const SEQUENCE_CAPTURE_TIMEOUT_MS = 800;

// ─── Keyboard shortcut row ───────────────────────────────────────────────────
function ShortcutRow({
  item, onSave, onReset, checkConflict,
}: {
  item: { id: string; description: string; chord: string; defaultChord: string; isOverridden: boolean; scope: string };
  onSave: (id: string, chord: string) => void;
  onReset: (id: string) => void;
  checkConflict: (id: string, chord: string) => { ok: boolean; conflictsWith?: any };
}) {
  const [listening, setListening] = useState(false);
  const [captured, setCaptured] = useState<string[]>([]);
  const [conflictMsg, setConflictMsg] = useState<{ chord: string; label: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!listening) return;

    function finish(keys: string[]) {
      if (keys.length === 0) { setListening(false); return; }
      const chord = keys.join(" ");
      const result = checkConflict(item.id, chord);
      if (!result.ok && result.conflictsWith) {
        setConflictMsg({ chord, label: result.conflictsWith.description });
      } else {
        onSave(item.id, chord);
        setListening(false);
        setCaptured([]);
      }
    }

    function handleKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setListening(false); setCaptured([]); return; }

      const bits: string[] = [];
      if (e.ctrlKey || e.metaKey) bits.push("Ctrl");
      if (e.altKey) bits.push("Alt");
      if (e.shiftKey) bits.push("Shift");
      const key = normalizeEventKey(e);
      if (["control", "meta", "shift", "alt"].includes(key)) return;

      let token: string;
      if (bits.length > 0) {
        token = [...bits, key.length === 1 ? key : key].join("+");
      } else {
        token = key;
      }

      setCaptured(prev => {
        const next = [...prev, token];
        if (timerRef.current) clearTimeout(timerRef.current);
        // Modifier chords resolve immediately; plain keys wait for a possible sequence follow-up.
        if (bits.length > 0) {
          finish(next);
        } else {
          timerRef.current = setTimeout(() => finish(next), SEQUENCE_CAPTURE_TIMEOUT_MS);
        }
        return next;
      });
    }

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, item.id]);

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-card first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground/90">{item.description}</p>
        {conflictMsg && (
          <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle size={12} className="shrink-0" />
            <span>Conflicts with "{conflictMsg.label}".</span>
            <button
              className="underline font-medium"
              onClick={() => { onSave(item.id, conflictMsg.chord); setConflictMsg(null); setListening(false); setCaptured([]); }}
            >
              Save anyway
            </button>
            <button className="underline" onClick={() => { setConflictMsg(null); setCaptured([]); }}>Cancel</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { setListening(true); setCaptured([]); setConflictMsg(null); }}
          className={`min-w-[110px] text-center px-2.5 py-1.5 rounded-md border text-xs font-mono transition-colors ${
            listening
              ? "border-primary bg-primary/10 text-primary animate-pulse"
              : "border-border bg-muted hover:bg-accent text-foreground"
          }`}
          data-testid={`button-remap-${item.id}`}
        >
          {listening ? (captured.length > 0 ? captured.join(" ") : "Press keys...") : chordToLabel(item.chord)}
        </button>
        <span className="text-[10px] text-muted-foreground w-16 shrink-0">Default: {chordToLabel(item.defaultChord)}</span>
        {item.isOverridden && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onReset(item.id)} data-testid={`button-reset-${item.id}`}>
            <RotateCcw size={11} className="mr-1" />Reset
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Click-bind row ───────────────────────────────────────────────────────────
function ClickBindRow({
  item, onSave, onReset, checkConflict,
}: {
  item: { id: string; target: string; description: string; modifier: ClickModifier; defaultModifier: ClickModifier; isOverridden: boolean };
  onSave: (id: string, mod: ClickModifier) => void;
  onReset: (id: string) => void;
  checkConflict: (id: string, mod: ClickModifier) => { ok: boolean; conflictsWith?: any };
}) {
  const [conflictMsg, setConflictMsg] = useState<{ mod: ClickModifier; label: string } | null>(null);

  function handleChange(mod: ClickModifier) {
    const result = checkConflict(item.id, mod);
    if (!result.ok && result.conflictsWith) {
      setConflictMsg({ mod, label: result.conflictsWith.description });
    } else {
      onSave(item.id, mod);
      setConflictMsg(null);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-card first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground/90">{item.description}</p>
        {conflictMsg && (
          <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle size={12} className="shrink-0" />
            <span>Conflicts with "{conflictMsg.label}" on {item.target}.</span>
            <button className="underline font-medium" onClick={() => { onSave(item.id, conflictMsg.mod); setConflictMsg(null); }}>Save anyway</button>
            <button className="underline" onClick={() => setConflictMsg(null)}>Cancel</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Select value={item.modifier} onValueChange={(v) => handleChange(v as ClickModifier)}>
          <SelectTrigger className="h-8 w-[130px] text-xs" data-testid={`select-clickbind-${item.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ctrl">{clickModifierToLabel("ctrl")}</SelectItem>
            <SelectItem value="alt">{clickModifierToLabel("alt")}</SelectItem>
            <SelectItem value="shift">{clickModifierToLabel("shift")}</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground w-16 shrink-0">Default: {clickModifierToLabel(item.defaultModifier)}</span>
        {item.isOverridden && (
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onReset(item.id)} data-testid={`button-reset-click-${item.id}`}>
            <RotateCcw size={11} className="mr-1" />Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function printCheatSheet(
  registry: { scope: string; description: string; chord: string }[],
  clickRegistry: { target: string; description: string; modifier: ClickModifier }[],
) {
  const groups = SCOPE_ORDER.map(scope => ({
    label: SCOPE_LABELS[scope],
    items: registry.filter(r => r.scope === scope),
  })).filter(g => g.items.length > 0);

  const clickGroups = CLICK_TARGET_ORDER.map(target => ({
    target,
    items: clickRegistry.filter(c => c.target === target),
  })).filter(g => g.items.length > 0);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const sections = groups.map(g => `
    <h2>${esc(g.label)}</h2>
    <table><tbody>
      ${g.items.map(i => `<tr><td>${esc(i.description)}</td><td class="chord">${esc(chordToLabel(i.chord))}</td></tr>`).join("")}
    </tbody></table>
  `).join("");

  const clickSections = clickGroups.map(g => `
    <h2>${esc(g.target)}</h2>
    <table><tbody>
      ${g.items.map(i => `<tr><td>${esc(i.description)}</td><td class="chord">${esc(clickModifierToLabel(i.modifier))}</td></tr>`).join("")}
    </tbody></table>
  `).join("");

  const html = `<!DOCTYPE html><html><head><title>Keyboard Shortcuts — Bradley's Boat Care</title>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; padding: 32px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 20px 0 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 4px 6px; border-bottom: 1px solid #eee; }
    td.chord { text-align: right; font-family: monospace; color: #333; width: 120px; }
  </style></head>
  <body>
    <h1>Keyboard Shortcuts</h1>
    <p style="color:#666;font-size:12px;margin-top:0">Bradley's Boat Care — Marine DMS</p>
    ${sections}
    <h1 style="margin-top:28px">Modifier + Click Actions</h1>
    ${clickSections}
    <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

export default function SettingsKeybindsPage() {
  usePageTitle("Keyboard Shortcuts");
  const { registry, setKeybind, resetKeybind, resetAllKeybinds, checkConflict } = useKeybinds();
  const { clickRegistry, setClickBind, resetClickBind, resetAllClickBinds, checkClickConflict } = useClickBinds();
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [confirmResetAllClicks, setConfirmResetAllClicks] = useState(false);

  const groups = useMemo(() => SCOPE_ORDER.map(scope => ({
    scope,
    label: SCOPE_LABELS[scope],
    items: registry.filter(r => r.scope === scope),
  })).filter(g => g.items.length > 0), [registry]);

  const clickGroups = useMemo(() => CLICK_TARGET_ORDER.map(target => ({
    target,
    items: clickRegistry.filter(c => c.target === target),
  })).filter(g => g.items.length > 0), [clickRegistry]);

  return (
    <div className="max-w-3xl pb-16">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Keyboard size={20} className="text-primary" />Keyboard Shortcuts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Click any shortcut to remap it. All changes save automatically.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printCheatSheet(registry, clickRegistry)} data-testid="button-print-cheatsheet">
          <Printer size={14} />Print cheat sheet
        </Button>
      </div>

      <Tabs defaultValue="keyboard">
        <TabsList>
          <TabsTrigger value="keyboard" className="gap-1.5" data-testid="tab-keyboard">
            <Keyboard size={13} />Keyboard Shortcuts
          </TabsTrigger>
          <TabsTrigger value="click" className="gap-1.5" data-testid="tab-modclick">
            <MousePointerClick size={13} />Modifier + Click
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keyboard" className="space-y-5 mt-4">
          <div className="flex justify-end">
            {confirmResetAll ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Reset all shortcuts to defaults?</span>
                <button className="text-destructive font-semibold hover:underline" onClick={() => { resetAllKeybinds(); setConfirmResetAll(false); }}>Confirm</button>
                <button className="text-muted-foreground hover:underline" onClick={() => setConfirmResetAll(false)}>Cancel</button>
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmResetAll(true)} data-testid="button-reset-all">
                <RotateCcw size={13} className="mr-1.5" />Reset All to Defaults
              </Button>
            )}
          </div>

          {groups.map(group => (
            <div key={group.scope}>
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                {group.items.map(item => (
                  <ShortcutRow key={item.id} item={item} onSave={setKeybind} onReset={resetKeybind} checkConflict={checkConflict} />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="click" className="space-y-5 mt-4">
          <div className="flex justify-end">
            {confirmResetAllClicks ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Reset all click bindings to defaults?</span>
                <button className="text-destructive font-semibold hover:underline" onClick={() => { resetAllClickBinds(); setConfirmResetAllClicks(false); }}>Confirm</button>
                <button className="text-muted-foreground hover:underline" onClick={() => setConfirmResetAllClicks(false)}>Cancel</button>
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmResetAllClicks(true)} data-testid="button-reset-all-clicks">
                <RotateCcw size={13} className="mr-1.5" />Reset All to Defaults
              </Button>
            )}
          </div>

          {clickGroups.map(group => (
            <div key={group.target}>
              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.target}</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                {group.items.map(item => (
                  <ClickBindRow key={item.id} item={item} onSave={setClickBind} onReset={resetClickBind} checkConflict={checkClickConflict} />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
