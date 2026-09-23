import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ChevronLeft, Plus, Clock, DollarSign, Pencil, Trash2, FileText,
  Bell, BellOff, StickyNote, CheckCircle2, Circle, Printer, Package,
  ChevronDown, ChevronUp, Star, Settings2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotosSection } from "@/components/photos-section";
import type { Boat, Customer, ServiceRecord, InsertServiceRecord, Part, InsertPart, LaborCode, PartsCatalog } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  invoiced: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

// ─── Reminder type ──────────────────────────────────────────────────────────
type Reminder = { label: string; dueDate: string; done: boolean };

type BoatAtAGlance = {
  totalServices: number;
  lastServiceDate: string | null;
  lastServiceSummary: string | null;
  engineHours: number | null;
  outstandingBalance: number;
};

const ORDER_STATUS_LABELS: Record<string, { label: string; next: string | null; nextLabel: string }> = {
  "": { label: "Not Ordered", next: "ordered", nextLabel: "Mark Ordered" },
  "ordered": { label: "Ordered", next: "received", nextLabel: "Mark Received" },
  "received": { label: "Received", next: null, nextLabel: "" },
};

// ─── Parts subcomponent ─────────────────────────────────────────────────────
function PartsSection({ serviceId }: { serviceId: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const { toast } = useToast();
  const form = useForm<InsertPart>({
    defaultValues: { serviceRecordId: serviceId, partNumber: "", description: "", quantity: 1, unitPrice: 0 },
  });

  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: ["/api/service", serviceId, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${serviceId}/parts`).then(r => r.json()),
  });

  const { data: catalog = [] } = useQuery<PartsCatalog[]>({
    queryKey: ["/api/parts-catalog", catalogSearch],
    queryFn: () => apiRequest("GET", catalogSearch ? `/api/parts-catalog?q=${encodeURIComponent(catalogSearch)}` : "/api/parts-catalog").then(r => r.json()),
    enabled: showCatalog,
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertPart) => apiRequest("POST", `/api/service/${serviceId}/parts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parts-orders"] });
      form.reset({ serviceRecordId: serviceId, partNumber: "", description: "", quantity: 1, unitPrice: 0 });
      setAddOpen(false);
      setShowCatalog(false);
      toast({ title: "Part added" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, orderStatus }: { id: number; orderStatus: string | null }) =>
      apiRequest("PATCH", `/api/parts/${id}`, { orderStatus }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parts-orders"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/parts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parts-orders"] });
    },
  });

  const partsTotal = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

  const pickFromCatalog = (item: PartsCatalog) => {
    form.setValue("description", item.description);
    form.setValue("partNumber", item.partNumber ?? "");
    form.setValue("unitPrice", item.sellPrice ?? 0);
    form.setValue("catalogPartId", item.id);
    setShowCatalog(false);
    setAddOpen(true);
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Package size={11} />Parts</span>
        <div className="flex gap-2">
          <button onClick={() => { setShowCatalog(!showCatalog); setAddOpen(false); }} className="text-xs text-muted-foreground hover:text-primary">From Catalog</button>
          <button onClick={() => { setAddOpen(!addOpen); setShowCatalog(false); }} className="text-xs text-primary hover:underline">+ Add part</button>
        </div>
      </div>

      {showCatalog && (
        <div className="mb-3 p-3 bg-muted/40 rounded-lg space-y-2">
          <Input placeholder="Search catalog..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} className="h-8 text-xs" />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {catalog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No parts found</p>
            ) : catalog.map(item => (
              <button key={item.id} onClick={() => pickFromCatalog(item)}
                className="w-full text-left text-xs p-2 rounded hover:bg-accent transition-colors flex items-center justify-between">
                <span className="flex-1 truncate flex items-center gap-1.5">
                  {!!item.isCommon && <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
                  {item.description}
                  {item.partNumber && <span className="text-muted-foreground ml-1">#{item.partNumber}</span>}
                </span>
                <span className="font-medium ml-2 shrink-0">${(item.sellPrice ?? 0).toFixed(2)}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowCatalog(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}

      {addOpen && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="grid grid-cols-2 gap-2 mb-3 p-3 bg-muted/40 rounded-lg">
            <FormField control={form.control} name="description" rules={{ required: true }} render={({ field }) => (
              <FormItem className="col-span-2"><FormLabel className="text-xs">Description *</FormLabel>
                <FormControl><Input placeholder="e.g. Impeller kit" {...field} className="h-8 text-xs" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="partNumber" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Part #</FormLabel>
                <FormControl><Input placeholder="6H3-44352-00" {...field} value={field.value ?? ""} className="h-8 text-xs" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Qty</FormLabel>
                <FormControl><Input type="number" step="0.5" min="0.5" {...field} onChange={e => field.onChange(Number(e.target.value))} className="h-8 text-xs" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="unitPrice" render={({ field }) => (
              <FormItem className="col-span-2"><FormLabel className="text-xs">Unit Price ($)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(Number(e.target.value))} className="h-8 text-xs" /></FormControl>
              </FormItem>
            )} />
            <div className="flex gap-2 col-span-2 justify-end">
              <button type="button" onClick={() => setAddOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={createMutation.isPending}>Add</Button>
            </div>
          </form>
        </Form>
      )}

      {parts.length > 0 && (
        <div className="space-y-1">
          {parts.map(p => {
            const statusKey = p.orderStatus ?? "";
            const statusInfo = ORDER_STATUS_LABELS[statusKey] ?? ORDER_STATUS_LABELS[""];
            return (
              <div key={p.id} className="group flex items-center gap-2 text-xs py-1">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{p.description}{p.partNumber ? <span className="text-muted-foreground ml-1">#{p.partNumber}</span> : ""}</div>
                  {statusKey !== "received" && (
                    <button onClick={() => updateOrderMutation.mutate({ id: p.id, orderStatus: statusInfo.next })}
                      className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full border transition-colors ${
                        statusKey === "ordered"
                          ? "border-blue-300 text-blue-600 hover:bg-blue-50 dark:text-blue-400"
                          : "border-muted text-muted-foreground hover:border-primary hover:text-primary"
                      }`}>
                      {statusInfo.label} → {statusInfo.nextLabel}
                    </button>
                  )}
                  {statusKey === "received" && <span className="text-[10px] text-green-600">Received</span>}
                </div>
                <span className="text-muted-foreground shrink-0">{p.quantity} × ${p.unitPrice.toFixed(2)}</span>
                <span className="font-medium w-16 text-right shrink-0">${(p.quantity * p.unitPrice).toFixed(2)}</span>
                <button onClick={() => deleteMutation.mutate(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={12} /></button>
              </div>
            );
          })}
          <div className="flex justify-end pt-1 border-t border-border">
            <span className="text-xs font-semibold">Parts total: ${partsTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice printer ─────────────────────────────────────────────────────────
function printInvoice(service: ServiceRecord, parts: Part[], boat: Boat, customer: Customer) {
  const laborCost = (service.laborHours ?? 0) * (service.laborRate ?? 110);
  const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const total = laborCost + partsCost;
  const balance = total - (service.depositAmount ?? 0);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Invoice</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; color: #1a1a1a; font-size: 14px; }
    h1 { font-size: 22px; margin: 0; } .sub { color: #666; font-size: 13px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .section { margin: 20px 0; } .section h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 8px; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 6px 0; text-align: left; }
    th { font-size: 11px; color: #888; border-bottom: 1px solid #eee; }
    tr:not(:last-child) td { border-bottom: 1px solid #f5f5f5; }
    .right { text-align: right; } .total-row td { font-weight: 600; border-top: 2px solid #ddd; padding-top: 10px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      background: ${service.paid ? "#d1fae5" : "#fef3c7"}; color: ${service.paid ? "#065f46" : "#92400e"}; }
    @media print { body { margin: 20px; } }
  </style></head><body>

  <div class="header">
    <div><h1>Bradley's Boat Care</h1><div class="sub">Marine Service &amp; Repair</div><div class="sub" style="margin-top:4px">(603) 273-2491 &nbsp;&bull;&nbsp; BradleysBoatCare@gmail.com</div></div>
    <div style="text-align:right"><div style="font-size:18px;font-weight:700">INVOICE</div>
      <div class="sub">${new Date().toLocaleDateString()}</div>
      <div style="margin-top:6px"><span class="badge">${service.paid ? "PAID" : "BALANCE DUE"}</span></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="section">
    <div><h3>Customer</h3><div><strong>${customer.name}</strong></div>
      ${customer.phone ? `<div>${customer.phone}</div>` : ""}
      ${customer.email ? `<div>${customer.email}</div>` : ""}
    </div>
    <div><h3>Vessel</h3>
      <div><strong>${[boat.year, boat.make, boat.model].filter(Boolean).join(" ")}</strong></div>
      ${boat.color ? `<div>${boat.color}</div>` : ""}
      ${boat.engineMake ? `<div>${boat.engineMake} ${boat.engineModel ?? ""}</div>` : ""}
      ${boat.hullId ? `<div>HIN: ${boat.hullId}</div>` : ""}
      ${boat.registrationNumber ? `<div>Reg: ${boat.registrationNumber}</div>` : ""}
    </div>
  </div>

  <div class="section"><h3>Service</h3>
    <div><strong>${service.description}</strong></div>
    ${service.techNotes ? `<div class="sub" style="margin-top:4px">${service.techNotes}</div>` : ""}
    <div class="sub" style="margin-top:4px">Date: ${service.date}</div>
  </div>

  <div class="section"><h3>Charges</h3>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${service.laborHours ? `<tr><td>Labor${service.laborRate ? ` @ $${service.laborRate}/hr` : ""}</td><td>${service.laborHours} hrs</td><td class="right">$${(service.laborRate ?? 110).toFixed(2)}</td><td class="right">$${laborCost.toFixed(2)}</td></tr>` : ""}
      ${parts.map(p => `<tr><td>${p.description}${p.partNumber ? ` <span style="color:#888">#${p.partNumber}</span>` : ""}</td><td>${p.quantity}</td><td class="right">$${p.unitPrice.toFixed(2)}</td><td class="right">$${(p.quantity * p.unitPrice).toFixed(2)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="total-row"><td colspan="3">Total</td><td class="right">$${total.toFixed(2)}</td></tr>
      ${service.depositAmount ? `<tr><td colspan="3" style="color:#666">Deposit Received</td><td class="right" style="color:#666">-$${service.depositAmount.toFixed(2)}</td></tr>` : ""}
      ${service.depositAmount ? `<tr><td colspan="3" style="font-weight:700">Balance Due</td><td class="right" style="font-weight:700">$${balance.toFixed(2)}</td></tr>` : ""}
    </tfoot>
  </table></div>
  <script>window.onload = () => window.print();</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Service Form ─────────────────────────────────────────────────────────────
function ServiceForm({ boatId, defaultValues, onSubmit, isPending }: {
  boatId: number;
  defaultValues?: Partial<InsertServiceRecord>;
  onSubmit: (data: InsertServiceRecord) => void;
  isPending: boolean;
}) {
  const { data: laborCodes = [] } = useQuery<LaborCode[]>({
    queryKey: ["/api/labor-codes"],
    queryFn: () => apiRequest("GET", "/api/labor-codes").then(r => r.json()),
  });

  const form = useForm<InsertServiceRecord>({
    defaultValues: {
      boatId, date: new Date().toISOString().split("T")[0],
      description: "", techNotes: "", laborHours: undefined, laborRate: 110,
      cost: undefined, status: "open", depositAmount: undefined, paid: false,
      ...defaultValues,
    },
  });

  const applyLaborCode = (id: string) => {
    const code = laborCodes.find(c => c.id === Number(id));
    if (code) {
      form.setValue("description", code.description);
      form.setValue("laborHours", code.hours);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
        {laborCodes.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1 block">Quick-fill from Saved Job</label>
            <Select onValueChange={applyLaborCode}>
              <SelectTrigger data-testid="select-labor-code"><SelectValue placeholder="Pick a saved job…" /></SelectTrigger>
              <SelectContent>
                {laborCodes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.description} ({c.hours} hrs)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <FormField control={form.control} name="date" rules={{ required: true }} render={({ field }) => (
          <FormItem><FormLabel>Date *</FormLabel>
            <FormControl><Input type="date" {...field} data-testid="input-service-date" /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="description" rules={{ required: "Required" }} render={({ field }) => (
          <FormItem><FormLabel>Service Description *</FormLabel>
            <FormControl>
              <textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[70px]"
                placeholder="e.g. Annual engine service, oil change…" {...field} data-testid="input-service-description" />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="techNotes" render={({ field }) => (
          <FormItem><FormLabel>Tech Notes</FormLabel>
            <FormControl>
              <textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[50px]"
                placeholder="Internal notes…" {...field} value={field.value ?? ""} data-testid="input-tech-notes" />
            </FormControl>
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="laborHours" render={({ field }) => (
            <FormItem><FormLabel>Labor Hours</FormLabel>
              <FormControl><Input type="number" step="0.5" placeholder="2.5" {...field} value={field.value ?? ""}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-labor-hours" /></FormControl>
          </FormItem>)} />
          <FormField control={form.control} name="laborRate" render={({ field }) => (
            <FormItem><FormLabel>Rate ($/hr)</FormLabel>
              <FormControl><Input type="number" step="5" placeholder="110" {...field} value={field.value ?? ""}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
          </FormItem>)} />
          <FormField control={form.control} name="cost" render={({ field }) => (
            <FormItem><FormLabel>Total Cost ($)</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="350.00" {...field} value={field.value ?? ""}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-cost" /></FormControl>
          </FormItem>)} />
          <FormField control={form.control} name="depositAmount" render={({ field }) => (
            <FormItem><FormLabel>Deposit ($)</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="100.00" {...field} value={field.value ?? ""}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
          </FormItem>)} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>
          </FormItem>)} />
          <FormField control={form.control} name="paid" render={({ field }) => (
            <FormItem className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)}
                  className="rounded border-input w-4 h-4 accent-primary" />
                <span className="text-sm font-medium">Paid</span>
              </label>
          </FormItem>)} />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-service">
            {isPending ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium mt-0.5">{value}</dd></div>;
}

export default function BoatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const boatId = Number(id);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ServiceRecord | null>(null);
  const [expandedService, setExpandedService] = useState<number | null>(null);
  const [stickyOpen, setStickyOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editBoatOpen, setEditBoatOpen] = useState(false);
  const [stickyText, setStickyText] = useState("");
  const [newReminder, setNewReminder] = useState({ label: "", dueDate: "" });
  const { toast } = useToast();

  const { data: boat, isLoading: loadingBoat } = useQuery<Boat>({
    queryKey: ["/api/boats", boatId],
    queryFn: () => apiRequest("GET", `/api/boats/${boatId}`).then(r => r.json()),
  });
  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", boat?.customerId],
    queryFn: () => apiRequest("GET", `/api/customers/${boat!.customerId}`).then(r => r.json()),
    enabled: !!boat?.customerId,
  });
  const { data: records = [], isLoading: loadingRecords } = useQuery<ServiceRecord[]>({
    queryKey: ["/api/boats", boatId, "service"],
    queryFn: () => apiRequest("GET", `/api/boats/${boatId}/service`).then(r => r.json()),
  });
  const { data: atAGlance, isLoading: loadingAtAGlance } = useQuery<BoatAtAGlance>({
    queryKey: ["/api/boats", boatId, "at-a-glance"],
    queryFn: () => apiRequest("GET", `/api/boats/${boatId}/at-a-glance`).then(r => r.json()),
    enabled: !!boatId,
  });
  // Fetch parts for expanded service
  const { data: expandedParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/service", expandedService, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${expandedService}/parts`).then(r => r.json()),
    enabled: expandedService !== null,
  });

  const updateBoatMutation = useMutation({
    mutationFn: (data: Partial<Boat>) => apiRequest("PATCH", `/api/boats/${boatId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/boats", boatId] }),
  });
  const createMutation = useMutation({
    mutationFn: (data: InsertServiceRecord) => apiRequest("POST", `/api/boats/${boatId}/service`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/boats", boatId, "service"] }); setAddServiceOpen(false); toast({ title: "Service record added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ recId, data }: { recId: number; data: Partial<InsertServiceRecord> }) => apiRequest("PATCH", `/api/service/${recId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/boats", boatId, "service"] }); setEditRecord(null); toast({ title: "Record updated" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (recId: number) => apiRequest("DELETE", `/api/service/${recId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/boats", boatId, "service"] }); toast({ title: "Record removed" }); },
  });

  const reminders: Reminder[] = boat ? JSON.parse(boat.reminders ?? "[]") : [];

  const saveSticky = () => {
    updateBoatMutation.mutate({ stickyNote: stickyText });
    setStickyOpen(false);
    toast({ title: "Note saved" });
  };
  const openSticky = () => { setStickyText(boat?.stickyNote ?? ""); setStickyOpen(true); };

  const addReminder = () => {
    if (!newReminder.label) return;
    const updated = [...reminders, { ...newReminder, done: false }];
    updateBoatMutation.mutate({ reminders: JSON.stringify(updated) });
    setNewReminder({ label: "", dueDate: "" });
    setReminderOpen(false);
    toast({ title: "Reminder added" });
  };
  const toggleReminder = (idx: number) => {
    const updated = reminders.map((r, i) => i === idx ? { ...r, done: !r.done } : r);
    updateBoatMutation.mutate({ reminders: JSON.stringify(updated) });
  };
  const deleteReminder = (idx: number) => {
    const updated = reminders.filter((_, i) => i !== idx);
    updateBoatMutation.mutate({ reminders: JSON.stringify(updated) });
  };

  usePageTitle(boat ? [boat.year, boat.make, boat.model].filter(Boolean).join(" ") : "Boat");

  if (loadingBoat) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (!boat) return <div className="text-center py-16"><p className="text-muted-foreground">Boat not found.</p></div>;

  const totalCost = records.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalHours = records.reduce((s, r) => s + (r.laborHours ?? 0), 0);
  const openJobs = records.filter(r => r.status === "open").length;
  void totalHours;
  void totalCost;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
        <Link href="/customers" className="hover:text-foreground transition-colors">Customers</Link>
        {customer && <><span>/</span><Link href={`/customers/${customer.id}`} className="hover:text-foreground transition-colors">{customer.name}</Link></>}
        <span>/</span><span className="text-foreground">{boat.make} {boat.model}</span>
      </div>

      {/* Boat card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{[boat.year, boat.make, boat.model].filter(Boolean).join(" ")}</h1>
            {customer && <p className="text-sm text-muted-foreground mt-0.5">Owner: {customer.name}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {boat.color && <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">{boat.color}</span>}
            <button
              onClick={() => setEditBoatOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Edit vessel info"
              data-testid="button-edit-boat-info"
            >
              <Settings2 size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* ── Vessel Info ── */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Vessel Info</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Length" value={boat.length ? `${boat.length} ft` : null} />
              <InfoRow label="Color" value={boat.color} />
              <InfoRow label="HIN / Hull ID" value={boat.hullId} />
              <InfoRow label="Registration #" value={boat.registrationNumber} />
              <InfoRow label="Storage Location" value={boat.storageLocation} />
            </dl>
          </div>

          {/* ── Engine Info ── */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Engine Info</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="Make / Model" value={[boat.engineMake, boat.engineModel].filter(Boolean).join(" ") || null} />
              <InfoRow label="Engine Type" value={boat.engineType} />
              <InfoRow label="Horsepower" value={boat.horsepower ? `${boat.horsepower} hp` : null} />
              <InfoRow label="Engine Hours" value={boat.engineHours != null ? `${boat.engineHours} hrs` : null} />
              <InfoRow label="Engine Serial #" value={boat.engineSerial} />
              <InfoRow label="Transom Serial #" value={boat.transomSerial} />
              <InfoRow label="Drive Serial #" value={boat.driveSerial} />
            </dl>
          </div>
        </div>

        {boat.notes && (
          <div className="px-5 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <FileText size={13} className="mt-0.5 shrink-0" />{boat.notes}
            </p>
          </div>
        )}
      </div>

      {/* Sticky note + Reminders row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={openSticky} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 text-left hover:border-amber-400 transition-colors" data-testid="button-sticky-note">
          <StickyNote size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Note</p>
            <p className="text-xs text-amber-800 dark:text-amber-300 line-clamp-2">{boat.stickyNote || "Tap to add a note…"}</p>
          </div>
        </button>
        <button onClick={() => setReminderOpen(true)} className="flex items-start gap-2 bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 transition-colors" data-testid="button-add-reminder">
          <Bell size={15} className="text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold mb-0.5">Reminders</p>
            {reminders.length === 0
              ? <p className="text-xs text-muted-foreground">Tap to add…</p>
              : <p className="text-xs text-muted-foreground">{reminders.filter(r => !r.done).length} pending</p>
            }
          </div>
        </button>
      </div>

      {/* Reminders list */}
      {reminders.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reminders</p>
          <div className="space-y-1.5">
            {reminders.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <button onClick={() => toggleReminder(idx)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" data-testid={`reminder-toggle-${idx}`}>
                  {r.done ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} />}
                </button>
                <span className={`text-sm flex-1 ${r.done ? "line-through text-muted-foreground" : ""}`}>{r.label}</span>
                {r.dueDate && <span className="text-xs text-muted-foreground">{r.dueDate}</span>}
                <button onClick={() => deleteReminder(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-a-glance stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {loadingAtAGlance ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          [
            { label: "Total Services", value: atAGlance?.totalServices ?? records.length, sub: undefined as string | undefined, icon: <Circle size={16} /> },
            {
              label: "Last Service",
              value: atAGlance?.lastServiceDate ?? "—",
              sub: atAGlance?.lastServiceSummary ?? undefined,
              icon: <Clock size={16} />,
            },
            { label: "Engine Hours", value: atAGlance?.engineHours != null ? `${atAGlance.engineHours} hrs` : "—", sub: undefined as string | undefined, icon: <Settings2 size={16} /> },
            {
              label: "Outstanding Balance",
              value: atAGlance && atAGlance.outstandingBalance > 0 ? `$${atAGlance.outstandingBalance.toFixed(2)}` : "$0.00",
              sub: undefined as string | undefined,
              icon: <DollarSign size={16} />,
            },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-primary flex justify-center mb-1">{stat.icon}</div>
              <p className="text-lg font-semibold truncate">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.sub}</p>}
            </div>
          ))
        )}
      </div>

      {/* Service History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Service History</h2>
        <Button size="sm" onClick={() => setAddServiceOpen(true)} data-testid="button-add-service"><Plus size={14} className="mr-1" />Add Record</Button>
      </div>

      {loadingRecords ? (
        <div className="space-y-2"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Clock size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No service records yet</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="service-list">
          {[...records].sort((a, b) => b.date.localeCompare(a.date)).map(rec => {
            const isExpanded = expandedService === rec.id;
            return (
              <div key={rec.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all" data-testid={`card-service-${rec.id}`}>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{rec.date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rec.status]}`}>{rec.status}</span>
                      {!!rec.paid && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>}
                    </div>
                    <p className="font-medium text-sm mt-1">{rec.description}</p>
                    {rec.techNotes && <p className="text-xs text-muted-foreground mt-1">{rec.techNotes}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {rec.laborHours != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} />{rec.laborHours} hrs @ ${rec.laborRate ?? 110}/hr</span>}
                      {rec.cost != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign size={11} />${rec.cost.toFixed(2)}</span>}
                      {rec.depositAmount != null && <span className="text-xs text-muted-foreground">Deposit: ${rec.depositAmount.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => customer && boat && printInvoice(rec, expandedService === rec.id ? expandedParts : [], boat, customer)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Print invoice" data-testid={`button-print-${rec.id}`}>
                      <Printer size={14} />
                    </button>
                    <button onClick={() => setEditRecord(rec)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" data-testid={`button-edit-service-${rec.id}`}><Pencil size={14} /></button>
                    <button onClick={() => deleteMutation.mutate(rec.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-service-${rec.id}`}><Trash2 size={14} /></button>
                    <button onClick={() => setExpandedService(isExpanded ? null : rec.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" data-testid={`button-expand-${rec.id}`}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <PartsSection serviceId={rec.id} />
                    <PhotosSection serviceId={rec.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add Service Record</DialogTitle></DialogHeader>
          <ServiceForm boatId={boatId} onSubmit={data => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editRecord} onOpenChange={o => !o && setEditRecord(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit Service Record</DialogTitle></DialogHeader>
          {editRecord && <ServiceForm boatId={boatId} defaultValues={editRecord} onSubmit={data => updateMutation.mutate({ recId: editRecord.id, data })} isPending={updateMutation.isPending} />}
        </DialogContent>
      </Dialog>

      {/* Sticky note dialog */}
      <Dialog open={stickyOpen} onOpenChange={setStickyOpen}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Boat Note</DialogTitle></DialogHeader>
          <textarea className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none min-h-[120px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="e.g. Call before pickup, waiting on impeller kit…"
            value={stickyText} onChange={e => setStickyText(e.target.value)} data-testid="input-sticky-note" />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setStickyOpen(false)}>Cancel</Button>
            <Button onClick={saveSticky}>Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Boat Info dialog */}
      <Dialog open={editBoatOpen} onOpenChange={setEditBoatOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Vessel Info</DialogTitle></DialogHeader>
          <BoatEditForm boat={boat} onSave={data => { updateBoatMutation.mutate(data); setEditBoatOpen(false); toast({ title: "Vessel updated" }); }} />
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Reminder *</label>
              <Input className="mt-1" placeholder="e.g. Impeller due next season" value={newReminder.label}
                onChange={e => setNewReminder(r => ({ ...r, label: e.target.value }))} data-testid="input-reminder-label" />
            </div>
            <div><label className="text-sm font-medium">Due Date (optional)</label>
              <Input type="date" className="mt-1" value={newReminder.dueDate}
                onChange={e => setNewReminder(r => ({ ...r, dueDate: e.target.value }))} data-testid="input-reminder-date" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
              <Button onClick={addReminder} disabled={!newReminder.label}>Add Reminder</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Parts History ── */}
      <BoatPartsHistory boatId={boat!.id} />
    </div>
  );
}

// ─── Boat Parts History ───────────────────────────────────────────────────
type PartHistoryItem = {
  id: number; partNumber: string | null; description: string;
  quantity: number; unitPrice: number; serviceRecordId: number; woDate: string | null;
};

function BoatPartsHistory({ boatId }: { boatId: number }) {
  const [search, setSearch] = useState("");
  const { data: parts = [], isLoading } = useQuery<PartHistoryItem[]>({
    queryKey: ["/api/boats", boatId, "parts-history"],
    queryFn: () => apiRequest("GET", `/api/boats/${boatId}/parts-history`).then(r => r.json()),
  });
  const filtered = search
    ? parts.filter(p =>
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        (p.partNumber ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : parts;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Parts History</h2>
        {parts.length > 0 && (
          <Input
            placeholder="Search parts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs w-40"
          />
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{search ? "No parts match your search" : "No parts used on this boat yet"}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.description}</p>
                {p.partNumber && <p className="font-mono text-xs text-muted-foreground">#{p.partNumber}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Qty {p.quantity} &bull; ${p.unitPrice.toFixed(2)}</p>
                {p.woDate && <p className="text-xs text-muted-foreground">{p.woDate}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ComboField ──────────────────────────────────────────────────────────────
function ComboField({
  label, value, onChange, options, placeholder = "", required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setInput(value ?? ""); }, [value]);
  const filtered = options.filter(o => o.toLowerCase().includes(input.toLowerCase()));
  const select = (v: string) => { setInput(v); onChange(v); setOpen(false); };
  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) { onChange(input); setOpen(false); }
  };
  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <p className="text-sm font-medium leading-none mb-1.5">{label}{required && " *"}</p>
      <input
        type="text" value={input} placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-auto">
          {filtered.map(opt => (
            <button key={opt} type="button" onMouseDown={e => { e.preventDefault(); select(opt); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${opt === input ? "bg-accent/50 font-semibold" : ""}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Boat edit form (for boat-detail page) ─────────────────────────────────
function BoatEditForm({ boat, onSave }: { boat: Boat; onSave: (data: Partial<Boat>) => void }) {
  const form = useForm<any>({
    defaultValues: {
      make: boat.make ?? "",
      model: boat.model ?? "",
      year: boat.year ?? "",
      color: boat.color ?? "",
      length: boat.length ?? "",
      engineType: boat.engineType ?? "",
      engineMake: boat.engineMake ?? "",
      engineModel: boat.engineModel ?? "",
      engineHours: boat.engineHours ?? "",
      horsepower: boat.horsepower ?? "",
      engineSerial: boat.engineSerial ?? "",
      transomSerial: boat.transomSerial ?? "",
      driveSerial: boat.driveSerial ?? "",
      hullId: boat.hullId ?? "",
      registrationNumber: boat.registrationNumber ?? "",
      storageLocation: boat.storageLocation ?? "",
      notes: boat.notes ?? "",
    },
  });
  const submit = (data: any) => {
    onSave({
      ...data,
      year: data.year ? Number(data.year) : null,
      length: data.length ? Number(data.length) : null,
      engineHours: data.engineHours ? Number(data.engineHours) : null,
      horsepower: data.horsepower ? Number(data.horsepower) : null,
    });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="make" rules={{ required: "Make is required" }} render={({ field }) => (
            <FormItem>
              <FormControl>
                <ComboField label="Make" required value={field.value ?? ""} onChange={field.onChange} placeholder="Type or select..."
                  options={["Sea Ray","Bayliner","Boston Whaler","Malibu","MasterCraft","Grady-White","Ranger","Lund","Tracker","Crestliner","Chaparral","Cobalt","Regal","Four Winns","Larson","Stratos","Triton","Yamaha","Kawasaki","Polaris","Alumacraft","Nitro","Skeeter","Wellcraft","Contender","Pursuit","Robalo","Scout","Tidewater","Carolina Skiff","Other"]} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="model" render={({ field }) => (
            <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="year" render={({ field }) => (
            <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" placeholder="2022" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="color" render={({ field }) => (
            <FormItem><FormLabel>Color</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="length" render={({ field }) => (
            <FormItem><FormLabel>Length (ft)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="engineType" render={({ field }) => (
            <FormItem>
              <FormControl>
                <ComboField label="Engine Type" value={field.value ?? ""} onChange={field.onChange} placeholder="Type or select..."
                  options={["Outboard","Sterndrive","Inboard","Jet Drive","Electric","Other"]} />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="engineMake" render={({ field }) => (
            <FormItem>
              <FormControl>
                <ComboField label="Engine Make" value={field.value ?? ""} onChange={field.onChange} placeholder="Type or select..."
                  options={["Yamaha","Mercury","Evinrude","Honda","Suzuki","Volvo Penta","MerCruiser","OMC","Johnson","Tohatsu","BRP","Mercruiser","Crusader","PCM","Indmar","Ilmor","Minn Kota","Other"]} />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="engineModel" render={({ field }) => (
            <FormItem><FormLabel>Engine Model</FormLabel><FormControl><Input placeholder="e.g. F150" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="engineHours" render={({ field }) => (
            <FormItem><FormLabel>Engine Hours</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="horsepower" render={({ field }) => (
            <FormItem><FormLabel>Horsepower</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Serial Numbers</p>
        <div className="grid grid-cols-1 gap-3">
          <FormField control={form.control} name="engineSerial" render={({ field }) => (
            <FormItem><FormLabel>Engine Serial #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="transomSerial" render={({ field }) => (
            <FormItem><FormLabel>Transom Serial #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="driveSerial" render={({ field }) => (
            <FormItem><FormLabel>Drive Serial #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Identification</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="hullId" render={({ field }) => (
            <FormItem><FormLabel>HIN / Hull ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="registrationNumber" render={({ field }) => (
            <FormItem><FormLabel>Registration #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="storageLocation" render={({ field }) => (
          <FormItem><FormLabel>Storage Location</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl>
            <textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[60px]" {...field} />
          </FormControl></FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Form>
  );
}
