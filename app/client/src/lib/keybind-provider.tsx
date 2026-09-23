import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  DEFAULT_KEYBINDS, DEFAULT_CLICKBINDS, type KeybindDef, type ClickBindDef,
  type Chord, type ClickModifier, type Scope,
  parseChord, chordStartsWithModifier, eventMatchesStep, normalizeEventKey,
  eventMatchesClickModifier,
} from "./keybinds";

const STORAGE_KEY = "boatsandnotes:keybinds:v1";
import { testPreferences } from "./test-preferences";
const CLICK_STORAGE_KEY = "boatsandnotes:clickbinds:v1";
const SEQUENCE_TIMEOUT_MS = 800;

// ─── localStorage helpers ───────────────────────────────────────────────────────
function readOverrides(): Record<string, string> {
  try {
    const raw = testPreferences.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeOverrides(overrides: Record<string, string>) {
  try {
    testPreferences.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore quota errors */
  }
}
function readClickOverrides(): Record<string, ClickModifier> {
  try {
    const raw = testPreferences.getItem(CLICK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeClickOverrides(overrides: Record<string, ClickModifier>) {
  try {
    testPreferences.setItem(CLICK_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore quota errors */
  }
}

// ─── Conflict detection ─────────────────────────────────────────────────────────
export type ConflictResult =
  | { ok: true }
  | { ok: false; conflictsWith: KeybindDef };

export type ClickConflictResult =
  | { ok: true }
  | { ok: false; conflictsWith: ClickBindDef };

// ─── Context shape ──────────────────────────────────────────────────────────────
type ResolvedKeybind = KeybindDef & { chord: Chord; isOverridden: boolean };
type ResolvedClickbind = ClickBindDef & { modifier: ClickModifier; isOverridden: boolean };

interface KeybindContextValue {
  registry: ResolvedKeybind[];
  clickRegistry: ResolvedClickbind[];
  registerHandler: (id: string, handler: () => void) => () => void;
  registerClickHandler: (id: string, handler: (payload: any) => void) => () => void;
  setKeybind: (id: string, chord: Chord) => ConflictResult;
  resetKeybind: (id: string) => void;
  resetAllKeybinds: () => void;
  setClickBind: (id: string, modifier: ClickModifier) => ClickConflictResult;
  resetClickBind: (id: string) => void;
  resetAllClickBinds: () => void;
  checkConflict: (id: string, chord: Chord) => ConflictResult;
  checkClickConflict: (id: string, modifier: ClickModifier) => ClickConflictResult;
  pendingSequence: string[] | null; // e.g. ["g"] while waiting for the next key
}

const KeybindContext = createContext<KeybindContextValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function KeybindProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => readOverrides());
  const [clickOverrides, setClickOverrides] = useState<Record<string, ClickModifier>>(() => readClickOverrides());
  const [pendingSequence, setPendingSequence] = useState<string[] | null>(null);

  // handlers[id] = Set of active handler fns (only the most-recently mounted one fires,
  // since pages register/unregister on mount — but scope allows multiple concurrently
  // mounted components to each own a distinct id safely).
  const handlersRef = useRef<Map<string, () => void>>(new Map());
  const clickHandlersRef = useRef<Map<string, (payload: any) => void>>(new Map());

  const registry: ResolvedKeybind[] = useMemo(() => {
    return DEFAULT_KEYBINDS.map(def => ({
      ...def,
      chord: overrides[def.id] ?? def.defaultChord,
      isOverridden: def.id in overrides,
    }));
  }, [overrides]);

  const clickRegistry: ResolvedClickbind[] = useMemo(() => {
    return DEFAULT_CLICKBINDS.map(def => ({
      ...def,
      modifier: clickOverrides[def.id] ?? def.defaultModifier,
      isOverridden: def.id in clickOverrides,
    }));
  }, [clickOverrides]);

  const registerHandler = useCallback((id: string, handler: () => void) => {
    handlersRef.current.set(id, handler);
    return () => {
      if (handlersRef.current.get(id) === handler) {
        handlersRef.current.delete(id);
      }
    };
  }, []);

  const registerClickHandler = useCallback((id: string, handler: (payload: any) => void) => {
    clickHandlersRef.current.set(id, handler);
    return () => {
      if (clickHandlersRef.current.get(id) === handler) {
        clickHandlersRef.current.delete(id);
      }
    };
  }, []);

  const checkConflict = useCallback((id: string, chord: Chord): ConflictResult => {
    const target = registry.find(k => k.id === id);
    if (!target) return { ok: true };
    for (const other of registry) {
      if (other.id === id) continue;
      if (other.chord.trim().toLowerCase() !== chord.trim().toLowerCase()) continue;
      // Global chords conflict with everything; same-scope chords conflict with each other.
      if (other.scope === "global" || target.scope === "global" || other.scope === target.scope) {
        return { ok: false, conflictsWith: other };
      }
    }
    return { ok: true };
  }, [registry]);

  const checkClickConflict = useCallback((id: string, modifier: ClickModifier): ClickConflictResult => {
    if (modifier === "off") return { ok: true };
    const target = clickRegistry.find(k => k.id === id);
    if (!target) return { ok: true };
    for (const other of clickRegistry) {
      if (other.id === id) continue;
      if (other.target !== target.target) continue; // conflicts scoped to same target
      if (other.modifier === modifier) {
        return { ok: false, conflictsWith: other };
      }
    }
    return { ok: true };
  }, [clickRegistry]);

  const setKeybind = useCallback((id: string, chord: Chord): ConflictResult => {
    const conflict = checkConflict(id, chord);
    setOverrides(prev => {
      const next = { ...prev, [id]: chord };
      writeOverrides(next);
      return next;
    });
    return conflict;
  }, [checkConflict]);

  const resetKeybind = useCallback((id: string) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      writeOverrides(next);
      return next;
    });
  }, []);

  const resetAllKeybinds = useCallback(() => {
    setOverrides({});
    writeOverrides({});
  }, []);

  const setClickBind = useCallback((id: string, modifier: ClickModifier): ClickConflictResult => {
    const conflict = checkClickConflict(id, modifier);
    setClickOverrides(prev => {
      const next = { ...prev, [id]: modifier };
      writeClickOverrides(next);
      return next;
    });
    return conflict;
  }, [checkClickConflict]);

  const resetClickBind = useCallback((id: string) => {
    setClickOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      writeClickOverrides(next);
      return next;
    });
  }, []);

  const resetAllClickBinds = useCallback(() => {
    setClickOverrides({});
    writeClickOverrides({});
  }, []);

  // ─── Global keydown listener: buffers sequence keys, dispatches matches ──────
  const bufferRef = useRef<{ keys: string[]; timer: ReturnType<typeof setTimeout> | null }>({ keys: [], timer: null });

  useEffect(() => {
    function clearBuffer() {
      if (bufferRef.current.timer) clearTimeout(bufferRef.current.timer);
      bufferRef.current = { keys: [], timer: null };
      setPendingSequence(null);
    }

    function handleKeydown(e: KeyboardEvent) {
      const editable = isEditableTarget(e.target);

      // Try direct (non-sequence) matches first: single key or modifier chord.
      const candidates = registry;

      // If we have a pending leader key buffer, try to complete a sequence.
      if (bufferRef.current.keys.length > 0) {
        const attemptKey = normalizeEventKey(e);
        // ignore pure modifier keypresses while buffering
        if (["control", "meta", "shift", "alt"].includes(attemptKey)) return;
        const seq = [...bufferRef.current.keys, attemptKey];
        const match = candidates.find(k => {
          const parsed = parseChord(k.chord);
          if (parsed.length !== seq.length) return false;
          return parsed.every((step, i) => step.key === seq[i] && !step.ctrl && !step.meta && !step.alt && !step.shift);
        });
        clearBuffer();
        if (match) {
          e.preventDefault();
          handlersRef.current.get(match.id)?.();
          return;
        }
        // No match — fall through and let this keypress be evaluated fresh below.
      }

      // Suppress non-modifier bindings while typing in an editable field.
      for (const def of candidates) {
        const parsed = parseChord(def.chord);
        if (parsed.length === 0) continue;

        if (parsed.length === 1) {
          const step = parsed[0];
          const isModifierChord = step.ctrl || step.meta || step.alt;
          if (editable && !isModifierChord) continue;
          if (eventMatchesStep(e, step)) {
            e.preventDefault();
            handlersRef.current.get(def.id)?.();
            return;
          }
        }
      }

      // No direct match — check if this key starts any leader sequence.
      if (!editable) {
        const attemptKey = normalizeEventKey(e);
        if (["control", "meta", "shift", "alt"].includes(attemptKey)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return; // leader keys are plain keys only

        const startsSequence = candidates.some(k => {
          const parsed = parseChord(k.chord);
          return parsed.length > 1 && parsed[0].key === attemptKey;
        });
        if (startsSequence) {
          e.preventDefault();
          bufferRef.current.keys = [attemptKey];
          setPendingSequence([attemptKey]);
          if (bufferRef.current.timer) clearTimeout(bufferRef.current.timer);
          bufferRef.current.timer = setTimeout(clearBuffer, SEQUENCE_TIMEOUT_MS);
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      if (bufferRef.current.timer) clearTimeout(bufferRef.current.timer);
    };
  }, [registry]);

  const value: KeybindContextValue = {
    registry,
    clickRegistry,
    registerHandler,
    registerClickHandler,
    setKeybind,
    resetKeybind,
    resetAllKeybinds,
    setClickBind,
    resetClickBind,
    resetAllClickBinds,
    checkConflict,
    checkClickConflict,
    pendingSequence,
  };

  return <KeybindContext.Provider value={value}>{children}</KeybindContext.Provider>;
}

function useKeybindContext(): KeybindContextValue {
  const ctx = useContext(KeybindContext);
  if (!ctx) throw new Error("useKeybind must be used within a KeybindProvider");
  return ctx;
}

/** Register a handler for a keybind id. Auto-unregisters on unmount / dep change. */
export function useKeybind(id: string, handler: () => void, deps: React.DependencyList = []) {
  const { registerHandler } = useKeybindContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = () => handlerRef.current();
    return registerHandler(id, stableHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registerHandler, ...deps]);
}

/** Returns the full merged registry (defaults + user overrides) for cheat sheet / settings. */
export function useKeybinds() {
  const { registry, setKeybind, resetKeybind, resetAllKeybinds, checkConflict } = useKeybindContext();
  return { registry, setKeybind, resetKeybind, resetAllKeybinds, checkConflict };
}

/** Returns the full merged click-bind registry for cheat sheet / settings. */
export function useClickBinds() {
  const { clickRegistry, setClickBind, resetClickBind, resetAllClickBinds, checkClickConflict } = useKeybindContext();
  return { clickRegistry, setClickBind, resetClickBind, resetAllClickBinds, checkClickConflict };
}

/** Returns the pending leader-key buffer (e.g. ["g"]) for visual feedback, or null. */
export function usePendingSequence() {
  return useKeybindContext().pendingSequence;
}

/**
 * Register a modifier+click handler. Returns handleClick(event, payload) — call it from
 * your onClick; it returns true if the click was consumed by a modifier binding (so the
 * caller should skip its own default action), or false if the click should proceed normally.
 *
 * Guards: ignores clicks inside <input>/<textarea>/[contenteditable]; requires
 * window.confirm() for click bindings on ids ending in ".delete".
 */
export function useClickBind(id: string, handler: (payload: any) => void, deps: React.DependencyList = []) {
  const { registerClickHandler, clickRegistry } = useKeybindContext();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (payload: any) => handlerRef.current(payload);
    return registerClickHandler(id, stableHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registerClickHandler, ...deps]);

  return useCallback((e: React.MouseEvent, payload?: any): boolean => {
    if (isEditableTarget(e.target as EventTarget)) return false;
    const def = clickRegistry.find(k => k.id === id);
    if (!def || def.modifier === "off") return false;
    if (!eventMatchesClickModifier(e, def.modifier)) return false;

    if (id.endsWith(".delete")) {
      const confirmed = window.confirm(`${def.description}? This cannot be undone.`);
      if (!confirmed) {
        e.preventDefault();
        return true; // consumed — don't fall through to default click action
      }
    }

    e.preventDefault();
    handlerRef.current(payload);
    return true;
  }, [id, clickRegistry]);
}
