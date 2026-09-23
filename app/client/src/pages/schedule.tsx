import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Calendar as CalendarIcon,
  Package as DropOffIcon, CheckCircle2, MoreHorizontal,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/Skeleton";
import type { Customer, Boat } from "@shared/schema";
import { useKeybind, useClickBind } from "@/lib/keybind-provider";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Types ───────────────────────────────────────────────────────────────────
type EventType = "drop_off" | "pickup" | "other";
type TimeSlot = "am" | "pm";
type EventStatus = "scheduled" | "done" | "cancelled";

interface ScheduledEvent {
  id: number;
  eventType: EventType;
  scheduledDate: string;
  timeSlot: TimeSlot;
  customerId: number | null;
  boatId: number | null;
  serviceRecordId: number | null;
  title: string;
  notes: string | null;
  status: EventStatus;
  sortOrder: number;
  customerName: string | null;
  boatMake: string | null;
}

interface WODueEvent {
  id: number;
  dueDate: string;
  description: string;
  status: string;
  boatId: number;
  boatMake: string | null;
  boatModel: string | null;
  boatYear: number | null;
  customerName: string | null;
}

// ─── Week math (plain Date, no libraries) ───────────────────────────────────
function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // move back to Monday
  const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0, 0, 0, 0);
  return m;
}
function fmtISO(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Colors ──────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  drop_off: "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-100",
  pickup: "bg-green-100 border-green-400 text-green-900 dark:bg-green-950 dark:border-green-700 dark:text-green-100",
  other: "bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100",
  work_order_due: "bg-orange-100 border-orange-400 text-orange-900 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-100",
};
const TYPE_DOT: Record<string, string> = {
  drop_off: "bg-blue-500",
  pickup: "bg-green-500",
  other: "bg-gray-500",
  work_order_due: "bg-orange-500",
};
const TYPE_LABELS: Record<EventType, string> = { drop_off: "Drop-off", pickup: "Pickup", other: "Other" };

// ─── Context menu (right-click / long-press) ────────────────────────────────
function EventContextMenu({
  x, y, onClose, event, onEdit, onChangeDay, onChangeSlot, onChangeType,
  onChangeCustomer, onChangeBoat, onMarkDone, onDelete,
}: {
  x: number; y: number; onClose: () => void; event: ScheduledEvent;
  onEdit: () => void; onChangeDay: () => void; onChangeSlot: () => void; onChangeType: () => void;
  onChangeCustomer: () => void; onChangeBoat: () => void; onMarkDone: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const hKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", hClick);
    document.addEventListener("keydown", hKey);
    return () => { document.removeEventListener("mousedown", hClick); document.removeEventListener("keydown", hKey); };
  }, [onClose]);

  // Keep menu on-screen
  const style = useMemo(() => {
    const menuW = 220, menuH = 320;
    const left = Math.min(x, window.innerWidth - menuW - 8);
    const top = Math.min(y, window.innerHeight - menuH - 8);
    return { position: "fixed" as const, top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999 };
  }, [x, y]);

  const MI = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-md transition-colors ${
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent"
      }`}
      onClick={() => { onClick(); onClose(); }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div ref={ref} style={style} className="min-w-[210px] bg-popover border border-border rounded-lg shadow-lg p-1" data-testid="event-context-menu">
      <MI icon={<span className="w-3.5" />} label="Edit title" onClick={onEdit} />
      <MI icon={<span className="w-3.5" />} label="Change day" onClick={onChangeDay} />
      <MI icon={<span className="w-3.5" />} label="Change AM/PM" onClick={onChangeSlot} />
      <MI icon={<span className="w-3.5" />} label="Change type" onClick={onChangeType} />
      <MI icon={<span className="w-3.5" />} label="Change customer" onClick={onChangeCustomer} />
      <MI icon={<span className="w-3.5" />} label="Change boat" onClick={onChangeBoat} />
      <div className="my-1 border-t border-border" />
      <MI icon={<CheckCircle2 size={14} />} label={event.status === "done" ? "Mark not done" : "Mark done"} onClick={onMarkDone} />
      <MI icon={<Trash2 size={14} />} label="Delete" onClick={onDelete} danger />
    </div>
  );
}

// ─── New / Edit Event Dialog ─────────────────────────────────────────────────
function EventFormDialog({
  open, onClose, initialDate, initialSlot, event, onSaved,
}: {
  open: boolean; onClose: () => void; initialDate: string; initialSlot: TimeSlot;
  event?: ScheduledEvent | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!event;
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<TimeSlot>(initialSlot);
  const [type, setType] = useState<EventType>("drop_off");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [boatId, setBoatId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(event?.scheduledDate ?? initialDate);
      setSlot(event?.timeSlot ?? initialSlot);
      setType(event?.eventType ?? "drop_off");
      setTitle(event?.title ?? "");
      setNotes(event?.notes ?? "");
      setCustomerId(event?.customerId ?? null);
      setBoatId(event?.boatId ?? null);
      setCustomerQuery("");
      setCustomerPickerOpen(false);
    }
  }, [open, event, initialDate, initialSlot]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers").then(r => r.json()),
    enabled: open,
  });
  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ["/api/customers", customerId, "boats"],
    queryFn: () => customerId ? apiRequest("GET", `/api/customers/${customerId}/boats`).then(r => r.json()) : Promise.resolve([]),
    enabled: open && !!customerId,
  });

  const selectedCustomer = customers.find(c => c.id === customerId) ?? null;
  const filteredCustomers = customerQuery.trim() === ""
    ? customers
    : customers.filter(c => c.name.toLowerCase().includes(customerQuery.toLowerCase()));

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        eventType: type, scheduledDate: date, timeSlot: slot,
        title: title.trim(), notes: notes.trim() || null,
        customerId, boatId,
      };
      return isEdit
        ? apiRequest("PATCH", `/api/schedule/${event!.id}`, body).then(r => r.json())
        : apiRequest("POST", "/api/schedule", body).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: isEdit ? "Event updated" : "Event scheduled" });
      onSaved();
      onClose();
    },
    onError: (err: any) => toast({ title: err?.message ?? "Failed to save event", variant: "destructive" }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">{isEdit ? "Edit Event" : "New Event"}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Date</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Time</label>
              <div className="flex rounded-md border border-input overflow-hidden h-9">
                {(["am", "pm"] as TimeSlot[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`flex-1 text-sm font-medium uppercase transition-colors ${slot === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Type</label>
            <div className="flex rounded-md border border-input overflow-hidden h-9">
              {(["drop_off", "pickup", "other"] as EventType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs font-medium transition-colors ${type === t ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Winterization drop-off" className="h-9 text-sm" />
          </div>

          <div className="relative">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Customer (optional)</label>
            <Input
              value={customerPickerOpen ? customerQuery : (selectedCustomer?.name ?? "")}
              onFocus={() => { setCustomerPickerOpen(true); setCustomerQuery(""); }}
              onChange={e => { setCustomerQuery(e.target.value); setCustomerPickerOpen(true); }}
              onBlur={() => setTimeout(() => setCustomerPickerOpen(false), 150)}
              placeholder="Search customers..."
              className="h-9 text-sm"
            />
            {customerPickerOpen && (
              <div className="absolute z-[200] mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                <button
                  onPointerDown={e => { e.preventDefault(); setCustomerId(null); setBoatId(null); setCustomerQuery(""); setCustomerPickerOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-muted-foreground italic"
                >
                  No customer
                </button>
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onPointerDown={e => { e.preventDefault(); setCustomerId(c.id); setBoatId(null); setCustomerQuery(""); setCustomerPickerOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${c.id === customerId ? "bg-primary/10 text-primary font-medium" : ""}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {customerId && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Boat (optional)</label>
              {boats.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No boats on file for this customer</p>
              ) : (
                <select
                  value={boatId ?? ""}
                  onChange={e => setBoatId(Number(e.target.value) || null)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— No boat —</option>
                  {boats.map(b => (
                    <option key={b.id} value={b.id}>{[b.year, b.make, b.model].filter(Boolean).join(" ")}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending}
            className="w-full h-9"
          >
            <Check size={14} className="mr-1.5" />
            {saveMutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Event"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Event card ──────────────────────────────────────────────────────────────
function EventCard({
  ev, saving, onDragStart, onContextMenu, onClick, onDuplicate, onMarkDone,
}: {
  ev: ScheduledEvent; saving?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onDuplicate?: (ev: ScheduledEvent) => void;
  onMarkDone?: (ev: ScheduledEvent) => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      onContextMenu?.({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY } as any);
    }, 600);
  };
  const clearLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const isCancelled = ev.status === "cancelled";
  const isDone = ev.status === "done";

  // Modifier+Click (Batch 2.5 addendum): Ctrl+Click opens the linked WO in a new tab,
  // Alt+Click duplicates the event (+7 days), Shift+Click toggles done.
  const handleNewTabClick = useClickBind("sched.card.newTab", (e: ScheduledEvent) => {
    if (e.serviceRecordId) window.open(`${window.location.pathname}#/jobs/${e.serviceRecordId}`, "_blank");
  });
  const handleDuplicateClick = useClickBind("sched.card.duplicate", (e: ScheduledEvent) => onDuplicate?.(e));
  const handleMarkDoneClick = useClickBind("sched.card.markDone", (e: ScheduledEvent) => onMarkDone?.(e));

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onClick={(e) => {
        if (handleNewTabClick(e, ev)) return;
        if (handleDuplicateClick(e, ev)) return;
        if (handleMarkDoneClick(e, ev)) return;
        onClick?.();
      }}
      className={`group relative rounded-md border px-2 py-1.5 text-xs cursor-pointer select-none transition-opacity ${TYPE_COLORS[ev.eventType]} ${
        isCancelled ? "opacity-50" : isDone ? "opacity-70" : ""
      } ${saving ? "animate-pulse" : ""}`}
      data-testid={`event-card-${ev.id}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[ev.eventType]}`} />
        <span className={`font-medium truncate ${isCancelled ? "line-through" : ""}`}>{ev.title}</span>
        {isDone && <Check size={11} className="ml-auto shrink-0" />}
      </div>
      {ev.customerName && <p className="truncate opacity-80 mt-0.5">{ev.customerName}</p>}
      {saving && <p className="text-[10px] italic opacity-70">saving...</p>}
    </div>
  );
}

function WODueCard({ ev, onClick }: { ev: WODueEvent; onClick: () => void }) {
  const boatLabel = [ev.boatYear, ev.boatMake, ev.boatModel].filter(Boolean).join(" ");
  return (
    <div
      onClick={onClick}
      className={`rounded-md border px-2 py-1.5 text-xs cursor-pointer ${TYPE_COLORS.work_order_due}`}
      data-testid={`wo-due-card-${ev.id}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT.work_order_due}`} />
        <span className="font-medium truncate">WO-{String(ev.id).padStart(4, "0")} due</span>
      </div>
      <p className="truncate opacity-80 mt-0.5">{ev.customerName ?? (boatLabel || "—")}</p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SchedulePage() {
  usePageTitle("Schedule");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(fmtISO(new Date()));
  const [formSlot, setFormSlot] = useState<TimeSlot>("am");
  const [editingEvent, setEditingEvent] = useState<ScheduledEvent | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: ScheduledEvent } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const rangeStart = fmtISO(weekDays[0]);
  const rangeEnd = fmtISO(weekDays[6]);
  const todayISO = fmtISO(new Date());

  const { data: events = [], isLoading } = useQuery<ScheduledEvent[]>({
    queryKey: ["/api/schedule", rangeStart, rangeEnd],
    queryFn: () => apiRequest("GET", `/api/schedule?start=${rangeStart}&end=${rangeEnd}`).then(r => r.json()),
  });
  const { data: woDue = [] } = useQuery<WODueEvent[]>({
    queryKey: ["/api/schedule/work-orders", rangeStart, rangeEnd],
    queryFn: () => apiRequest("GET", `/api/schedule/work-orders?start=${rangeStart}&end=${rangeEnd}`).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/schedule/${id}`, data).then(r => r.json()),
    onMutate: ({ id }) => setSavingIds(prev => new Set(prev).add(id)),
    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    },
    onError: (err: any, { id }) => {
      setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast({ title: err?.message ?? "Failed to update event", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/schedule/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Event deleted" });
    },
    onError: (err: any) => toast({ title: err?.message ?? "Failed to delete event", variant: "destructive" }),
  });

  const eventsBySlot = useMemo(() => {
    const map = new Map<string, ScheduledEvent[]>();
    for (const ev of events) {
      const key = `${ev.scheduledDate}|${ev.timeSlot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const woDueByDate = useMemo(() => {
    const map = new Map<string, WODueEvent[]>();
    for (const w of woDue) {
      if (!map.has(w.dueDate)) map.set(w.dueDate, []);
      map.get(w.dueDate)!.push(w);
    }
    return map;
  }, [woDue]);

  const openNewEvent = (date: string, slot: TimeSlot) => {
    setEditingEvent(null);
    setFormDate(date);
    setFormSlot(slot);
    setFormOpen(true);
  };

  const handleDrop = (e: React.DragEvent, date: string, slot: TimeSlot) => {
    e.preventDefault();
    setDragOverSlot(null);
    const idStr = e.dataTransfer.getData("text/plain");
    const id = Number(idStr);
    if (!id) return;
    const ev = events.find(x => x.id === id);
    if (!ev || (ev.scheduledDate === date && ev.timeSlot === slot)) return;
    updateMutation.mutate({ id, data: { scheduledDate: date, timeSlot: slot } });
  };

  const jumpToDate = (val: string) => {
    if (!val) return;
    const d = new Date(val + "T00:00:00");
    if (isNaN(d.getTime())) return;
    setWeekStart(startOfWeek(d));
  };

  const duplicateEvent = (ev: ScheduledEvent) => {
    const newDate = fmtISO(addDays(new Date(ev.scheduledDate + "T00:00:00"), 7));
    apiRequest("POST", "/api/schedule", {
      eventType: ev.eventType,
      scheduledDate: newDate,
      timeSlot: ev.timeSlot,
      title: ev.title,
      notes: ev.notes,
      customerId: ev.customerId,
      boatId: ev.boatId,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Event duplicated to next week" });
    }).catch((e: any) => toast({ title: e?.message ?? "Failed to duplicate event", variant: "destructive" }));
  };

  const toggleMarkDone = (ev: ScheduledEvent) => {
    updateMutation.mutate({ id: ev.id, data: { status: ev.status === "done" ? "scheduled" : "done" } });
  };

  // Batch 2.5 minimal addition: support a ?new=1 URL flag so the global "n s" keybind
  // can deep-link into the new-event dialog from any page.
  useEffect(() => {
    if (window.location.hash.includes("new=1")) {
      openNewEvent(todayISO, "am");
      const clean = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Keybinds (Batch 2.5): sched.* scope ───
  useKeybind("sched.new", () => openNewEvent(todayISO, "am"), [todayISO]);
  useKeybind("sched.prevWeek", () => setWeekStart(w => addDays(w, -7)), []);
  useKeybind("sched.nextWeek", () => setWeekStart(w => addDays(w, 7)), []);
  useKeybind("sched.today", () => setWeekStart(startOfWeek(new Date())), []);
  // TODO(Batch 2.5 scope note, per brief): sched.open / sched.delete require card-level focus
  // management (tracking a "selected" event via arrow keys) that doesn't exist yet on this page.
  // Per the brief's explicit scope-reduction allowance, these ship as toast placeholders for now.
  useKeybind("sched.open", () => toast({ title: "Select a card first", description: "Card focus navigation isn't wired yet — click an event to open it." }), []);
  useKeybind("sched.delete", () => toast({ title: "Select a card first", description: "Card focus navigation isn't wired yet — use the right-click menu to delete." }), []);

  return (
    <div className="pb-24 lg:pb-6">
      {/* Header + week nav */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-muted-foreground" />
          <h1 className="text-lg font-bold">Schedule</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setWeekStart(w => addDays(w, -7))}>
            <ChevronLeft size={14} />Prev
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This Week
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setWeekStart(w => addDays(w, 7))}>
            Next<ChevronRight size={14} />
          </Button>
          <Input
            type="date"
            className="h-8 text-sm w-[150px]"
            onChange={e => jumpToDate(e.target.value)}
            data-testid="input-jump-to-week"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>

      {/* Week grid: 7 cols desktop, horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="grid grid-cols-7 gap-2 min-w-[820px] lg:min-w-0">
          {weekDays.map(day => {
            const iso = fmtISO(day);
            const isToday = iso === todayISO;
            const dueForDay = woDueByDate.get(iso) ?? [];
            return (
              <div key={iso} className={`rounded-lg border ${isToday ? "border-primary" : "border-border"} bg-card flex flex-col`}>
                <div className={`px-2 py-1.5 text-center border-b ${isToday ? "bg-primary/10 border-primary/30" : "border-border"}`}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{DAY_LABELS[weekDays.indexOf(day)]}</p>
                  <p className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>{day.getDate()}</p>
                </div>

                {(["am", "pm"] as TimeSlot[]).map(slot => {
                  const key = `${iso}|${slot}`;
                  const slotEvents = eventsBySlot.get(key) ?? [];
                  const isDragOver = dragOverSlot === key;
                  return (
                    <div
                      key={slot}
                      onDragOver={e => { e.preventDefault(); setDragOverSlot(key); }}
                      onDragLeave={() => setDragOverSlot(prev => (prev === key ? null : prev))}
                      onDrop={e => handleDrop(e, iso, slot)}
                      className={`flex-1 min-h-[92px] p-1.5 space-y-1 border-b last:border-b-0 border-border/60 transition-colors ${
                        isDragOver ? "bg-primary/5" : ""
                      }`}
                    >
                      <p className="text-[9px] font-semibold text-muted-foreground/70 uppercase px-0.5">{slot}</p>

                      {slot === "am" && dueForDay.map(w => (
                        <WODueCard key={`wo-${w.id}`} ev={w} onClick={() => navigate(`/jobs/${w.id}`)} />
                      ))}

                      {slotEvents.map(ev => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          saving={savingIds.has(ev.id)}
                          onDragStart={e => e.dataTransfer.setData("text/plain", String(ev.id))}
                          onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, event: ev }); }}
                          onClick={() => { setEditingEvent(ev); setFormDate(ev.scheduledDate); setFormSlot(ev.timeSlot); setFormOpen(true); }}
                          onDuplicate={duplicateEvent}
                          onMarkDone={toggleMarkDone}
                        />
                      ))}

                      {slotEvents.length === 0 && dueForDay.length === 0 && (
                        <button
                          onClick={() => openNewEvent(iso, slot)}
                          className="w-full h-full min-h-[36px] flex items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground/40 hover:text-muted-foreground hover:border-border transition-colors"
                          data-testid={`button-add-event-${iso}-${slot}`}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2 mt-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      )}

      {/* Floating + button */}
      <button
        onClick={() => openNewEvent(todayISO, "am")}
        className="fixed bottom-20 lg:bottom-6 right-5 lg:right-8 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="New event"
        data-testid="button-new-event"
      >
        <Plus size={24} />
      </button>

      {/* New/Edit dialog */}
      <EventFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialDate={formDate}
        initialSlot={formSlot}
        event={editingEvent}
        onSaved={() => {}}
      />

      {/* Context menu */}
      {contextMenu && (
        <EventContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          event={contextMenu.event}
          onClose={() => setContextMenu(null)}
          onEdit={() => { setEditingEvent(contextMenu.event); setFormDate(contextMenu.event.scheduledDate); setFormSlot(contextMenu.event.timeSlot); setFormOpen(true); }}
          onChangeDay={() => { setEditingEvent(contextMenu.event); setFormDate(contextMenu.event.scheduledDate); setFormSlot(contextMenu.event.timeSlot); setFormOpen(true); }}
          onChangeSlot={() => updateMutation.mutate({ id: contextMenu.event.id, data: { timeSlot: contextMenu.event.timeSlot === "am" ? "pm" : "am" } })}
          onChangeType={() => {
            const order: EventType[] = ["drop_off", "pickup", "other"];
            const next = order[(order.indexOf(contextMenu.event.eventType) + 1) % order.length];
            updateMutation.mutate({ id: contextMenu.event.id, data: { eventType: next } });
          }}
          onChangeCustomer={() => { setEditingEvent(contextMenu.event); setFormDate(contextMenu.event.scheduledDate); setFormSlot(contextMenu.event.timeSlot); setFormOpen(true); }}
          onChangeBoat={() => { setEditingEvent(contextMenu.event); setFormDate(contextMenu.event.scheduledDate); setFormSlot(contextMenu.event.timeSlot); setFormOpen(true); }}
          onMarkDone={() => updateMutation.mutate({ id: contextMenu.event.id, data: { status: contextMenu.event.status === "done" ? "scheduled" : "done" } })}
          onDelete={() => deleteMutation.mutate(contextMenu.event.id)}
        />
      )}
    </div>
  );
}
