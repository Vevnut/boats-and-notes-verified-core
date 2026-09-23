import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ClipboardList, Truck, CheckCircle2, FileText, CircleDot,
  ChevronRight, Plus, CalendarDays, Activity as ActivityIcon,
  DollarSign, AlertTriangle, Wrench,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useState } from "react";
import type { Customer, Boat } from "@shared/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────
type DashStats = {
  statusCounts: Record<string, number>;
  totalOpen: number;
  laborHoursSold: number;
  laborRevenue: number;
  openEstimates: number;
  lowStockParts: number;
  recentActivity: Array<{ id: number; timestamp: string; action: string; entityType: string; description: string }>;
};

type OpenJob = {
  id: number; status: string; description: string; date: string;
  customerName: string; boatMake: string; boatModel: string; boatYear: number | null;
};

type ScheduledEvent = {
  id: number; eventType: string; scheduledDate: string; timeSlot: string;
  title: string; status: string; customerName: string | null; boatMake: string | null;
};

type ActivityItem = { id: number; timestamp: string; action: string; entityType: string; entityId: number | null; description: string };

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open:             { label: "Open",             color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20   border-blue-200 dark:border-blue-800",     icon: CircleDot },
  waiting_on_parts: { label: "Waiting on Parts", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800", icon: Truck },
  ready_for_pickup: { label: "Ready for Pickup", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800", icon: CheckCircle2 },
  complete:         { label: "Complete",         color: "text-green-700 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-900/20  border-green-200 dark:border-green-800",   icon: CheckCircle2 },
  invoiced:         { label: "Invoiced",         color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20  border-amber-200 dark:border-amber-800",   icon: FileText },
};
const PRIORITY_ORDER = ["waiting_on_parts", "ready_for_pickup", "open", "complete", "invoiced"];

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function toLocalDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function relTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Quick Create Modal ───────────────────────────────────────────────────────
function QuickWorkOrderModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [boatId, setBoatId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiRequest("GET", "/api/customers").then(r => r.json()),
  });
  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ["/api/customers", customerId, "boats"],
    queryFn: () => customerId
      ? apiRequest("GET", `/api/customers/${customerId}/boats`).then(r => r.json())
      : Promise.resolve([]),
    enabled: !!customerId,
  });

  const filtered = query.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : customers;
  const selected = customers.find(c => c.id === customerId);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!boatId || !description.trim()) throw new Error("Fill in all fields");
      return apiRequest("POST", `/api/boats/${boatId}/service`, {
        date, description: description.trim(), status: "open", laborRate: 110,
      }).then(r => r.json());
    },
    onSuccess: (wo) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Work order created" });
      onClose();
      navigate(`/jobs/${wo.id}`);
    },
    onError: (e: any) => toast({ title: e.message ?? "Failed", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold">New Work Order</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Customer *</label>
            {selected ? (
              <div className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm">
                <span className="font-medium">{selected.name}</span>
                <button onClick={() => { setCustomerId(null); setBoatId(null); setQuery(""); }} className="text-muted-foreground hover:text-foreground text-xs">change</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Type customer name..." autoFocus
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {query.length >= 1 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filtered.length === 0
                      ? <p className="px-3 py-2 text-xs text-muted-foreground italic">No match</p>
                      : filtered.slice(0, 6).map(c => (
                        <button key={c.id} onMouseDown={() => { setCustomerId(c.id); setQuery(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">{c.name}</button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
          {customerId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Boat *</label>
              {boats.length === 0
                ? <p className="text-xs text-muted-foreground italic">No boats on file for this customer</p>
                : (
                  <select value={boatId ?? ""} onChange={e => setBoatId(Number(e.target.value) || null)}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— Select boat —</option>
                    {boats.map(b => <option key={b.id} value={b.id}>{[b.year, b.make, b.model].filter(Boolean).join(" ")}</option>)}
                  </select>
                )
              }
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Work Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the work to be performed..." rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!boatId || !description.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, onClick }: { label: string; value: string | number; icon: any; color: string; onClick?: () => void }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`flex flex-col gap-2 bg-card border border-border rounded-xl px-4 py-3.5 text-left ${onClick ? "hover:border-primary/40 transition-colors cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon size={14} className={color} />
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </Wrapper>
  );
}

// ─── Job Row ──────────────────────────────────────────────────────────────────
function JobRow({ job }: { job: OpenJob }) {
  const [, navigate] = useLocation();
  const cfg = STATUS_CONFIG[job.status];
  return (
    <button
      onClick={() => navigate(`/jobs/${job.id}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors text-left"
    >
      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap w-16 shrink-0">
        WO-{String(job.id).padStart(4, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.customerName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ")}
        </p>
      </div>
      {cfg && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      )}
    </button>
  );
}

// ─── Activity Row ──────────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 border-b border-border last:border-b-0">
      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{item.description}</p>
        <p className="text-[11px] text-muted-foreground">{relTime(item.timestamp)}</p>
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  usePageTitle("Dashboard");
  const [, navigate] = useLocation();
  const [quickWO, setQuickWO] = useState(false);

  const { data: stats } = useQuery<DashStats>({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiRequest("GET", "/api/dashboard").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<OpenJob[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then(r => r.json()),
  });

  const weekStart = toLocalDateStr(new Date());
  const weekEndDate = new Date();
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = toLocalDateStr(weekEndDate);

  const { data: weekEvents = [], isLoading: weekLoading } = useQuery<ScheduledEvent[]>({
    queryKey: ["/api/schedule", weekStart, weekEnd],
    queryFn: () => apiRequest("GET", `/api/schedule?start=${weekStart}&end=${weekEnd}`).then(r => r.json()),
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity"],
    queryFn: () => apiRequest("GET", "/api/activity").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const sortedJobs = [...jobs].sort((a, b) =>
    PRIORITY_ORDER.indexOf(a.status) - PRIORITY_ORDER.indexOf(b.status)
  );

  const kpis = [
    { label: "Open Work Orders", value: stats?.totalOpen ?? "—", icon: ClipboardList, color: "text-blue-500", onClick: () => navigate("/jobs") },
    { label: "Labor Revenue (Open)", value: stats ? fmtMoney(stats.laborRevenue) : "—", icon: DollarSign, color: "text-green-500" },
    { label: "This Week's Events", value: weekEvents.length, icon: CalendarDays, color: "text-purple-500", onClick: () => navigate("/schedule") },
    { label: "Low Stock Parts", value: stats?.lowStockParts ?? "—", icon: AlertTriangle, color: "text-orange-500", onClick: () => navigate("/parts-catalog") },
  ];

  return (
    <div className="space-y-5 pb-24 lg:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold">Dashboard</h1>
        <Button size="sm" onClick={() => setQuickWO(true)} className="h-8 gap-1">
          <Plus size={13} />New Work Order
        </Button>
      </div>

      {/* KPI cards — 4 up, 2x2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Low stock alert — only show if relevant */}
      {(stats?.lowStockParts ?? 0) > 0 && (
        <button
          onClick={() => navigate("/parts-catalog")}
          className="flex items-center gap-3 w-full border border-destructive/30 rounded-xl px-4 py-3 bg-destructive/5 hover:opacity-80 transition-opacity text-left"
        >
          <AlertTriangle size={15} className="text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive flex-1">
            {stats?.lowStockParts} part{stats?.lowStockParts !== 1 ? "s" : ""} low on stock
          </span>
          <ChevronRight size={14} className="text-destructive/60" />
        </button>
      )}

      {/* Two-column layout: This Week / Open Work Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* This Week at a Glance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <CalendarDays size={14} className="text-muted-foreground" />
              This Week at a Glance
            </h2>
            <button onClick={() => navigate("/schedule")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Schedule <ChevronRight size={12} />
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {weekLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
            ) : weekEvents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarDays size={26} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nothing scheduled this week</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {weekEvents.slice(0, 10).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => navigate("/schedule")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors text-left"
                  >
                    <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-muted shrink-0">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase leading-none">
                        {new Date(ev.scheduledDate + "T00:00:00").toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-sm font-bold leading-none mt-0.5">
                        {new Date(ev.scheduledDate + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ev.customerName ?? ""}{ev.customerName && ev.boatMake ? " · " : ""}{ev.boatMake ?? ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase shrink-0">{ev.timeSlot}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Open Work Orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <Wrench size={14} className="text-muted-foreground" />
              Open Work Orders
            </h2>
            <button onClick={() => navigate("/jobs")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {jobsLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
            ) : sortedJobs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ClipboardList size={26} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No open work orders</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {sortedJobs.slice(0, 8).map(job => <JobRow key={job.id} job={job} />)}
              </div>
            )}
            {sortedJobs.length > 8 && (
              <div className="px-3 py-2 border-t border-border bg-muted/20">
                <button onClick={() => navigate("/jobs")} className="text-xs text-primary hover:underline">
                  + {sortedJobs.length - 8} more — view all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity feed */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <ActivityIcon size={14} className="text-muted-foreground" />
            Recent Activity
          </h2>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {activityLoading ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
          ) : activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ActivityIcon size={22} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {activity.slice(0, 12).map(item => <ActivityRow key={item.id} item={item} />)}
            </div>
          )}
        </div>
      </div>

      {quickWO && <QuickWorkOrderModal onClose={() => setQuickWO(false)} />}
    </div>
  );
}
