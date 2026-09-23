// ─── Keybind engine: types, chord parser, default registry ───────────────────
// This file is schema-only. Handlers are registered per-page/component via
// useKeybind() from keybind-provider.tsx — nothing here calls app code.

export type Chord = string; // "g s", "Shift+P", "Ctrl+K", "d", "?"
export type Scope = "global" | "work-order" | "schedule" | "customer";

export type KeybindDef = {
  id: string; // stable id, e.g. "nav.schedule"
  scope: Scope;
  description: string; // human-readable, shown in cheat sheet + settings
  defaultChord: Chord;
};

export const SCOPE_LABELS: Record<Scope, string> = {
  global: "Global",
  "work-order": "Work Order",
  schedule: "Schedule",
  customer: "Customer",
};

// Order in which scopes are displayed in the cheat sheet + settings page.
export const SCOPE_ORDER: Scope[] = ["global", "work-order", "schedule", "customer"];

// ─── Default registry ─────────────────────────────────────────────────────────
export const DEFAULT_KEYBINDS: KeybindDef[] = [
  // Global
  { id: "search.open", scope: "global", description: "Open global search", defaultChord: "/" },
  { id: "search.open.mod", scope: "global", description: "Open global search", defaultChord: "Ctrl+K" },
  { id: "nav.home", scope: "global", description: "Go to dashboard", defaultChord: "g h" },
  { id: "nav.schedule", scope: "global", description: "Go to schedule", defaultChord: "g s" },
  { id: "nav.workOrders", scope: "global", description: "Go to work orders", defaultChord: "g w" },
  { id: "nav.customers", scope: "global", description: "Go to customers", defaultChord: "g c" },
  { id: "nav.parts", scope: "global", description: "Go to parts", defaultChord: "g p" },
  { id: "nav.activity", scope: "global", description: "Go to activity", defaultChord: "g a" },
  { id: "nav.templates", scope: "global", description: "Go to templates", defaultChord: "g t" },
  { id: "nav.settings", scope: "global", description: "Go to settings/keybinds", defaultChord: "g ," },
  { id: "new.workOrder", scope: "global", description: "New work order", defaultChord: "n w" },
  { id: "new.customer", scope: "global", description: "New customer", defaultChord: "n c" },
  { id: "new.schedule", scope: "global", description: "New scheduled event", defaultChord: "n s" },
  { id: "help.cheatSheet", scope: "global", description: "Open the cheat sheet", defaultChord: "?" },
  { id: "dialog.close", scope: "global", description: "Close current dialog / modal / lightbox", defaultChord: "Escape" },

  // Work order detail
  { id: "wo.duplicate", scope: "work-order", description: "Duplicate this work order", defaultChord: "d" },
  { id: "wo.print", scope: "work-order", description: "Print this work order", defaultChord: "p" },
  { id: "wo.pdf", scope: "work-order", description: "Download PDF", defaultChord: "Shift+P" },
  { id: "wo.signature", scope: "work-order", description: "Focus signature pad", defaultChord: "s" },
  { id: "wo.job.next", scope: "work-order", description: "Focus next job", defaultChord: "j" },
  { id: "wo.job.prev", scope: "work-order", description: "Focus previous job", defaultChord: "k" },
  { id: "wo.job.new", scope: "work-order", description: "Add new job line", defaultChord: "+" },
  { id: "wo.job.setOpen", scope: "work-order", description: "Set current job status to open", defaultChord: "1" },
  { id: "wo.job.setInProgress", scope: "work-order", description: "Set current job status to in progress", defaultChord: "2" },
  { id: "wo.job.setComplete", scope: "work-order", description: "Set current job status to complete", defaultChord: "3" },
  { id: "wo.save", scope: "work-order", description: "Force save", defaultChord: "Ctrl+S" },

  // Schedule page
  { id: "sched.new", scope: "schedule", description: "New scheduled event", defaultChord: "n" },
  { id: "sched.prevWeek", scope: "schedule", description: "Previous week", defaultChord: "ArrowLeft" },
  { id: "sched.nextWeek", scope: "schedule", description: "Next week", defaultChord: "ArrowRight" },
  { id: "sched.today", scope: "schedule", description: "Jump to this week", defaultChord: "t" },
  { id: "sched.open", scope: "schedule", description: "Open selected card", defaultChord: "Enter" },
  { id: "sched.delete", scope: "schedule", description: "Delete selected card", defaultChord: "Delete" },

  // Customer detail
  { id: "cust.newWO", scope: "customer", description: "New work order for this customer", defaultChord: "n" },
  { id: "cust.newBoat", scope: "customer", description: "New boat for this customer", defaultChord: "b" },
  { id: "cust.historyToggle", scope: "customer", description: "Expand/collapse service history", defaultChord: "h" },
  { id: "cust.copyInfo", scope: "customer", description: "Copy customer contact info to clipboard", defaultChord: "c" },
];

// ─── Chord parsing ─────────────────────────────────────────────────────────────
export type ParsedKeyStep = {
  key: string; // normalized lowercase key, e.g. "k", "arrowleft", "escape", "?"
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
};

export type ParsedChord = ParsedKeyStep[]; // sequence of 1 (single/modifier) or 2+ (leader) steps

const MODIFIER_TOKENS = new Set(["ctrl", "control", "cmd", "meta", "shift", "alt", "option"]);

/** Parse a single space-free token like "Shift+P", "Ctrl+K", "d", "?" into a ParsedKeyStep. */
function parseToken(token: string): ParsedKeyStep {
  const parts = token.split("+").map(p => p.trim()).filter(Boolean);
  let ctrl = false, meta = false, shift = false, alt = false;
  let key = "";
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") ctrl = true;
    else if (lower === "cmd" || lower === "meta") meta = true;
    else if (lower === "shift") shift = true;
    else if (lower === "alt" || lower === "option") alt = true;
    else key = lower; // last non-modifier token wins as the key
  }
  return { key, ctrl, meta, shift, alt };
}

/** Parse a chord string ("g s", "Shift+P", "Ctrl+K", "d", "?") into a sequence of steps. */
export function parseChord(chord: Chord): ParsedChord {
  return chord
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseToken);
}

/** True if this chord requires at least one modifier on its first step (fires even while typing). */
export function chordStartsWithModifier(chord: Chord): boolean {
  const parsed = parseChord(chord);
  if (parsed.length === 0) return false;
  const first = parsed[0];
  return first.ctrl || first.meta || first.alt;
}

/** True if this is a multi-step leader sequence like "g s". */
export function isSequenceChord(chord: Chord): boolean {
  return parseChord(chord).length > 1;
}

// ─── Platform detection + labels ───────────────────────────────────────────────
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") || /Mac/.test((navigator as any).userAgentData?.platform ?? "");
}

const KEY_DISPLAY: Record<string, string> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  escape: "Esc",
  enter: "↵",
  delete: "Del",
  " ": "Space",
  ",": ",",
};

function displayKey(key: string): string {
  if (KEY_DISPLAY[key]) return KEY_DISPLAY[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Render a chord for display, e.g. "g s" -> "g then s", "Ctrl+K" -> "⌃K" (mac: "⌘K"). */
export function chordToLabel(chord: Chord): string {
  const parsed = parseChord(chord);
  if (parsed.length === 0) return chord;
  if (parsed.length > 1) {
    return parsed.map(step => displayKey(step.key)).join(" then ");
  }
  const step = parsed[0];
  const mac = isMac();
  const bits: string[] = [];
  if (step.ctrl) bits.push(mac ? "⌃" : "Ctrl+");
  if (step.meta) bits.push(mac ? "⌘" : "Cmd+");
  if (step.alt) bits.push(mac ? "⌥" : "Alt+");
  if (step.shift) bits.push(mac ? "⇧" : "Shift+");
  bits.push(displayKey(step.key));
  return bits.join("");
}

/** True if a given KeyboardEvent matches a single ParsedKeyStep (ignores meta/ctrl cross-platform equivalence rules for mod chords). */
export function eventMatchesStep(e: KeyboardEvent, step: ParsedKeyStep): boolean {
  const eventKey = normalizeEventKey(e);
  if (eventKey !== step.key) return false;

  // "Ctrl+K" should also match "Cmd+K" on Mac and vice versa, since many users
  // hit whichever modifier is muscle memory. We treat ctrl/meta as interchangeable
  // whenever exactly one of them is required.
  const wantsCtrlOrMeta = step.ctrl || step.meta;
  const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
  if (wantsCtrlOrMeta !== hasCtrlOrMeta) return false;

  if (step.shift !== e.shiftKey) return false;
  if (step.alt !== e.altKey) return false;
  return true;
}

/** Normalize a KeyboardEvent's key into the same lowercase space used by parseToken. */
export function normalizeEventKey(e: KeyboardEvent): string {
  const k = e.key;
  if (k === " ") return " ";
  return k.toLowerCase();
}

// ─── Modifier + Click bindings (addendum) ──────────────────────────────────────
// A parallel, independent category from keyboard chords. Registered the same
// way (schema here, handlers registered at runtime via useClickBind).

export type ClickModifier = "none" | "ctrl" | "alt" | "shift" | "off";
// note: "ctrl" auto-maps to Cmd on Mac; check event.metaKey || event.ctrlKey

export type ClickBindDef = {
  id: string; // e.g. "wo.card.duplicate"
  scope: Scope;
  target: string; // human label of where this fires: "Work Order card", "Schedule event", etc.
  description: string; // "Duplicate WO"
  defaultModifier: ClickModifier;
};

export const CLICK_STORAGE_KEY = "boatsandnotes:clickbinds:v1";

/** Human label for a ClickModifier, e.g. "ctrl" -> "⌘Click" on Mac, "Ctrl+Click" elsewhere. */
export function clickModifierToLabel(mod: ClickModifier): string {
  if (mod === "off") return "Off";
  if (mod === "none") return "Click";
  const mac = isMac();
  if (mod === "ctrl") return mac ? "⌘Click" : "Ctrl+Click";
  if (mod === "alt") return mac ? "⌥Click" : "Alt+Click";
  if (mod === "shift") return "Shift+Click";
  return mod;
}

/** True if a MouseEvent matches the given ClickModifier ("ctrl" matches either Ctrl or Cmd). */
export function eventMatchesClickModifier(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, mod: ClickModifier): boolean {
  if (mod === "off") return false;
  if (mod === "none") return !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
  if (mod === "ctrl") return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
  if (mod === "alt") return e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
  if (mod === "shift") return e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
  return false;
}

// Default click bindings, grouped by target for readability.
export const DEFAULT_CLICKBINDS: ClickBindDef[] = [
  // Work Order board card
  { id: "wo.card.newTab", scope: "work-order", target: "Work Order card", description: "Open in new tab", defaultModifier: "ctrl" },
  { id: "wo.card.duplicate", scope: "work-order", target: "Work Order card", description: "Duplicate work order", defaultModifier: "alt" },
  { id: "wo.card.multiSelect", scope: "work-order", target: "Work Order card", description: "Multi-select (coming soon)", defaultModifier: "shift" },

  // Customer list card
  { id: "cust.card.newTab", scope: "customer", target: "Customer card", description: "Open in new tab", defaultModifier: "ctrl" },
  { id: "cust.card.quickCopy", scope: "customer", target: "Customer card", description: "Copy name, phone & email", defaultModifier: "alt" },

  // Schedule event card
  { id: "sched.card.newTab", scope: "schedule", target: "Schedule event", description: "Open underlying WO/customer in new tab", defaultModifier: "ctrl" },
  { id: "sched.card.duplicate", scope: "schedule", target: "Schedule event", description: "Duplicate to next week", defaultModifier: "alt" },
  { id: "sched.card.markDone", scope: "schedule", target: "Schedule event", description: "Mark done", defaultModifier: "shift" },

  // Photo grid item
  { id: "photo.newTab", scope: "global", target: "Photo", description: "Open image in new tab", defaultModifier: "ctrl" },
  { id: "photo.delete", scope: "global", target: "Photo", description: "Delete photo", defaultModifier: "alt" },

  // WO detail line items (job/part)
  { id: "wo.line.duplicate", scope: "work-order", target: "Job/Part line item", description: "Duplicate line item", defaultModifier: "ctrl" },
  { id: "wo.line.delete", scope: "work-order", target: "Job/Part line item", description: "Delete line item", defaultModifier: "alt" },
];

export const CLICK_TARGET_ORDER: string[] = [
  "Work Order card",
  "Customer card",
  "Schedule event",
  "Photo",
  "Job/Part line item",
];
