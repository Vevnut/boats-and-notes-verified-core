import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ClipboardList, Clock, DollarSign, ChevronRight,
  Plus, Trash2, PenLine, X, Check, Copy, ChevronDown, ChevronUp,
  Wrench, Package, FilePlus, LayoutTemplate, Printer, User, Search,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useClickBind } from "@/lib/keybind-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { ServiceRecord, WorkOrderTemplate, Customer, Boat } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Board Context Menu ───────────────────────────────────────────────────────
function BoardContextMenu({
  x, y, onClose, onNewWorkOrder, onNewTemplate,
}: {
  x: number; y: number;
  onClose: () => void;
  onNewWorkOrder: () => void;
  onNewTemplate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const hKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", hClick);
    document.addEventListener("keydown", hKey);
    return () => {
      document.removeEventListener("mousedown", hClick);
      document.removeEventListener("keydown", hKey);
    };
  }, [onClose]);

  const MI = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
    <button
      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-md transition-colors text-foreground hover:bg-accent"
      onClick={() => { onClick(); onClose(); }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="min-w-[200px] bg-popover border border-border rounded-lg shadow-lg p-1"
      data-testid="board-context-menu"
    >
      <MI icon={<FilePlus size={14} />} label="New Work Order" onClick={onNewWorkOrder} />
      <div className="my-1 border-t border-border" />
      <MI icon={<LayoutTemplate size={14} />} label="New Template" onClick={onNewTemplate} />
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type OpenJob = ServiceRecord & {
  boatMake: string; boatModel: string; boatYear: number | null;
  boatColor: string | null; boatEngineType: string | null;
  boatEngineMake: string | null; boatEngineModel: string | null;
  boatEngineHours: number | null; boatHullId: string | null;
  boatRegistration: string | null; boatStorageLocation: string | null;
  customerName: string; customerPhone: string | null; customerEmail: string | null;
  boatId: number;
};

// ─── Print helpers ────────────────────────────────────────────────────────────
const BBC_PHONE = "(603) 273-2491";
const BBC_EMAIL = "BradleysBoatCare@gmail.com";

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 13px; line-height: 1.5; background: #fff; }
  .page { max-width: 720px; margin: 0 auto; padding: 36px 40px; }
  .header-band { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 18px; border-bottom: 3px solid #076579; margin-bottom: 22px; }
  .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -.5px; color: #076579; }
  .brand-sub { font-size: 12px; color: #555; margin-top: 2px; }
  .brand-contact { font-size: 11px; color: #555; margin-top: 4px; }
  .doc-title { text-align: right; }
  .doc-type { font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #076579; }
  .doc-meta { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.7; }
  .doc-num { font-size: 12px; font-weight: 600; color: #111; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
  .info-box { background: #f7f9fa; border: 1px solid #e0e6ea; border-radius: 6px; padding: 12px 14px; }
  .info-box-full { grid-column: 1 / -1; background: #f7f9fa; border: 1px solid #e0e6ea; border-radius: 6px; padding: 12px 14px; }
  .box-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #076579; margin-bottom: 6px; }
  .box-primary { font-size: 14px; font-weight: 700; }
  .box-row { font-size: 12px; color: #444; margin-top: 2px; }
  .charges-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #076579; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #666; border-bottom: 1px solid #ccc; padding: 6px 6px; text-align: left; }
  td { padding: 7px 6px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
  .right { text-align: right; }
  tr.total-row td { border-top: 2px solid #076579; border-bottom: none; font-weight: 700; font-size: 13px; padding-top: 9px; }
  tr.balance-row td { border-bottom: none; font-weight: 700; font-size: 13px; color: #076579; }
  tr.deposit-row td { border-bottom: 1px solid #eee; color: #666; font-size: 12px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .badge-open { background: #dbeafe; color: #1d4ed8; }
  .badge-paid { background: #d1fae5; color: #065f46; }
  .badge-due  { background: #fef3c7; color: #92400e; }
  .footer { margin-top: 28px; border-top: 1px solid #e0e6ea; padding-top: 14px; font-size: 11px; color: #888; text-align: center; }
  .sig-block { display: flex; gap: 30px; margin-top: 24px; }
  .sig-line { flex: 1; border-top: 1px solid #555; padding-top: 6px; font-size: 11px; color: #555; }
  @media print { body { margin: 0; } .page { padding: 24px; } }
`;

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

function printWorkOrderCustomer(job: OpenJob) {
  const laborCost = (job.laborHours ?? 0) * (job.laborRate ?? 110);
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${woNum}</title>
  <style>${SHARED_CSS}</style></head><body><div class="page">
    <div class="header-band">
      <div>
        <div class="brand-name">Bradley's Boat Care</div>
        <div class="brand-sub">Marine Service &amp; Repair</div>
        <div class="brand-contact">${BBC_PHONE} &nbsp;&bull;&nbsp; ${BBC_EMAIL}</div>
      </div>
      <div class="doc-title">
        <div class="doc-type">Work Order</div>
        <div class="doc-num">${woNum}</div>
        <div class="doc-meta">
          Date: ${job.date}<br/>
          <span class="badge ${job.status === "open" ? "badge-open" : job.paid ? "badge-paid" : "badge-due"}">${job.status === "open" ? "Open" : job.paid ? "Paid" : "Balance Due"}</span>
        </div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-box">
        <div class="box-label">Customer</div>
        <div class="box-primary">${job.customerName}</div>
        ${job.customerPhone ? `<div class="box-row">${job.customerPhone}</div>` : ""}
        ${job.customerEmail ? `<div class="box-row">${job.customerEmail}</div>` : ""}
      </div>
      <div class="info-box">
        <div class="box-label">Vessel</div>
        <div class="box-primary">${[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—"}</div>
        ${job.boatColor ? `<div class="box-row">Color: ${job.boatColor}</div>` : ""}
        ${job.boatEngineMake ? `<div class="box-row">Engine: ${job.boatEngineMake}${job.boatEngineModel ? " " + job.boatEngineModel : ""}</div>` : ""}
        ${job.boatEngineHours != null ? `<div class="box-row">Hours: ${job.boatEngineHours}</div>` : ""}
        ${job.boatHullId ? `<div class="box-row">HIN: ${job.boatHullId}</div>` : ""}
        ${job.boatRegistration ? `<div class="box-row">Reg: ${job.boatRegistration}</div>` : ""}
      </div>
      <div class="info-box-full">
        <div class="box-label">Work Description</div>
        <div class="box-primary" style="font-size:13px">${job.description}</div>
      </div>
    </div>
    <div class="charges-label">Charges</div>
    <table>
      <thead><tr><th>Description</th><th>Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${job.laborHours ? `<tr><td>Labor${job.laborRate ? ` @ $${job.laborRate}/hr` : ""}</td><td>${job.laborHours} hrs</td><td class="right">$${(job.laborRate ?? 110).toFixed(2)}</td><td class="right">$${laborCost.toFixed(2)}</td></tr>` : ""}
      </tbody>
      <tfoot>
        <tr class="total-row"><td colspan="3">Estimated Total</td><td class="right">$${laborCost.toFixed(2)}</td></tr>
        ${job.depositAmount ? `<tr class="deposit-row"><td colspan="3">Deposit Received</td><td class="right">-$${job.depositAmount.toFixed(2)}</td></tr>` : ""}
        ${job.depositAmount ? `<tr class="balance-row"><td colspan="3">Balance Due</td><td class="right">$${(laborCost - (job.depositAmount ?? 0)).toFixed(2)}</td></tr>` : ""}
      </tfoot>
    </table>
    <div class="sig-block">
      <div class="sig-line">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
      <div class="sig-line">Authorized By &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
    </div>
    <div class="footer">Bradley's Boat Care &nbsp;&bull;&nbsp; ${BBC_PHONE} &nbsp;&bull;&nbsp; ${BBC_EMAIL}<br/>
    Thank you for your business. All work is performed with quality marine-grade materials and labor.</div>
  </div><script>window.onload = () => window.print();</script></body></html>`;
  openPrint(html);
}

function printWorkOrderTech(job: OpenJob) {
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const techCSS = `
    .tech-banner { background: #076579; color: #fff; text-align: center; font-size: 11px; font-weight: 700;
      letter-spacing: .12em; text-transform: uppercase; padding: 5px 0; margin-bottom: 20px; border-radius: 4px; }
    .check-list { list-style: none; padding: 0; }
    .check-list li { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0;
      border-bottom: 1px dashed #ddd; font-size: 12px; }
    .check-list li:last-child { border-bottom: none; }
    .checkbox { width: 16px; height: 16px; border: 2px solid #076579; border-radius: 3px;
      flex-shrink: 0; margin-top: 1px; display: inline-block; }
    .note-box { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px;
      padding: 12px 14px; margin-bottom: 18px; }
    .note-box .box-label { color: #92400e; }
    .note-content { font-size: 12px; color: #444; white-space: pre-wrap; margin-top: 4px; line-height: 1.6; }
    .write-area { border: 1px solid #ccc; border-radius: 6px; padding: 10px; min-height: 60px;
      margin-top: 6px; }
    .storage-flag { display: inline-block; background: #eff6ff; color: #1d4ed8;
      border: 1px solid #bfdbfe; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
    .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      color: #076579; margin-bottom: 8px; }
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${woNum} — Tech Copy</title>
  <style>${SHARED_CSS}${techCSS}</style></head><body><div class="page">
    <div class="tech-banner">Technician Copy — Internal Use Only</div>
    <div class="header-band">
      <div>
        <div class="brand-name">Bradley's Boat Care</div>
        <div class="brand-sub">Marine Service &amp; Repair</div>
        <div class="brand-contact">${BBC_PHONE} &nbsp;&bull;&nbsp; ${BBC_EMAIL}</div>
      </div>
      <div class="doc-title">
        <div class="doc-type">Work Order</div>
        <div class="doc-num">${woNum}</div>
        <div class="doc-meta">
          Date: ${job.date}<br/>
          <span class="badge badge-open">${job.status.charAt(0).toUpperCase() + job.status.slice(1)}</span>
        </div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-box">
        <div class="box-label">Customer</div>
        <div class="box-primary">${job.customerName}</div>
        ${job.customerPhone ? `<div class="box-row">${job.customerPhone}</div>` : ""}
        ${job.customerEmail ? `<div class="box-row">${job.customerEmail}</div>` : ""}
      </div>
      <div class="info-box">
        <div class="box-label">Vessel</div>
        <div class="box-primary">${[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—"}</div>
        ${job.boatColor ? `<div class="box-row">Color: ${job.boatColor}</div>` : ""}
        ${job.boatEngineType ? `<div class="box-row">Type: ${job.boatEngineType}</div>` : ""}
        ${job.boatEngineMake ? `<div class="box-row">Engine: ${job.boatEngineMake}${job.boatEngineModel ? " " + job.boatEngineModel : ""}</div>` : ""}
        ${job.boatEngineHours != null ? `<div class="box-row">Hours: <strong>${job.boatEngineHours}</strong></div>` : ""}
        ${job.boatHullId ? `<div class="box-row">HIN: <strong>${job.boatHullId}</strong></div>` : ""}
        ${job.boatRegistration ? `<div class="box-row">Reg: ${job.boatRegistration}</div>` : ""}
        ${job.boatStorageLocation ? `<div class="box-row">Storage: <span class="storage-flag">${job.boatStorageLocation}</span></div>` : ""}
      </div>
    </div>
    <div class="info-box" style="margin-bottom:16px">
      <div class="box-label">Work to Perform</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">${job.description}</div>
    </div>
    ${job.techNotes ? `
    <div class="note-box">
      <div class="box-label">Tech Notes</div>
      <div class="note-content">${job.techNotes}</div>
    </div>` : ""}
    <div style="margin-bottom:18px">
      <div class="section-label">Job Checklist</div>
      <ul class="check-list">
        <li><span class="checkbox"></span><span>${job.description}</span></li>
        <li><span class="checkbox"></span><span>Verify all fluid levels after service</span></li>
        <li><span class="checkbox"></span><span>Test operation / run check</span></li>
        <li><span class="checkbox"></span><span>Clean work area and vessel</span></li>
        <li><span class="checkbox"></span><span>Quality check complete — ready for customer pickup</span></li>
      </ul>
    </div>
    <div style="margin-bottom:18px">
      <div class="section-label">Labor Time</div>
      ${job.laborHours ? `<div style="font-size:12px;margin-bottom:8px">Flat Rate / Estimated: <strong>${job.laborHours} hrs</strong> @ $${job.laborRate ?? 110}/hr</div>` : ""}
      <div style="display:flex;gap:24px">
        <div style="font-size:12px">Start: ___________</div>
        <div style="font-size:12px">End: ___________</div>
        <div style="font-size:12px">Actual Hours: ___________</div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div class="section-label">Additional Notes / Parts Used</div>
      <div class="write-area"></div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Technician Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date Completed</div>
    </div>
    <div class="footer" style="font-size:10px;color:#aaa">INTERNAL DOCUMENT — Not for customer distribution &nbsp;&bull;&nbsp; ${woNum}</div>
  </div><script>window.onload = () => window.print();</script></body></html>`;
  openPrint(html);
}

type TemplatePart = { partNumber: string; description: string; quantity: number; unitPrice: number };

const BLANK_TEMPLATE = {
  name: "",
  description: "",
  techNotes: "",
  laborHours: "" as string | number,
  laborRate: 110 as string | number,
  parts: [] as TemplatePart[],
  category: "",
};

const STATUS_COLORS: Record<string, string> = {
  open:             "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  waiting_on_parts: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ready_for_pickup: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  complete:         "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced:         "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};
const STATUS_ORDER  = ["open", "waiting_on_parts", "ready_for_pickup", "complete", "invoiced"];
const STATUS_LABELS: Record<string, string> = {
  open:             "Open",
  waiting_on_parts: "Waiting on Parts",
  ready_for_pickup: "Ready for Pickup",
  complete:         "Complete",
  invoiced:         "Invoiced",
};
const NEXT_STATUS: Record<string, string> = {
  open:             "waiting_on_parts",
  waiting_on_parts: "ready_for_pickup",
  ready_for_pickup: "complete",
  complete:         "invoiced",
};
// Short labels for the card advance button (keeps cards tidy on mobile)
const NEXT_STATUS_SHORT: Record<string, string> = {
  open:             "Waiting",
  waiting_on_parts: "Pickup",
  ready_for_pickup: "Complete",
  complete:         "Invoice",
};

// ─── Searchable Customer Picker ───────────────────────────────────────────────
function CustomerSearchSelect({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = customers.find(c => c.id === value) ?? null;

  const filtered = query.trim() === ""
    ? customers
    : customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: Customer) => {
    onChange(c.id);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search size={13} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={open ? query : (selected ? selected.name : "")}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Search customers..."
          className="w-full h-9 pl-8 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {selected && !open && (
          <button
            onClick={handleClear}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-[200] mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">No customers match</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onPointerDown={e => { e.preventDefault(); handleSelect(c); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${c.id === value ? "bg-primary/10 text-primary font-medium" : ""}`}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Quick New Work Order Sheet — also exported so job board can reuse it
export function NewWOSheet({
  onClose, onCreated, initialCustomerId,
}: {
  onClose: () => void;
  onCreated: (boatId?: number) => void;
  // Batch 2.5 minimal addition: allows deep-linking from customer-detail's cust.newWO
  // keybind to prefill the customer without changing default (undefined) behavior.
  initialCustomerId?: number | null;
}) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId ?? null);
  const [boatId, setBoatId]         = useState<number | null>(null);
  const [date, setDate]             = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]       = useState("");

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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!boatId) throw new Error("Pick a boat first");
      return apiRequest("POST", `/api/boats/${boatId}/service`, {
        date,
        dueDate: dueDate || null,
        description: "",
        laborRate: 110,
        status: "open",
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Work order created" });
      onCreated(boatId ?? undefined);
    },
    onError: (err: any) => toast({ title: (err as any).message ?? "Failed", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "70vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">New Work Order</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Customer *</label>
            <CustomerSearchSelect
              customers={customers}
              value={customerId}
              onChange={id => { setCustomerId(id); setBoatId(null); }}
            />
          </div>

          {customerId && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Vessel *</label>
              {boats.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No boats on file for this customer</p>
              ) : (
                <select
                  value={boatId ?? ""}
                  onChange={e => setBoatId(Number(e.target.value) || null)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select vessel —</option>
                  {boats.map((b: Boat) => (
                    <option key={b.id} value={b.id}>
                      {[b.year, b.make, b.model].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Created</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!boatId || createMutation.isPending}
            className="w-full h-9"
          >
            <Check size={14} className="mr-1.5" />
            {createMutation.isPending ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}


// ─── Template Editor Sheet ────────────────────────────────────────────────────
function TemplateEditor({
  initial, onSave, onClose, isPending,
}: {
  initial: typeof BLANK_TEMPLATE | WorkOrderTemplate;
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const parsePartsJson = (raw: any): TemplatePart[] => {
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw ?? "[]"); } catch { return []; }
  };

  const [name, setName]         = useState(initial.name ?? "");
  const [desc, setDesc]         = useState(("description" in initial ? initial.description : "") ?? "");
  const [tech, setTech]         = useState(("techNotes" in initial ? initial.techNotes : "") ?? "");
  const [hours, setHours]       = useState<string>(String(("laborHours" in initial && initial.laborHours != null) ? initial.laborHours : ""));
  const [rate, setRate]         = useState<string>(String(("laborRate" in initial && initial.laborRate != null) ? initial.laborRate : "110"));
  const [cat, setCat]           = useState(("category" in initial ? initial.category : "") ?? "");
  const [parts, setParts]       = useState<TemplatePart[]>(
    "parts" in initial ? parsePartsJson((initial as WorkOrderTemplate).parts) : []
  );

  const addPart = () => setParts(p => [...p, { partNumber: "", description: "", quantity: 1, unitPrice: 0 }]);
  const removePart = (i: number) => setParts(p => p.filter((_, idx) => idx !== i));
  const updatePart = (i: number, field: keyof TemplatePart, val: string | number) =>
    setParts(p => p.map((part, idx) => idx === i ? { ...part, [field]: val } : part));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: desc.trim(),
      techNotes: tech.trim() || null,
      laborHours: hours !== "" ? parseFloat(String(hours)) : null,
      laborRate: rate !== "" ? parseFloat(String(rate)) : 110,
      parts: JSON.stringify(parts),
      category: cat.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">
            {"id" in initial && (initial as WorkOrderTemplate).id ? "Edit Template" : "New Template"}
          </span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Template Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 100-Hour Service" className="h-8 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— None —</option>
              <option>Engine Service</option>
              <option>Seasonal</option>
              <option>Electrical</option>
              <option>Cooling System</option>
              <option>Trailer</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Work Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the work to be performed..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Tech Notes (internal)</label>
            <textarea
              value={tech}
              onChange={e => setTech(e.target.value)}
              placeholder="Torque specs, procedures, notes for the tech..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Labor Hours</label>
              <Input type="number" step="0.5" min="0" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Labor Rate ($/hr)</label>
              <Input type="number" step="5" min="0" value={rate} onChange={e => setRate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* Parts list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parts / Materials</label>
              <button
                onClick={addPart}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus size={11} /> Add Part
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No parts added yet</p>
            ) : (
              <div className="space-y-2">
                {parts.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        value={p.partNumber}
                        onChange={e => updatePart(i, "partNumber", e.target.value)}
                        placeholder="Part #"
                        className="h-7 text-xs w-28 shrink-0 font-mono"
                      />
                      <Input
                        value={p.description}
                        onChange={e => updatePart(i, "description", e.target.value)}
                        placeholder="Description"
                        className="h-7 text-xs flex-1"
                      />
                      <button onClick={() => removePart(i)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Qty</span>
                        <Input
                          type="number" step="1" min="1"
                          value={p.quantity}
                          onChange={e => updatePart(i, "quantity", parseFloat(e.target.value) || 1)}
                          className="h-7 text-xs w-16"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number" step="0.01" min="0"
                          value={p.unitPrice}
                          onChange={e => updatePart(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs w-24"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border">
          <Button onClick={handleSave} disabled={isPending || !name.trim()} className="w-full h-9">
            <Check size={14} className="mr-1.5" />{isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Apply Template Sheet ─────────────────────────────────────────────────────
function ApplyTemplateSheet({
  template, onClose, onApplied,
}: {
  template: WorkOrderTemplate;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [boatId, setBoatId]         = useState<number | null>(null);
  const [date, setDate]             = useState(() => new Date().toISOString().slice(0, 10));

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

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!boatId) throw new Error("Pick a boat first");
      // Create the service record
      const sr = await apiRequest("POST", `/api/boats/${boatId}/service`, {
        date,
        description: template.description || template.name,
        techNotes: template.techNotes ?? null,
        laborHours: template.laborHours ?? null,
        laborRate: template.laborRate ?? 110,
        status: "open",
      }).then(r => r.json());

      // Add parts from the template
      const parts: TemplatePart[] = (() => {
        try { return JSON.parse(template.parts ?? "[]"); } catch { return []; }
      })();
      for (const p of parts) {
        await apiRequest("POST", `/api/service/${sr.id}/parts`, {
          serviceRecordId: sr.id,
          partNumber: p.partNumber || null,
          description: p.description,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
        });
      }
      return sr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Work order created from template" });
      onApplied();
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "72vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <p className="font-semibold text-sm">Apply Template</p>
            <p className="text-xs text-muted-foreground">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">Pick a customer and boat — a new work order will be created using this template.</p>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Customer *</label>
            <CustomerSearchSelect
              customers={customers}
              value={customerId}
              onChange={id => { setCustomerId(id); setBoatId(null); }}
            />
          </div>

          {customerId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Boat *</label>
              {boats.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">This customer has no boats on file</p>
              ) : (
                <select
                  value={boatId ?? ""}
                  onChange={e => setBoatId(Number(e.target.value) || null)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select boat —</option>
                  {boats.map((b: Boat) => (
                    <option key={b.id} value={b.id}>
                      {[b.year, b.make, b.model].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Work Order Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* Template summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What gets created</p>
            {template.description && <p className="text-sm">{template.description}</p>}
            {template.laborHours != null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} />{template.laborHours} hrs @ ${template.laborRate ?? 110}/hr
              </p>
            )}
            {(() => {
              try {
                const parts: TemplatePart[] = JSON.parse(template.parts ?? "[]");
                if (parts.length === 0) return null;
                return (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Package size={11} />{parts.length} part{parts.length !== 1 ? "s" : ""} added
                  </p>
                );
              } catch { return null; }
            })()}
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-border">
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={!boatId || applyMutation.isPending}
            className="w-full h-9"
          >
            <Check size={14} className="mr-1.5" />
            {applyMutation.isPending ? "Creating..." : "Create Work Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({
  t, onEdit, onDelete, onApply,
}: {
  t: WorkOrderTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  let parts: TemplatePart[] = [];
  try { parts = JSON.parse(t.parts ?? "[]"); } catch {}

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`template-card-${t.id}`}>
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{t.name}</p>
            {t.category && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t.category}</span>
            )}
          </div>
          {t.description ? (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
          ) : null}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {t.laborHours != null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={10} />{t.laborHours} hrs
              </span>
            )}
            {parts.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Package size={10} />{parts.length} part{parts.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onApply} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
            <Copy size={11} />Use
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" data-testid={`button-edit-template-${t.id}`}>
            <PenLine size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-template-${t.id}`}>
            <Trash2 size={13} />
          </button>
          {(t.techNotes || parts.length > 0) && (
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border/50 pt-2.5 space-y-2">
          {t.techNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tech Notes</p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap">{t.techNotes}</p>
            </div>
          )}
          {parts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Parts</p>
              <div className="space-y-0.5">
                {parts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground/80">
                      {p.partNumber && <span className="font-mono text-muted-foreground mr-1.5">#{p.partNumber}</span>}
                      {p.description}
                    </span>
                    <span className="text-muted-foreground ml-2 shrink-0">
                      {p.quantity} × ${p.unitPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  usePageTitle("Work Orders");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"board" | "templates">("board");

  // Work orders board state
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<OpenJob[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then(r => r.json()),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/service/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status updated" });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/work-orders/${id}/clone`, {}).then(r => r.json()),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Work order duplicated" });
      navigate(`/jobs/${created.id}`);
    },
    onError: (err: any) => toast({ title: err?.message ?? "Failed to duplicate work order", variant: "destructive" }),
  });

  // Templates state
  const { data: templates = [], isLoading: tplLoading } = useQuery<WorkOrderTemplate[]>({
    queryKey: ["/api/work-order-templates"],
    queryFn: () => apiRequest("GET", "/api/work-order-templates").then(r => r.json()),
  });

  const createTplMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/work-order-templates", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-templates"] });
      setEditorOpen(false);
      toast({ title: "Template saved" });
    },
  });
  const updateTplMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/work-order-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template updated" });
    },
  });
  const deleteTplMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/work-order-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-templates"] });
      setDeleteConfirm(null);
      toast({ title: "Template removed" });
    },
  });

  const [editorOpen, setEditorOpen]         = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkOrderTemplate | null>(null);
  const [applyTemplate, setApplyTemplate]   = useState<WorkOrderTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<WorkOrderTemplate | null>(null);
  const [boardCtx, setBoardCtx]             = useState<{ x: number; y: number } | null>(null);
  const [quickNewOpen, setQuickNewOpen]     = useState(false);
  const [quickNewCustomerId, setQuickNewCustomerId] = useState<number | null>(null);

  // Batch 2.5 minimal addition: support a ?new=1[&customerId=N] URL flag so the global
  // "n w" keybind (and cust.newWO on the customer detail page) can deep-link into the
  // quick-new sheet, optionally prefilled with a customer.
  useEffect(() => {
    if (window.location.hash.includes("new=1")) {
      const qs = window.location.hash.split("?")[1] ?? "";
      const params = new URLSearchParams(qs);
      const cid = params.get("customerId");
      setQuickNewCustomerId(cid ? Number(cid) : null);
      setQuickNewOpen(true);
      const clean = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBoardCtx = useCallback((e: React.MouseEvent) => {
    if (activeTab !== "board") return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 210);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    setBoardCtx({ x, y });
  }, [activeTab]);

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s);
    return acc;
  }, {} as Record<string, OpenJob[]>);

  // Modifier+Click (Batch 2.5 addendum) for WO board cards: Ctrl+Click opens in a new tab,
  // Alt+Click duplicates via the existing cloneMutation, Shift+Click is a multi-select
  // placeholder (no multi-select state exists on this board yet).
  const handleWoNewTabClick = useClickBind("wo.card.newTab", (job: OpenJob) => {
    window.open(`${window.location.pathname}#/jobs/${job.id}`, "_blank");
  });
  const handleWoDuplicateClick = useClickBind("wo.card.duplicate", (job: OpenJob) => cloneMutation.mutate(job.id));
  const handleWoMultiSelectClick = useClickBind("wo.card.multiSelect", () => {
    toast({ title: "Multi-select coming soon", description: "This board doesn't support multi-select yet." });
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === "board"
              ? `${jobs.length} active ${jobs.length === 1 ? "order" : "orders"}`
              : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
          </p>
        </div>
        {activeTab === "templates" && (
          <Button size="sm" onClick={() => setEditorOpen(true)} data-testid="button-add-template">
            <Plus size={15} className="mr-1" />New Template
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {[
          { key: "board", label: "Board", icon: ClipboardList },
          { key: "templates", label: "Templates", icon: Copy },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Board ── */}
      {activeTab === "board" && (
        <div onContextMenu={handleBoardCtx} className="min-h-[40vh]" data-testid="board-area">
          {jobsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No open work orders</p>
              <p className="text-sm mt-1">Right-click anywhere on the board to create one</p>
            </div>
          ) : (
            <div className="space-y-6">
              {STATUS_ORDER.map(status => {
                const group = grouped[status];
                if (group.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{group.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(job => (
                        <div
                          key={job.id}
                          className="bg-card border border-border rounded-xl px-4 py-3.5 flex flex-col sm:flex-row items-start gap-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                          data-testid={`job-card-${job.id}`}
                          onClick={(e) => {
                            if (handleWoNewTabClick(e, job)) return;
                            if (handleWoDuplicateClick(e, job)) return;
                            if (handleWoMultiSelectClick(e, job)) return;
                            navigate(`/jobs/${job.id}`);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{job.customerName}</p>
                              <span className="text-xs text-muted-foreground">·</span>
                              <p className="text-xs text-muted-foreground">{[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ")}</p>
                            </div>
                            <p className="text-sm mt-0.5 text-foreground/80">{job.description}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">{job.date}</span>
                              {(job as any).dueDate && (
                                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Due {(job as any).dueDate}</span>
                              )}
                              {job.laborHours != null && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={10} />{job.laborHours} hrs</span>
                              )}
                              {job.cost != null && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign size={10} />${job.cost.toFixed(2)}</span>
                              )}
                              {!!job.paid && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            {NEXT_STATUS[status] && (
                              <button
                                onClick={() => updateMutation.mutate({ id: job.id, status: NEXT_STATUS[status] })}
                                className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-accent transition-colors whitespace-nowrap"
                                title={`Mark as ${STATUS_LABELS[NEXT_STATUS[status]]}`}
                                data-testid={`button-advance-job-${job.id}`}
                              >
                                → {NEXT_STATUS_SHORT[status]}
                              </button>
                            )}
                            {/* Print buttons */}
                            <button
                              onClick={() => printWorkOrderTech(job)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="Print tech copy"
                              data-testid={`button-print-tech-${job.id}`}
                            >
                              <Wrench size={14} />
                            </button>
                            <button
                              onClick={() => printWorkOrderCustomer(job)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="Print customer copy"
                              data-testid={`button-print-customer-${job.id}`}
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => cloneMutation.mutate(job.id)}
                              disabled={cloneMutation.isPending}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                              title="Duplicate work order"
                              data-testid={`button-duplicate-job-${job.id}`}
                            >
                              <Copy size={14} />
                            </button>
                            <Link href={`/boats/${job.boatId}`} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                              <ChevronRight size={16} />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Templates ── */}
      {activeTab === "templates" && (
        <>
          {tplLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm mt-1">Create a template to quickly start a work order for any customer</p>
              <Button size="sm" className="mt-4" onClick={() => setEditorOpen(true)}>
                <Plus size={14} className="mr-1" />Create First Template
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  onEdit={() => setEditingTemplate(t)}
                  onDelete={() => setDeleteConfirm(t)}
                  onApply={() => setApplyTemplate(t)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* New template editor */}
      {editorOpen && (
        <TemplateEditor
          initial={BLANK_TEMPLATE as any}
          onSave={data => createTplMutation.mutate(data)}
          onClose={() => setEditorOpen(false)}
          isPending={createTplMutation.isPending}
        />
      )}

      {/* Edit template editor */}
      {editingTemplate && (
        <TemplateEditor
          initial={editingTemplate}
          onSave={data => updateTplMutation.mutate({ id: editingTemplate.id, data })}
          onClose={() => setEditingTemplate(null)}
          isPending={updateTplMutation.isPending}
        />
      )}

      {/* Apply template sheet */}
      {applyTemplate && (
        <ApplyTemplateSheet
          template={applyTemplate}
          onClose={() => setApplyTemplate(null)}
          onApplied={() => { setApplyTemplate(null); setActiveTab("board"); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center">
              <Trash2 size={28} className="text-destructive mx-auto mb-2" />
              <p className="font-semibold">Delete this template?</p>
              <p className="text-sm text-muted-foreground mt-1">{deleteConfirm.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Existing work orders are not affected.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deleteTplMutation.isPending}
                onClick={() => deleteTplMutation.mutate(deleteConfirm.id)}>
                {deleteTplMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Board right-click context menu */}
      {boardCtx && (
        <BoardContextMenu
          x={boardCtx.x}
          y={boardCtx.y}
          onClose={() => setBoardCtx(null)}
          onNewWorkOrder={() => { setBoardCtx(null); setQuickNewOpen(true); }}
          onNewTemplate={() => { setBoardCtx(null); setActiveTab("templates"); setEditorOpen(true); }}
        />
      )}

      {/* Quick new work order sheet (from right-click, no template, or ?new=1 deep link) */}
      {quickNewOpen && (
        <NewWOSheet
          onClose={() => { setQuickNewOpen(false); setQuickNewCustomerId(null); }}
          onCreated={() => { setQuickNewOpen(false); setQuickNewCustomerId(null); queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }); }}
          initialCustomerId={quickNewCustomerId}
        />
      )}
    </div>
  );
}
