import EditableField from "@/components/ProtectedField";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  ChevronLeft, Printer, Wrench, Clock, DollarSign, Package, Download,
  User, Anchor, MapPin, Hash, CheckCircle2, CircleDot, Truck,
  FileText, Mail, X, Check, Plus, Trash2, PenLine, AlertTriangle,
  PhoneCall, ChevronRight, ChevronDown, ChevronUp, BookOpen,
  MoreVertical, Zap, ListChecks, Link2, Copy, FileDown, PenTool,
} from "lucide-react";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useEffect } from "react";
import type { Part, PartsCatalog, WorkOrderJob, CommonJob } from "@shared/schema";
import { BRAND, BRAND_LOGO_DATA_URL } from "@shared/brand";
import { SignaturePad } from "@/components/SignaturePad";
import { useKeybind, useClickBind } from "@/lib/keybind-provider";

// ─── Types ─────────────────────────────────────────────────────────────────────
type OpenJob = {
  id: number; status: string; description: string; date: string;
  techNotes: string | null; laborHours: number | null; laborRate: number | null;
  cost: number | null; depositAmount: number | null; paid: boolean;
  customerName: string; customerPhone: string | null; customerEmail: string | null; customerAddress: string | null; customerNotes: string | null;
  boatId: number; boatMake: string; boatModel: string; boatYear: number | null;
  boatColor: string | null; boatEngineType: string | null;
  boatEngineMake: string | null; boatEngineModel: string | null;
  boatEngineHours: number | null; boatHullId: string | null;
  boatRegistration: string | null; boatStorageLocation: string | null;
  dueDate: string | null;
  signatureDataUrl?: string | null; signedBy?: string | null; signedAt?: string | null;
};

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_ORDER = ["open", "waiting_on_parts", "ready_for_pickup", "complete", "invoiced"];
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  waiting_on_parts: "Waiting on Parts",
  ready_for_pickup: "Ready for Pickup",
  complete: "Complete",
  invoiced: "Invoiced",
};
const STATUS_COLORS: Record<string, string> = {
  open:             "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  waiting_on_parts: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  ready_for_pickup: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  complete:         "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  invoiced:         "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
};
const NEXT_STATUS: Record<string, string> = {
  open: "waiting_on_parts", waiting_on_parts: "ready_for_pickup",
  ready_for_pickup: "complete", complete: "invoiced",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  open:        "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  complete:    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
};

// ─── Duplicate Work Order dialog (Feature D) ──────────────────────────────────────
interface DupBoat { id: number; make: string; model: string | null; year: number | null; }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DuplicateWODialog({ open, onOpenChange, job, workOrderId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: OpenJob;
  workOrderId: number;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [boatId, setBoatId] = useState<number>(job.boatId);
  const [date, setDate] = useState<string>(todayISO());

  useEffect(() => {
    if (open) { setBoatId(job.boatId); setDate(todayISO()); }
  }, [open, job.boatId]);

  const { data: boat } = useQuery<{ customerId: number }>({
    queryKey: ["/api/boats", job.boatId],
    queryFn: () => apiRequest("GET", `/api/boats/${job.boatId}`).then(r => r.json()),
    enabled: open,
  });

  const { data: boats = [] } = useQuery<DupBoat[]>({
    queryKey: ["/api/customers", boat?.customerId, "boats"],
    queryFn: () => apiRequest("GET", `/api/customers/${boat!.customerId}/boats`).then(r => r.json()),
    enabled: open && !!boat?.customerId,
  });

  const cloneMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/work-orders/${workOrderId}/clone`, { boatId, date }).then(r => r.json()),
    onSuccess: (created: any) => {
      toast({ title: "Work order duplicated" });
      onOpenChange(false);
      navigate(`/jobs/${created.id}`);
    },
    onError: (err: any) => toast({ title: err?.message ?? "Failed to duplicate work order", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicate Work Order</DialogTitle>
          <DialogDescription>Create a new work order with the same customer, jobs, and parts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Boat</label>
            <select
              value={boatId}
              onChange={e => setBoatId(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              data-testid="select-duplicate-boat"
            >
              {boats.length > 0 ? boats.map(b => (
                <option key={b.id} value={b.id}>{[b.year, b.make, b.model].filter(Boolean).join(" ")}</option>
              )) : (
                <option value={job.boatId}>{[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ")}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-duplicate-date" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending} data-testid="button-confirm-duplicate">
            {cloneMutation.isPending ? "Duplicating..." : "Create Duplicate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Print helpers ─────────────────────────────────────────────────────────────
const BBC_PHONE = BRAND.phone;
const BBC_EMAIL = BRAND.email;

const CUSTOMER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: ${BRAND.ink}; font-size: 13px; line-height: 1.55; background: #fff; }
  .page { max-width: 780px; margin: 0 auto; padding: 0 0 48px 0; }

  /* ── Header: logo + business, document number ── */
  .header-band { padding: 26px 40px 18px; }
  .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand-logo { width: 92px; height: 92px; border-radius: 50%; display: block; }
  .brand-name { font-size: 25px; font-weight: 900; letter-spacing: .01em; text-transform: uppercase; color: ${BRAND.navy}; line-height: 1.1; }
  .brand-tagline { font-size: 10px; font-weight: 700; color: ${BRAND.blue}; margin-top: 4px; text-transform: uppercase; letter-spacing: .14em; }
  .brand-contact { font-size: 11px; color: ${BRAND.muted}; margin-top: 7px; line-height: 1.7; }
  .doc-title { text-align: right; flex-shrink: 0; }
  .doc-type { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .16em; color: #fff; background: ${BRAND.navy}; padding: 4px 10px; border-radius: 3px; margin-bottom: 6px; }
  .doc-num { font-size: 28px; font-weight: 900; color: ${BRAND.navy}; letter-spacing: -.5px; line-height: 1.1; }
  .doc-meta { font-size: 10.5px; color: ${BRAND.muted}; margin-top: 5px; line-height: 1.8; }
  .doc-meta strong { color: ${BRAND.ink}; }
  .header-rule { height: 6px; background: ${BRAND.navy}; border-bottom: 3px solid ${BRAND.blue}; box-sizing: content-box; }

  /* ── Body padding ── */
  .body-pad { padding: 0 40px; }

  /* ── Banner ── */
  .banner { text-align: center; font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
    padding: 6px 12px; background: ${BRAND.navy}; color: #fff; }

  /* ── Info grid ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 22px 0 20px; }
  .info-box, .info-box-full { background: ${BRAND.navyTint}; border: 1px solid ${BRAND.rule}; border-radius: 8px; padding: 13px 15px; border-top: 3px solid ${BRAND.navy}; }
  .info-box-full { grid-column: 1 / -1; border-top-color: ${BRAND.blue}; background: ${BRAND.blueTint}; }
  .box-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: ${BRAND.blue}; margin-bottom: 6px; }
  .box-primary { font-size: 14px; font-weight: 700; color: ${BRAND.navy}; }
  .box-row { font-size: 11.5px; color: #39445c; margin-top: 3px; }

  /* ── Section label ── */
  .section-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; color: ${BRAND.navy}; margin-bottom: 8px; display: flex; align-items: center; gap: 7px; }
  .section-label::after { content: ''; flex: 1; height: 2px; background: ${BRAND.blue}; opacity: .35; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #fff; background: ${BRAND.navy}; padding: 8px 9px; text-align: left; }
  tbody td { padding: 8px 9px; border-bottom: 1px solid #e6eaf2; font-size: 12px; vertical-align: top; color: #1c2740; }
  .right { text-align: right; }
  .mono { font-family: 'Courier New', monospace; font-size: 10.5px; color: ${BRAND.muted}; }

  /* ── Job grouping: keep each job together on the same page ── */
  .job-block { page-break-inside: avoid; break-inside: avoid; }

  /* ── Job header row ── */
  .job-header td { background: ${BRAND.blueTint}; font-weight: 800; font-size: 12.5px; color: ${BRAND.navy}; padding: 10px 9px; border-top: 2px solid ${BRAND.blue}; border-bottom: 1px solid ${BRAND.rule}; }
  .job-sub td { background: ${BRAND.navyTint}; font-size: 11px; color: ${BRAND.navy}; font-weight: 700; padding: 5px 9px; border-bottom: 1px solid ${BRAND.rule}; }
  .job-notes td { background: ${BRAND.navyTint}; font-size: 11px; padding: 3px 9px 7px 24px; border-bottom: 1px solid #e6eaf2; font-style: italic; color: #39445c; }
  .indent td { padding-left: 24px; }

  /* Labor vs Parts row distinction (customer copy only) */
  .labor-row td { background: #fff; padding-left: 24px; }
  .labor-row td:first-child { border-left: 3px solid ${BRAND.blue}; }
  .labor-label td { background: #fff; font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .12em; color: ${BRAND.blue}; padding: 6px 9px 3px 24px; border-bottom: none; }
  .parts-row td { background: #fff; padding-left: 24px; }
  .parts-row td:first-child { border-left: 3px solid ${BRAND.navy}; }
  .parts-label td { background: #fff; font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .12em; color: ${BRAND.navy}; padding: 6px 9px 3px 24px; border-bottom: none; }

  /* ── Totals block (div-based, renders once after table) ── */
  .totals-block { width: 300px; margin: 14px 0 0 auto; border: 1px solid ${BRAND.rule}; border-radius: 8px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12.5px; color: #39445c; }
  .totals-row.total-labor, .totals-row.total-parts { border-bottom: 1px solid #e6eaf2; }
  .totals-row.grand-total { font-weight: 800; font-size: 15px; padding: 10px 12px; background: ${BRAND.navyTint}; color: ${BRAND.navy}; border-top: 2px solid ${BRAND.navy}; }
  .totals-row.deposit { font-size: 12px; color: ${BRAND.muted}; border-top: 1px dashed ${BRAND.rule}; }
  .totals-row.balance { font-weight: 900; font-size: 15px; color: #fff; padding: 11px 12px; background: ${BRAND.navy}; border-top: 3px solid ${BRAND.blue}; }

  /* ── Customer notes box ── */
  .customer-note-box { background: ${BRAND.blueTint}; border: 1px solid ${BRAND.rule}; border-radius: 6px; padding: 10px 13px; margin: 0; }
  .customer-note-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: ${BRAND.blue}; margin-bottom: 4px; }
  .customer-note-body { font-size: 12px; color: #1c2740; line-height: 1.6; white-space: pre-wrap; }

  /* ── Signature block ── */
  .sig-block { display: flex; gap: 36px; margin-top: 36px; margin-bottom: 20px; }
  .sig-line { flex: 1; }
  .sig-rule { border-top: 1px solid ${BRAND.navy}; margin-bottom: 5px; }
  .sig-caption { font-size: 10px; color: ${BRAND.muted}; }

  /* ── Footer ── */
  .footer { border-top: 2px solid ${BRAND.navy}; padding-top: 12px; font-size: 10px; color: ${BRAND.muted}; text-align: center; margin-top: 16px; line-height: 1.7; }
  .footer strong { color: ${BRAND.navy}; }

  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding-bottom: 20px; }
  }
`;

// Customer-copy header: logo badge + business details on the left, document number on the right.
function customerHeaderHtml(woNum: string, job: OpenJob): string {
  return `<div class="banner">Customer Copy</div>
  <div class="header-band">
    <div class="header-inner">
      <div class="brand">
        <img class="brand-logo" src="${BRAND_LOGO_DATA_URL}" alt="${BRAND.name} logo">
        <div>
          <div class="brand-name">${esc(BRAND.name)}</div>
          <div class="brand-tagline">${BRAND.tagline} &bull; ${BRAND.town}</div>
          <div class="brand-contact">${BRAND.phone} &bull; ${BRAND.email}<br>${BRAND.website}</div>
        </div>
      </div>
      <div class="doc-title">
        <div class="doc-type">Work Order</div>
        <div class="doc-num">${woNum}</div>
        <div class="doc-meta">Date: <strong>${esc(job.date)}</strong>${job.dueDate ? `<br>Due: <strong>${esc(job.dueDate)}</strong>` : ""}<br>Status: ${esc(STATUS_LABELS[job.status] ?? job.status ?? "Open")}</div>
      </div>
    </div>
  </div>
  <div class="header-rule"></div>`;
}

const CUSTOMER_FOOTER = `<div class="footer"><strong>${esc(BRAND.name)}</strong> &bull; ${BRAND.tagline} &bull; ${BRAND.town}<br>${BRAND.phone} &bull; ${BRAND.email} &bull; ${BRAND.website}<br>Thank you for your business.</div>`;

const TECH_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 13px; line-height: 1.55; background: #fff; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 48px; }
  .header-band { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 20px; border-bottom: 3px solid #076579; margin-bottom: 24px; }
  .brand-name { font-size: 24px; font-weight: 800; letter-spacing: -.5px; color: #076579; }
  .brand-tagline { font-size: 11px; color: #666; margin-top: 3px; text-transform: uppercase; letter-spacing: .06em; }
  .brand-contact { font-size: 11.5px; color: #444; margin-top: 6px; line-height: 1.7; }
  .doc-title { text-align: right; }
  .doc-type { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #076579; margin-bottom: 4px; }
  .doc-num { font-size: 26px; font-weight: 800; color: #111; letter-spacing: -.5px; }
  .doc-meta { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.8; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  .info-box { background: #f7f9fa; border: 1px solid #dde4e8; border-radius: 7px; padding: 13px 16px; }
  .info-box-full { grid-column: 1 / -1; background: #f7f9fa; border: 1px solid #dde4e8; border-radius: 7px; padding: 13px 16px; }
  .box-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: #076579; margin-bottom: 7px; }
  .box-primary { font-size: 14px; font-weight: 700; }
  .box-row { font-size: 11.5px; color: #444; margin-top: 3px; }
  .notes-box { border-radius: 7px; padding: 13px 16px; margin-bottom: 18px; }
  .notes-box.tech-notes { background: #fffbeb; border: 1px solid #f6cc6a; }
  .notes-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; margin-bottom: 6px; }
  .notes-box.tech-notes .notes-label { color: #92400e; }
  .notes-body { font-size: 12.5px; white-space: pre-wrap; color: #222; line-height: 1.6; }
  .section-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: #076579; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #666; border-bottom: 1.5px solid #ccd3d8; padding: 6px 8px; text-align: left; }
  tbody td { padding: 8px 8px; border-bottom: 1px solid #eaedf0; font-size: 12px; vertical-align: top; }
  .right { text-align: right; }
  .mono { font-family: 'Courier New', monospace; font-size: 11px; color: #666; }
  .job-header td { background: #f0f5f7; font-weight: 700; font-size: 12.5px; color: #076579; border-top: 2px solid #dde4e8; border-bottom: 1px solid #dde4e8; padding: 9px 8px; }
  .job-sub td { background: #f9fafb; font-size: 11px; color: #555; font-weight: 600; padding: 5px 8px; border-bottom: 1px solid #eaedf0; }
  .job-notes td { background: #f9fafb; font-size: 11px; padding: 3px 8px 7px 22px; border-bottom: 1px solid #eaedf0; font-style: italic; }
  .indent td { padding-left: 22px; }
  tfoot tr.grand-total td { border-top: 2px solid #076579; font-weight: 800; font-size: 14px; padding: 10px 8px; }
  tfoot tr.deposit td { border-bottom: 1px dashed #ccc; font-size: 12px; color: #555; padding: 6px 8px; }
  tfoot tr.balance td { font-weight: 800; font-size: 14px; color: #076579; padding: 8px 8px; }
  .sig-block { display: flex; gap: 36px; margin-top: 32px; margin-bottom: 24px; }
  .sig-line { flex: 1; }
  .sig-rule { border-top: 1px solid #555; margin-bottom: 5px; }
  .sig-caption { font-size: 10.5px; color: #555; }
  .footer { border-top: 1px solid #dde4e8; padding-top: 12px; font-size: 10.5px; color: #999; text-align: center; }
  .banner { text-align: center; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 6px; border-radius: 5px; margin-bottom: 22px; }
  .banner-tech { background: #076579; color: #fff; }
  @media print { body { margin: 0; } .page { padding: 20px 24px; } }
`;

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmt$(n: number) { return "$" + n.toFixed(2); }

function buildJobRows(woJobs: WorkOrderJob[], allParts: Part[], mode: "customer" | "tech"): { html: string; grandTotal: number; totalLabor: number; totalParts: number } {
  let grandTotal = 0;
  let totalLabor = 0;
  let totalParts = 0;
  const rows: string[] = [];

  if (mode === "customer") {
    // Per-job: each job gets its own <tbody class="job-block"> so page-break-inside:avoid works
    for (let ji = 0; ji < woJobs.length; ji++) {
      const job = woJobs[ji];
      const jobNum = ji + 1;
      const laborCost = job.pricingType === "flat"
        ? (job.flatRate ?? 0)
        : (job.laborHours ?? 0) * (job.laborRate ?? 110);
      const jobParts = allParts.filter(p => (p as any).jobId === job.id);
      const partsCost = jobParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
      grandTotal += laborCost + partsCost;
      totalLabor += laborCost;
      totalParts += partsCost;

      rows.push(`</tbody><tbody class="job-block">`);
      rows.push(`<tr class="job-header"><td colspan="4">${jobNum}. ${esc(job.title)}</td></tr>`);

      if (job.customerNotes) {
        rows.push(`<tr><td colspan="4" style="padding:5px 8px 8px 8px;border-bottom:1px solid ${BRAND.rule};"><div style="background:${BRAND.navyTint};border:1px solid ${BRAND.rule};border-radius:6px;padding:8px 12px;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${BRAND.blue};margin-bottom:3px;">Notes</div><div style="font-size:12px;color:#1c2740;line-height:1.6;white-space:pre-wrap;">${esc(job.customerNotes)}</div></div></td></tr>`);
      }

      if (laborCost > 0) {
        rows.push(`<tr class="labor-label"><td colspan="4">Labor</td></tr>`);
        if (job.pricingType === "flat") {
          rows.push(`<tr class="labor-row"><td>Flat Rate Labor</td><td class="right">\u2014</td><td class="right">\u2014</td><td class="right">${fmt$(laborCost)}</td></tr>`);
        } else {
          rows.push(`<tr class="labor-row"><td>Labor @ ${fmt$(job.laborRate ?? 110)}/hr</td><td class="right">${job.laborHours} hrs</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(laborCost)}</td></tr>`);
        }
      }

      if (jobParts.length > 0) {
        rows.push(`<tr class="parts-label"><td colspan="4">Parts &amp; Materials</td></tr>`);
        for (const p of jobParts) {
          const lt = p.quantity * p.unitPrice;
          rows.push(`<tr class="parts-row"><td>${p.partNumber ? `<span class="mono">#${esc(p.partNumber)}</span> ` : ""}${esc(p.description)}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lt)}</td></tr>`);
        }
      }
    }

    // Unassigned parts (jobId not matching any woJob — fold in silently, no extra header)
    const woJobIds = new Set(woJobs.map(j => j.id));
    const unassigned = allParts.filter(p => !(p as any).jobId || !woJobIds.has((p as any).jobId));
    // Remove any already accounted for (matched to a real job above)
    const accountedIds = new Set(woJobs.flatMap(j => allParts.filter(p => (p as any).jobId === j.id).map(p => p.id)));
    const trueUnassigned = unassigned.filter(p => !accountedIds.has(p.id));
    if (trueUnassigned.length > 0) {
      rows.push(`<tr class="parts-label"><td colspan="4">Additional Parts &amp; Materials</td></tr>`);
      for (const p of trueUnassigned) {
        const lt = p.quantity * p.unitPrice;
        grandTotal += lt;
        totalParts += lt;
        rows.push(`<tr class="parts-row"><td>${p.partNumber ? `<span class="mono">#${esc(p.partNumber)}</span> ` : ""}${esc(p.description)}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lt)}</td></tr>`);
      }
    }

  } else {
    // Tech mode: per-job breakdown (unchanged)
    for (const job of woJobs) {
      const laborCost = job.pricingType === "flat"
        ? (job.flatRate ?? 0)
        : (job.laborHours ?? 0) * (job.laborRate ?? 110);
      const jobParts = allParts.filter(p => (p as any).jobId === job.id);
      const partsCost = jobParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
      const jobTotal = laborCost + partsCost;
      grandTotal += jobTotal;
      totalLabor += laborCost;
      totalParts += partsCost;

      rows.push(`<tr class="job-header"><td colspan="4">${esc(job.title)}</td></tr>`);

      if (job.techNotes) {
        rows.push(`<tr class="job-notes"><td colspan="4" style="color:#92400e">${esc(job.techNotes)}</td></tr>`);
      }

      if (laborCost > 0) {
        if (job.pricingType === "flat") {
          rows.push(`<tr class="indent"><td>Flat Rate Labor</td><td class="right">\u2014</td><td class="right">\u2014</td><td class="right">${fmt$(laborCost)}</td></tr>`);
        } else {
          rows.push(`<tr class="indent"><td>Labor @ ${fmt$(job.laborRate ?? 110)}/hr</td><td class="right">${job.laborHours} hrs</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(laborCost)}</td></tr>`);
        }
      }

      for (const p of jobParts) {
        const lt = p.quantity * p.unitPrice;
        rows.push(`<tr class="indent"><td>${p.partNumber ? `<span class="mono">#${esc(p.partNumber)}</span> ` : ""}${esc(p.description)}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lt)}</td></tr>`);
      }

      rows.push(`<tr class="job-sub"><td colspan="3" class="right">Job Subtotal</td><td class="right">${fmt$(jobTotal)}</td></tr>`);
    }

    const unassigned = allParts.filter(p => !(p as any).jobId);
    if (unassigned.length > 0) {
      rows.push(`<tr class="job-header"><td colspan="4" style="color:#555">Other Charges</td></tr>`);
      for (const p of unassigned) {
        const lt = p.quantity * p.unitPrice;
        grandTotal += lt;
        totalParts += lt;
        rows.push(`<tr class="indent"><td>${esc(p.description)}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lt)}</td></tr>`);
      }
    }
  }

  return { html: rows.join("\n"), grandTotal, totalLabor, totalParts };
}

async function printCustomer(job: OpenJob, lineParts: Part[], woJobs: WorkOrderJob[]) {
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const { html: rows, grandTotal, totalLabor, totalParts } = buildJobRows(woJobs, lineParts, "customer");
  const legacyLabor = woJobs.length === 0 ? (job.laborHours ?? 0) * (job.laborRate ?? 110) : 0;
  const subtotal = grandTotal + legacyLabor;
  const deposit = job.depositAmount ?? 0;
  const balance = subtotal - deposit;
  const boatLine = [job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "\u2014";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer Copy \u2014 ${woNum}</title>
<style>${CUSTOMER_CSS}</style></head>
<body><div class="page">

  ${customerHeaderHtml(woNum, job)}

  <div class="body-pad">

    <div class="info-grid">
      <div class="info-box">
        <div class="box-label">Customer</div>
        <div class="box-primary">${esc(job.customerName)}</div>
        ${job.customerPhone ? `<div class="box-row">${esc(job.customerPhone)}</div>` : ""}
        ${job.customerEmail ? `<div class="box-row">${esc(job.customerEmail)}</div>` : ""}
        ${job.customerAddress ? `<div class="box-row">${esc(job.customerAddress)}</div>` : ""}
        ${job.customerNotes ? `<div class="box-row" style="font-style:italic;color:${BRAND.muted};margin-top:3px;">${esc(job.customerNotes)}</div>` : ""}
      </div>
      <div class="info-box">
        <div class="box-label">Vessel</div>
        <div class="box-primary">${esc(boatLine)}</div>
        ${job.boatColor ? `<div class="box-row">Color: ${esc(job.boatColor)}</div>` : ""}
        ${job.boatEngineMake ? `<div class="box-row">Engine: ${esc(job.boatEngineMake)}${job.boatEngineModel ? " " + esc(job.boatEngineModel) : ""}</div>` : ""}
        ${job.boatHullId ? `<div class="box-row">HIN: <span style="font-family:monospace">${esc(job.boatHullId)}</span></div>` : ""}
        ${job.boatRegistration ? `<div class="box-row">Reg: ${esc(job.boatRegistration)}</div>` : ""}
      </div>
      ${job.description ? `<div class="info-box-full"><div class="box-label">Work Description</div><div style="font-weight:600;font-size:13px">${esc(job.description)}</div></div>` : ""}
    </div>

    <div class="section-label">Work Performed</div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
      <tbody>
        ${woJobs.length === 0 && legacyLabor > 0 ? `<tr><td>Labor @ ${fmt$(job.laborRate ?? 110)}/hr</td><td class="right">${job.laborHours}</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(legacyLabor)}</td></tr>` : ""}
        ${rows}
      </tbody>
    </table>
    <div class="totals-block">
      ${(totalLabor + legacyLabor) > 0 ? `<div class="totals-row total-labor"><span>Total Labor</span><span>${fmt$(totalLabor + legacyLabor)}</span></div>` : ""}
      ${totalParts > 0 ? `<div class="totals-row total-parts"><span>Total Parts &amp; Materials</span><span>${fmt$(totalParts)}</span></div>` : ""}
      <div class="totals-row grand-total"><span>Total</span><span>${fmt$(subtotal)}</span></div>
      ${deposit > 0 ? `<div class="totals-row deposit"><span>Deposit Received</span><span>- ${fmt$(deposit)}</span></div><div class="totals-row balance"><span>Balance Due</span><span>${fmt$(balance)}</span></div>` : ""}
    </div>

    <div class="sig-block">
      <div class="sig-line"><div class="sig-rule"></div><div class="sig-caption">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>
      <div class="sig-line"><div class="sig-rule"></div><div class="sig-caption">Authorized By &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>
    </div>

    ${CUSTOMER_FOOTER}

  </div>

</div></body></html>`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Mobile browsers block blob: URLs in new tabs — fall through to PDF download
    await downloadCustomerPDF(job, lineParts, woJobs);
    return;
  }
  // Desktop: write into a hidden iframe and trigger the print dialog
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
}

async function downloadCustomerPDF(job: OpenJob, lineParts: Part[], woJobs: WorkOrderJob[]) {
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const { html: rows, grandTotal, totalLabor, totalParts } = buildJobRows(woJobs, lineParts, "customer");
  const legacyLabor = woJobs.length === 0 ? (job.laborHours ?? 0) * (job.laborRate ?? 110) : 0;
  const subtotal = grandTotal + legacyLabor;
  const deposit = job.depositAmount ?? 0;
  const balance = subtotal - deposit;
  const boatLine = [job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Customer Copy — ${woNum}</title>
<style>${CUSTOMER_CSS}</style></head>
<body><div class="page">

  ${customerHeaderHtml(woNum, job)}

  <div class="body-pad">

    <div class="info-grid">
      <div class="info-box">
        <div class="box-label">Customer</div>
        <div class="box-primary">${esc(job.customerName)}</div>
        ${job.customerPhone ? `<div class="box-row">${esc(job.customerPhone)}</div>` : ""}
        ${job.customerEmail ? `<div class="box-row">${esc(job.customerEmail)}</div>` : ""}
        ${job.customerAddress ? `<div class="box-row">${esc(job.customerAddress)}</div>` : ""}
        ${job.customerNotes ? `<div class="box-row" style="font-style:italic;color:${BRAND.muted};margin-top:3px;">${esc(job.customerNotes)}</div>` : ""}
      </div>
      <div class="info-box">
        <div class="box-label">Vessel</div>
        <div class="box-primary">${esc(boatLine)}</div>
        ${job.boatColor ? `<div class="box-row">Color: ${esc(job.boatColor)}</div>` : ""}
        ${job.boatEngineMake ? `<div class="box-row">Engine: ${esc(job.boatEngineMake)}${job.boatEngineModel ? " " + esc(job.boatEngineModel) : ""}</div>` : ""}
        ${job.boatHullId ? `<div class="box-row">HIN: <span style="font-family:monospace">${esc(job.boatHullId)}</span></div>` : ""}
        ${job.boatRegistration ? `<div class="box-row">Reg: ${esc(job.boatRegistration)}</div>` : ""}
      </div>
      ${job.description ? `<div class="info-box-full"><div class="box-label">Work Description</div><div style="font-weight:600;font-size:13px">${esc(job.description)}</div></div>` : ""}
    </div>

    <div class="section-label">Work Performed</div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
      <tbody>
        ${woJobs.length === 0 && legacyLabor > 0 ? `<tr><td>Labor @ ${fmt$(job.laborRate ?? 110)}/hr</td><td class="right">${job.laborHours}</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(legacyLabor)}</td></tr>` : ""}
        ${rows}
      </tbody>
    </table>
    <div class="totals-block">
      ${(totalLabor + legacyLabor) > 0 ? `<div class="totals-row total-labor"><span>Total Labor</span><span>${fmt$(totalLabor + legacyLabor)}</span></div>` : ""}
      ${totalParts > 0 ? `<div class="totals-row total-parts"><span>Total Parts &amp; Materials</span><span>${fmt$(totalParts)}</span></div>` : ""}
      <div class="totals-row grand-total"><span>Total</span><span>${fmt$(subtotal)}</span></div>
      ${deposit > 0 ? `<div class="totals-row deposit"><span>Deposit Received</span><span>- ${fmt$(deposit)}</span></div><div class="totals-row balance"><span>Balance Due</span><span>${fmt$(balance)}</span></div>` : ""}
    </div>

    <div class="sig-block">
      <div class="sig-line"><div class="sig-rule"></div><div class="sig-caption">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>
      <div class="sig-line"><div class="sig-rule"></div><div class="sig-caption">Authorized By &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div></div>
    </div>

    ${CUSTOMER_FOOTER}

  </div>

</div></body></html>`;

  const res = await apiRequest("POST", "/api/html-to-pdf", { html, filename: `${woNum}-customer-copy` });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "PDF generation failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${woNum}-customer-copy.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printTech(job: OpenJob, lineParts: Part[], woJobs: WorkOrderJob[]) {
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const { html: rows, grandTotal } = buildJobRows(woJobs, lineParts, "tech");
  const legacyLabor = woJobs.length === 0 ? (job.laborHours ?? 0) * (job.laborRate ?? 110) : 0;
  const total = grandTotal + legacyLabor;
  const boatLine = [job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Tech Copy \u2014 ${woNum}</title>
<style>${TECH_CSS}</style></head>
<body><div class="page">

  <div class="banner banner-tech">Technician Copy \u2014 Internal Use Only</div>

  <div class="header-band">
    <div>
      <div class="brand-name">Bradley's Boat Care</div>
      <div class="brand-tagline">Marine Service &amp; Repair</div>
      <div class="brand-contact">${BBC_PHONE}<br>${BBC_EMAIL}</div>
    </div>
    <div class="doc-title">
      <div class="doc-type">Work Order</div>
      <div class="doc-num">${woNum}</div>
      <div class="doc-meta">Date: ${esc(job.date)}${job.dueDate ? `<br>Due: ${esc(job.dueDate)}` : ""}<br>Status: ${esc(job.status ?? "open")}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="box-label">Customer</div>
      <div class="box-primary">${esc(job.customerName)}</div>
      ${job.customerPhone ? `<div class="box-row">${esc(job.customerPhone)}</div>` : ""}
      ${job.customerEmail ? `<div class="box-row">${esc(job.customerEmail)}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="box-label">Boat Info</div>
      <div class="box-primary">${esc(boatLine)}</div>
      ${job.boatEngineType ? `<div class="box-row">Type: ${esc(job.boatEngineType)}</div>` : ""}
      ${job.boatEngineMake ? `<div class="box-row">Engine: ${esc(job.boatEngineMake)}${job.boatEngineModel ? " " + esc(job.boatEngineModel) : ""}</div>` : ""}
      ${job.boatEngineHours != null ? `<div class="box-row">Hours: <strong>${job.boatEngineHours}</strong></div>` : ""}
      ${job.boatHullId ? `<div class="box-row">HIN: <span style="font-family:monospace">${esc(job.boatHullId)}</span></div>` : ""}
      ${job.boatStorageLocation ? `<div class="box-row">Storage: <strong>${esc(job.boatStorageLocation)}</strong></div>` : ""}
    </div>
    ${job.description ? `<div class="info-box-full"><div class="box-label">Work to Perform</div><div style="font-weight:700;font-size:13px">${esc(job.description)}</div></div>` : ""}
  </div>

  ${job.techNotes ? `<div class="notes-box tech-notes"><div class="notes-label">Tech Notes (WO Level)</div><div class="notes-body">${esc(job.techNotes)}</div></div>` : ""}

  <div class="section-label">Job Lines</div>
  <table>
    <thead><tr><th>Description</th><th class="right">Qty / Hrs</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${woJobs.length === 0 && legacyLabor > 0 ? `<tr><td>Labor @ ${fmt$(job.laborRate ?? 110)}/hr</td><td class="right">${job.laborHours}</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(legacyLabor)}</td></tr>` : ""}
      ${rows}
    </tbody>
    <tfoot>
      <tr class="grand-total"><td colspan="3">Total</td><td class="right">${fmt$(total)}</td></tr>
      ${job.depositAmount ? `<tr class="deposit"><td colspan="3">Deposit</td><td class="right">- ${fmt$(job.depositAmount)}</td></tr><tr class="balance"><td colspan="3">Balance Due</td><td class="right">${fmt$(total - (job.depositAmount ?? 0))}</td></tr>` : ""}
    </tfoot>
  </table>

  <div class="footer">INTERNAL \u2014 ${woNum} &bull; Bradley's Boat Care</div>

</div><script>window.onload=()=>window.print();</script></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}

// ─── Inline editable field ─────────────────────────────────────────────────────
// ─── Parts section (for a specific job line OR the whole WO) ──────────────────
function PartsSection({ serviceId, jobId }: { serviceId: number; jobId?: number }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [newPart, setNewPart] = useState({ partNumber: "", description: "", quantity: "1", unitPrice: "0" });

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/service", serviceId, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${serviceId}/parts`).then(r => r.json()),
  });

  const lineParts = jobId != null
    ? allParts.filter(p => (p as any).jobId === jobId)
    : allParts.filter(p => !(p as any).jobId);

  const { data: catalog = [] } = useQuery<PartsCatalog[]>({
    queryKey: ["/api/parts-catalog", partSearch],
    queryFn: () => apiRequest("GET", `/api/parts-catalog?q=${encodeURIComponent(partSearch)}`).then(r => r.json()),
    enabled: partSearch.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/service/${serviceId}/parts`, { serviceRecordId: serviceId, ...data }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
      setAdding(false);
      setNewPart({ partNumber: "", description: "", quantity: "1", unitPrice: "0" });
      setPartSearch("");
      toast({ title: "Part added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/parts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] }),
  });

  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ partNumber: "", description: "", quantity: "1", unitPrice: "0" });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/parts/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
      setEditingPartId(null);
    },
  });

  const startEdit = (p: Part) => {
    setEditDraft({
      partNumber: (p as any).partNumber ?? "",
      description: p.description,
      quantity: String(p.quantity),
      unitPrice: String(p.unitPrice),
    });
    setEditingPartId(p.id);
  };

  const subtotal = lineParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

  // Modifier+Click (Batch 2.5 addendum) for part line items: Ctrl+Click duplicates, Alt+Click deletes.
  const handlePartDuplicateClick = useClickBind("wo.line.duplicate", (p: Part) => {
    addMutation.mutate({
      partNumber: (p as any).partNumber ?? null,
      description: `${p.description} (copy)`,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      jobId: jobId ?? null,
    });
  });
  const handlePartDeleteClick = useClickBind("wo.line.delete", (p: Part) => deleteMutation.mutate(p.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Parts / Materials</h4>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Plus size={11} />{adding ? "Cancel" : "Add Part"}
        </button>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setAdding(false)}>
          <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border">
              <span className="font-semibold text-base">Add Part</span>
              <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <Input
                value={partSearch}
                onChange={e => setPartSearch(e.target.value)}
                placeholder="Search by part number or description..."
                className="h-10 text-sm"
                autoFocus
              />
            </div>

            {/* Catalog results */}
            {partSearch.length >= 2 && (
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {catalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-2 py-4 text-center">No catalog matches — fill in manually below</p>
                ) : (
                  <div className="divide-y divide-border">
                    {catalog.map(c => (
                      <button key={c.id} onPointerDown={e => { e.preventDefault();
                        setNewPart({
                          partNumber: c.partNumber ?? "",
                          description: c.description,
                          quantity: "1",
                          unitPrice: String(c.sellPrice ?? 0),
                        });
                        setPartSearch(c.description);
                      }}
                        className="w-full text-left px-3 py-3 hover:bg-accent transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug truncate">{c.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.partNumber && <span className="font-mono text-xs text-muted-foreground">#{c.partNumber}</span>}
                              {(c as any).category && <span className="text-xs text-muted-foreground truncate">{(c as any).category}</span>}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-primary shrink-0">${(c.sellPrice ?? 0).toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual entry / confirm selected */}
            <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/20">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {newPart.description ? "Selected — adjust if needed" : "Or enter manually"}
              </p>
              <Input
                value={newPart.description}
                onChange={e => setNewPart(p => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="h-9 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={newPart.partNumber}
                  onChange={e => setNewPart(p => ({ ...p, partNumber: e.target.value }))}
                  placeholder="Part #"
                  className="h-9 text-sm font-mono"
                />
                <Input
                  type="number" step="1" min="0"
                  value={newPart.quantity}
                  onChange={e => setNewPart(p => ({ ...p, quantity: e.target.value }))}
                  placeholder="Qty"
                  className="h-9 text-sm"
                />
                <Input
                  type="number" step="0.01" min="0"
                  value={newPart.unitPrice}
                  onChange={e => setNewPart(p => ({ ...p, unitPrice: e.target.value }))}
                  placeholder="Price"
                  className="h-9 text-sm"
                />
              </div>
              <Button className="w-full h-10 text-sm" onClick={() => addMutation.mutate({
                partNumber: newPart.partNumber || null,
                description: newPart.description || partSearch,
                quantity: parseFloat(newPart.quantity) || 1,
                unitPrice: parseFloat(newPart.unitPrice) || 0,
                jobId: jobId ?? null,
              })} disabled={(!newPart.description.trim() && !partSearch.trim()) || addMutation.isPending}>
                <Check size={13} className="mr-1.5" />Add Part
              </Button>
            </div>
          </div>
        </div>
      )}

      {lineParts.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground italic">No parts — click Add Part</p>
      ) : lineParts.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="py-1.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Part</th>
                <th className="py-1.5 px-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                <th className="py-1.5 px-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Unit</th>
                <th className="py-1.5 px-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {lineParts.map(p => (
                editingPartId === p.id ? (
                  /* ── Inline edit row ── */
                  <tr key={p.id} className="border-b border-border bg-accent/20">
                    <td colSpan={5} className="px-3 py-2">
                      <div className="space-y-2">
                        <Input
                          value={editDraft.description}
                          onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                          placeholder="Description"
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={editDraft.partNumber}
                            onChange={e => setEditDraft(d => ({ ...d, partNumber: e.target.value }))}
                            placeholder="Part #"
                            className="h-7 text-xs font-mono"
                          />
                          <Input
                            type="number" step="1" min="0"
                            value={editDraft.quantity}
                            onChange={e => setEditDraft(d => ({ ...d, quantity: e.target.value }))}
                            placeholder="Qty"
                            className="h-7 text-xs"
                          />
                          <Input
                            type="number" step="0.01" min="0"
                            value={editDraft.unitPrice}
                            onChange={e => setEditDraft(d => ({ ...d, unitPrice: e.target.value }))}
                            placeholder="Unit $"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" disabled={editMutation.isPending}
                            onClick={() => editMutation.mutate({ id: p.id, data: {
                              description: editDraft.description,
                              partNumber: editDraft.partNumber || null,
                              quantity: parseFloat(editDraft.quantity) || 1,
                              unitPrice: parseFloat(editDraft.unitPrice) || 0,
                            }})}>
                            <Check size={11} className="mr-1" />Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPartId(null)}>
                            Cancel
                          </Button>
                          <button onClick={() => { deleteMutation.mutate(p.id); setEditingPartId(null); }}
                            className="ml-auto text-xs text-destructive hover:underline">
                            Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── Read row — click to edit ── */
                  <tr key={p.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer group"
                    onClick={(e) => {
                      if (handlePartDeleteClick(e, p)) return;
                      if (handlePartDuplicateClick(e, p)) return;
                      startEdit(p);
                    }}
                    title="Click to edit — Ctrl+Click to duplicate, Alt+Click to delete"
                  >
                    <td className="py-1.5 px-3">
                      {(p as any).partNumber && <span className="font-mono text-[10px] text-muted-foreground mr-1.5">#{(p as any).partNumber}</span>}
                      <span className="text-xs">{p.description}</span>
                      <span className="ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity"><PenLine size={9} className="inline" /></span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-xs">{p.quantity}</td>
                    <td className="py-1.5 px-2 text-right text-xs">${p.unitPrice.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right text-xs font-medium">${(p.quantity * p.unitPrice).toFixed(2)}</td>
                    <td className="py-1.5 px-1">
                      <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(p.id); }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                        <X size={11} />
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
            {lineParts.length > 0 && (
              <tfoot>
                <tr className="bg-muted/20 border-t border-border">
                  <td colSpan={3} className="py-1.5 px-3 text-[10px] font-semibold text-muted-foreground text-right">Parts subtotal</td>
                  <td className="py-1.5 px-2 text-right text-xs font-bold">${subtotal.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : null}
    </div>
  );
}

// ─── Single Job Line Card ──────────────────────────────────────────────────────
function JobLineCard({
  job, serviceId, onDelete, defaultLaborRate,
}: {
  job: WorkOrderJob;
  serviceId: number;
  onDelete: () => void;
  defaultLaborRate: number;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/wo-jobs/${job.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "parts"] });
    },
    onError: (error: Error) => toast({ title: "Failed to save", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/wo-jobs/${job.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "jobs"] });
      onDelete();
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/service/${serviceId}/jobs`, {
      title: `${job.title} (copy)`,
      description: job.description ?? "",
      techNotes: job.techNotes ?? "",
      customerNotes: job.customerNotes ?? "",
      pricingType: job.pricingType,
      laborHours: job.laborHours ?? 0,
      laborRate: job.laborRate ?? defaultLaborRate,
      flatRate: job.flatRate ?? 0,
      sortOrder: 9999,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "jobs"] });
      toast({ title: "Job line duplicated" });
    },
    onError: () => toast({ title: "Failed to duplicate", variant: "destructive" }),
  });

  // Modifier+Click (Batch 2.5 addendum): Ctrl+Click duplicates this line, Alt+Click deletes it.
  const handleLineClick = useClickBind("wo.line.duplicate", () => duplicateMutation.mutate());
  const handleLineDeleteClick = useClickBind("wo.line.delete", () => deleteMutation.mutate());

  const laborCost = job.pricingType === "flat"
    ? (job.flatRate ?? 0)
    : (job.laborHours ?? 0) * (job.laborRate ?? defaultLaborRate);

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/service", serviceId, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${serviceId}/parts`).then(r => r.json()),
  });
  const jobParts = allParts.filter(p => (p as any).jobId === job.id);
  const partsCost = jobParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const jobTotal = laborCost + partsCost;

  return (
    <div className="border border-border rounded-xl overflow-hidden" data-testid={`job-card-${job.id}`}>
      {/* Job header */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border"
        onClick={(e) => {
          // Modifier+Click (Batch 2.5 addendum): Ctrl+Click duplicates, Alt+Click deletes.
          // Guarded against editable targets inside useClickBind; falls through otherwise.
          if (handleLineDeleteClick(e)) return;
          handleLineClick(e);
        }}
      >
        <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {/* Editable title */}
        <EditableField resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version} compact label="Job title"
          value={job.title}
          onSave={(v, options) => updateMutation.mutateAsync({ title: v, __save: options })}
          className="basis-[calc(100%-2rem)] flex-grow sm:basis-0 sm:flex-1 font-semibold text-sm"
        />
        {/* Status pill */}
        <select
          value={job.status ?? "open"}
          onChange={e => updateMutation.mutate({ status: e.target.value })}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring ${JOB_STATUS_COLORS[job.status ?? "open"] ?? JOB_STATUS_COLORS.open}`}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="complete">Complete</option>
        </select>
        {/* Subtotal */}
        <span className="text-sm font-bold text-foreground ml-2 shrink-0">${jobTotal.toFixed(2)}</span>
        {/* Delete */}
        {confirmDel ? (
          <span className="flex items-center gap-1 text-xs">
            <button onClick={() => deleteMutation.mutate()} className="text-destructive font-semibold hover:underline">Delete</button>
            <button onClick={() => setConfirmDel(false)} className="text-muted-foreground hover:underline">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Labor */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {/* Pricing type */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pricing</p>
              <select
                value={job.pricingType}
                onChange={e => updateMutation.mutate({ pricingType: e.target.value as "hourly" | "flat" })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="hourly">Hourly</option>
                <option value="flat">Flat Rate</option>
              </select>
            </div>

            {job.pricingType === "hourly" ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Hours</p>
                  <EditableField compact label="Labor hours" type="number" resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
                    value={String(job.laborHours ?? 0)} onSave={(v, options) => updateMutation.mutateAsync({ laborHours: Number(v), __save: options })} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rate ($/hr)</p>
                  <EditableField compact label="Labor rate" type="number" resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
                    value={String(job.laborRate ?? defaultLaborRate)} onSave={(v, options) => updateMutation.mutateAsync({ laborRate: Number(v), __save: options })} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Labor</p>
                  <p className="h-8 flex items-center text-sm font-semibold">${laborCost.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Flat Rate ($)</p>
                  <EditableField compact label="Flat rate" type="number" resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
                    value={String(job.flatRate ?? 0)} onSave={(v, options) => updateMutation.mutateAsync({ flatRate: Number(v), __save: options })} />
                </div>
                <div className="col-span-2" />
              </>
            )}
          </div>

          {/* Description + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EditableField resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
              label="Description (customer-facing)"
              value={job.description}
              multiline
              onSave={(v, options) => updateMutation.mutateAsync({ description: v, __save: options })}
            />
            <EditableField resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
              label="Tech Notes (internal)"
              value={job.techNotes}
              multiline
              onSave={(v, options) => updateMutation.mutateAsync({ techNotes: v, __save: options })}
            />
            <EditableField resource={`/api/wo-jobs/${job.id}`} version={(job as any)._version}
              label="Customer Notes (shows on customer copy)"
              value={job.customerNotes}
              multiline
              rows={6}
              onSave={(v, options) => updateMutation.mutateAsync({ customerNotes: v, __save: options })}
            />
          </div>

          {/* Parts for this job */}
          <PartsSection serviceId={serviceId} jobId={job.id} />
        </div>
      )}
    </div>
  );
}

// ─── Inline editable title (no label, compact) ────────────────────────────────
// ─── Common Job Picker Modal ───────────────────────────────────────────────────
function CommonJobPicker({ onSelect, onClose }: {
  onSelect: (job: CommonJob) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: commonJobs = [] } = useQuery<CommonJob[]>({
    queryKey: ["/api/common-jobs"],
    queryFn: () => apiRequest("GET", "/api/common-jobs").then(r => r.json()),
  });

  const filtered = commonJobs.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    (j.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, CommonJob[]>>((acc, j) => {
    const cat = j.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(j);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Add Common Job</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="p-3 border-b border-border">
          <Input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="h-8 text-sm"
          />
        </div>
        <div className="overflow-y-auto max-h-80 p-2">
          {Object.keys(grouped).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No common jobs found. Add some on the Templates page.</p>
          )}
          {Object.entries(grouped).map(([cat, jobs]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">{cat}</p>
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => onSelect(j)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors flex items-center justify-between gap-2"
                >
                  <span>
                    <p className="text-sm font-medium">{j.name}</p>
                    {j.description && <p className="text-xs text-muted-foreground truncate">{j.description}</p>}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {j.pricingType === "flat"
                      ? `$${(j.flatRate ?? 0).toFixed(2)} flat`
                      : `${j.laborHours ?? 0} hrs`}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Work Order Detail Page ────────────────────────────────────────────────────

// ─── Status Timeline ──────────────────────────────────────────────────────────
const STATUS_HISTORY_LABELS: Record<string, string> = {
  open: "Opened", complete: "Marked Complete", invoiced: "Invoiced",
  estimate: "Estimate", cancelled: "Cancelled",
};

function StatusTimeline({ serviceId }: { serviceId: number }) {
  const { data: history = [] } = useQuery<{ id: number; status: string; changed_at: string }[]>({
    queryKey: ["/api/service", serviceId, "status-history"],
    queryFn: () => apiRequest("GET", `/api/service/${serviceId}/status-history`).then(r => r.json()),
  });
  if (history.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status History</h2>
      <div className="flex flex-col gap-1.5">
        {history.map(h => (
          <div key={h.id} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              h.status === "complete" ? "bg-green-500" :
              h.status === "invoiced" ? "bg-amber-500" :
              h.status === "open" ? "bg-blue-500" : "bg-muted-foreground"
            }`} />
            <span className="text-sm font-medium">{STATUS_HISTORY_LABELS[h.status] ?? h.status}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(h.changed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const woId = Number(id);

  const [showCommonPicker, setShowCommonPicker] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [payLinkLoading, setPayLinkLoading] = useState(false);

  const { data: job, isLoading } = useQuery<OpenJob>({
    queryKey: ["/api/service", woId],
    queryFn: () => apiRequest("GET", `/api/service/${woId}`).then(r => r.json()),
    enabled: !!woId,
  });

  usePageTitle(job ? `WO-${String(woId).padStart(4, "0")} · ${job.customerName ?? "Work Order"}` : "Work Order");

  const { data: lineParts = [] } = useQuery<Part[]>({
    queryKey: ["/api/service", woId, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${woId}/parts`).then(r => r.json()),
  });

  const { data: woJobs = [] } = useQuery<WorkOrderJob[]>({
    queryKey: ["/api/service", woId, "jobs"],
    queryFn: () => apiRequest("GET", `/api/service/${woId}/jobs`).then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/service/${woId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service", woId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Saved" });
    },
    onError: (error: Error) => toast({ title: "Failed to save", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/service/${woId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      navigate("/jobs");
      toast({ title: "Work order deleted" });
    },
  });

  const addJobMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/service/${woId}/jobs`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", woId, "jobs"] });
      toast({ title: "Job line added" });
    },
    onError: () => toast({ title: "Failed to add job", variant: "destructive" }),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // ─── Keybinds (Batch 2.5): wo.* scope — registered against existing actions ──
  useKeybind("wo.duplicate", () => setShowDuplicate(true), []);
  useKeybind("wo.print", () => window.print(), []);
  useKeybind("wo.pdf", () => {
    if (!job || pdfLoading) return;
    setPdfLoading(true);
    downloadCustomerPDF(job, lineParts, woJobs)
      .catch((e: any) => toast({ title: "PDF failed", description: e?.message || "Could not generate PDF", variant: "destructive" }))
      .finally(() => setPdfLoading(false));
  }, [job, lineParts, woJobs, pdfLoading]);
  useKeybind("wo.signature", () => {
    const section = document.querySelector('[data-testid="section-signature"]');
    section?.scrollIntoView({ behavior: "smooth", block: "center" });
    const startBtn = document.querySelector('[data-testid="button-start-signature"]') as HTMLButtonElement | null;
    startBtn?.focus();
    startBtn?.click();
  }, []);
  useKeybind("wo.job.next", () => {
    if (woJobs.length === 0) return;
    const idx = woJobs.findIndex(j => j.id === activeJobId);
    const next = woJobs[(idx + 1 + woJobs.length) % woJobs.length];
    setActiveJobId(next.id);
    document.querySelector(`[data-testid="job-card-${next.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [woJobs, activeJobId]);
  useKeybind("wo.job.prev", () => {
    if (woJobs.length === 0) return;
    const idx = woJobs.findIndex(j => j.id === activeJobId);
    const prev = woJobs[(idx - 1 + woJobs.length) % woJobs.length];
    setActiveJobId(prev.id);
    document.querySelector(`[data-testid="job-card-${prev.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [woJobs, activeJobId]);
  useKeybind("wo.job.new", () => addJobMutation.mutate({
    title: "New Job",
    pricingType: "hourly",
    laborRate: job?.laborRate ?? 110,
    sortOrder: woJobs.length,
  }), [woJobs, job]);
  useKeybind("wo.job.setOpen", () => {
    const active = woJobs.find(j => j.id === activeJobId) ?? woJobs[0];
    if (active) apiRequest("PATCH", `/api/wo-jobs/${active.id}`, { status: "open" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/service", woId, "jobs"] }));
  }, [woJobs, activeJobId, woId]);
  useKeybind("wo.job.setInProgress", () => {
    const active = woJobs.find(j => j.id === activeJobId) ?? woJobs[0];
    if (active) apiRequest("PATCH", `/api/wo-jobs/${active.id}`, { status: "in_progress" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/service", woId, "jobs"] }));
  }, [woJobs, activeJobId, woId]);
  useKeybind("wo.job.setComplete", () => {
    const active = woJobs.find(j => j.id === activeJobId) ?? woJobs[0];
    if (active) apiRequest("PATCH", `/api/wo-jobs/${active.id}`, { status: "complete" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/service", woId, "jobs"] }));
  }, [woJobs, activeJobId, woId]);
  useKeybind("wo.save", () => {
    if (job) updateMutation.mutate({});
  }, [job]);

  if (isLoading) {
    return (
      <div className="space-y-4 pb-24 lg:pb-0">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <AlertTriangle size={32} className="mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="font-medium text-muted-foreground">Work order not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/jobs")}>
          <ChevronLeft size={14} className="mr-1" />Back to Work Orders
        </Button>
      </div>
    );
  }

  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const defaultLaborRate = job.laborRate ?? 110;

  // Totals — sum across all job lines + unassigned parts
  const jobsLaborTotal = woJobs.reduce((s, j) => {
    if (j.pricingType === "flat") return s + (j.flatRate ?? 0);
    return s + (j.laborHours ?? 0) * (j.laborRate ?? defaultLaborRate);
  }, 0);
  const jobsPartsTotal = woJobs.reduce((s, wj) => {
    const jp = lineParts.filter(p => (p as any).jobId === wj.id);
    return s + jp.reduce((ps, p) => ps + p.quantity * p.unitPrice, 0);
  }, 0);
  const unassignedPartsTotal = lineParts.filter(p => !(p as any).jobId).reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  // Legacy (no job lines): use WO-level labor
  const legacyLaborCost = woJobs.length === 0 ? (job.laborHours ?? 0) * defaultLaborRate : 0;
  const legacyPartsCost = woJobs.length === 0 ? lineParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0) : 0;
  const total = woJobs.length > 0
    ? jobsLaborTotal + jobsPartsTotal + unassignedPartsTotal
    : legacyLaborCost + legacyPartsCost;

  function addBlankJob() {
    addJobMutation.mutate({
      title: "New Job",
      pricingType: "hourly",
      laborRate: defaultLaborRate,
      sortOrder: woJobs.length,
    });
  }

  function addFromCommon(cj: CommonJob) {
    addJobMutation.mutate({
      title: cj.name,
      description: cj.description ?? "",
      techNotes: cj.techNotes ?? "",
      customerNotes: cj.customerNotes ?? "",
      pricingType: cj.pricingType,
      laborHours: cj.laborHours ?? 0,
      laborRate: cj.laborRate ?? defaultLaborRate,
      flatRate: cj.flatRate ?? 0,
      commonJobId: cj.id,
      sortOrder: woJobs.length,
    });
    setShowCommonPicker(false);
  }

  return (
    <div className="pb-28 lg:pb-6">
      {showCommonPicker && (
        <CommonJobPicker
          onSelect={addFromCommon}
          onClose={() => setShowCommonPicker(false)}
        />
      )}

      {/* Back + actions bar */}
      <div className="mb-5 no-print">
        {/* Back breadcrumb */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/jobs")} className="h-9 px-2 -ml-2">
            <ChevronLeft size={16} className="mr-1" />Work Orders
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-mono text-sm font-semibold">{woNum}</span>
        </div>
        {/* Action buttons — 2-col grid on mobile, inline row on desktop */}
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
          <Button variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs" onClick={() => job && printCustomer(job, lineParts, woJobs)}>
            <Printer size={14} />Customer Copy
          </Button>
          <Button
            variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs"
            disabled={pdfLoading}
            onClick={async () => {
              if (!job) return;
              setPdfLoading(true);
              try {
                await downloadCustomerPDF(job, lineParts, woJobs);
              } catch (e: any) {
                toast({ title: "PDF failed", description: e?.message || "Could not generate PDF", variant: "destructive" });
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            <Download size={14} />{pdfLoading ? "Generating..." : "Download PDF"}
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs" onClick={() => job && printTech(job, lineParts, woJobs)}>
            <Wrench size={14} />Tech Copy
          </Button>
          <Button
            variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs"
            data-testid="link-server-pdf"
            onClick={async () => {
              try {
                const blob = await (await apiRequest("GET", `/api/work-orders/${woId}/pdf`)).blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `WO-${woId}.pdf`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
              } catch (e: any) { toast({ title: "PDF failed", description: e.message, variant: "destructive" }); }
            }}
          >
              <FileDown size={14} />Export PDF
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs" onClick={() => window.print()} data-testid="button-print-wo">
            <Printer size={14} />Print
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs" onClick={() => setShowDuplicate(true)} data-testid="button-duplicate-wo">
            <Copy size={14} />Duplicate
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-10 gap-1.5 text-sm lg:h-8 lg:text-xs border-green-600 text-green-700 hover:bg-green-50"
            disabled={true}
            title="Payments are not enabled in this version."
            onClick={async () => {
              if (!job) return;
              setPayLinkLoading(true);
              try {
                const res = await apiRequest("POST", `/api/square/checkout/${job.id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to create payment link");
                // Copy to clipboard + open in new tab
                try { await navigator.clipboard.writeText(data.url); } catch {}
                window.open(data.url, "_blank");
                toast({
                  title: "Payment link created",
                  description: `$${data.amount.toFixed(2)} link for ${data.woNumber} — copied to clipboard. Send to your customer via text or email.`,
                });
              } catch (e: any) {
                toast({ title: "Payment link failed", description: e?.message || "Could not create Square link", variant: "destructive" });
              } finally {
                setPayLinkLoading(false);
              }
            }}
          >
            <Link2 size={14} />Payments disabled
          </Button>
          {NEXT_STATUS[job.status] && (
            <Button size="sm" className="h-10 text-sm lg:h-8 lg:text-xs col-span-1" onClick={() => updateMutation.mutate({ status: NEXT_STATUS[job.status] })}>
              <CheckCircle2 size={14} className="mr-1" />Mark {STATUS_LABELS[NEXT_STATUS[job.status]]}
            </Button>
          )}
        </div>
      </div>

      {job && (
        <DuplicateWODialog open={showDuplicate} onOpenChange={setShowDuplicate} job={job} workOrderId={woId} />
      )}

      {/* ── Printable region (Feature B) ── */}
      <div className="printable-wo">

      {/* Printable-only header, hidden on screen */}
      <div className="hidden print-header-block">
        <div className="print-brand">Bradley's Boat Care</div>
        <div className="print-wo-meta">
          {woNum} &bull; {job.customerName} &bull; {[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ")} &bull; {job.date}
        </div>
      </div>

      {/* ── Customer & Boat Info row (top) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Customer card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</h3>
            <button
              onClick={() => navigate(`/customers/${job.boatId}`)}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View profile <ChevronRight size={11} />
            </button>
          </div>
          <p className="font-semibold text-base">{job.customerName}</p>
          {job.customerPhone && (
            <a href={`tel:${job.customerPhone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5 hover:text-primary transition-colors">
              <PhoneCall size={12} />{job.customerPhone}
            </a>
          )}
          {job.customerEmail && (
            <a href={`mailto:${job.customerEmail}`} className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5 hover:text-primary transition-colors">
              <Mail size={12} />{job.customerEmail}
            </a>
          )}
          {job.customerAddress && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <MapPin size={12} />{job.customerAddress}
            </div>
          )}
          {job.customerNotes && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
              <span className="font-semibold text-foreground uppercase tracking-wide text-[10px]">Notes: </span>{job.customerNotes}
            </div>
          )}
        </div>

        {/* Boat Info card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Boat Info</h3>
            <button
              onClick={() => navigate(`/boats/${job.boatId}`)}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View record <ChevronRight size={11} />
            </button>
          </div>
          <p className="font-semibold text-base">
            {[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—"}
          </p>
          <div className="mt-2 space-y-1.5">
            {job.boatColor && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Anchor size={11} />Color: {job.boatColor}</div>}
            {job.boatEngineType && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wrench size={11} />Type: {job.boatEngineType}</div>}
            {(job.boatEngineMake || job.boatEngineModel) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wrench size={11} />Engine: {[job.boatEngineMake, job.boatEngineModel].filter(Boolean).join(" ")}
              </div>
            )}
            {job.boatEngineHours != null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={11} />Hours: <span className="font-semibold text-foreground">{job.boatEngineHours}</span>
              </div>
            )}
            {job.boatHullId && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash size={11} />HIN: <span className="font-mono">{job.boatHullId}</span>
              </div>
            )}
            {job.boatRegistration && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText size={11} />Reg: {job.boatRegistration}
              </div>
            )}
            {job.boatStorageLocation && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={11} />Storage: <span className="font-semibold text-foreground">{job.boatStorageLocation}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── LEFT: Main details ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Header card */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold">{woNum}</h1>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[job.status]}`}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">Created {job.date}</p>
              </div>
              {/* Status stepper */}
              <div className="hidden md:flex items-center gap-1">
                {STATUS_ORDER.map((s, i) => {
                  const idx = STATUS_ORDER.indexOf(job.status);
                  const done = i <= idx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <button
                        onClick={() => updateMutation.mutate({ status: s })}
                        title={STATUS_LABELS[s]}
                        className={`w-2.5 h-2.5 rounded-full transition-colors border ${
                          done ? "bg-primary border-primary" : "bg-muted border-border hover:border-primary"
                        }`}
                      />
                      {i < STATUS_ORDER.length - 1 && (
                        <div className={`w-5 h-px ${i < idx ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:hidden mb-4">
              <select
                value={job.status}
                onChange={e => updateMutation.mutate({ status: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                label="Work Order Description / Summary"
                value={job.description}
                multiline
                onSave={(v, options) => updateMutation.mutateAsync({ description: v, __save: options })}
              />
              <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                label="General Tech Notes (internal)"
                value={job.techNotes}
                multiline
                onSave={(v, options) => updateMutation.mutateAsync({ techNotes: v, __save: options })}
              />
              <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                label="Created Date"
                value={job.date}
                type="date"
                onSave={(v, options) => updateMutation.mutateAsync({ date: v, __save: options })}
              />
              <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                label="Due Date"
                value={job.dueDate}
                type="date"
                onSave={(v, options) => updateMutation.mutateAsync({ dueDate: v || null, __save: options })}
              />
            </div>
          </div>

          {/* ── Status Timeline ── */}
          <StatusTimeline serviceId={woId} />

          {/* ── Job Lines ── */}
          <div className="bg-card border border-border rounded-xl p-5 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks size={15} className="text-primary" />
                  Job Lines
                  {woJobs.length > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">({woJobs.length})</span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Each job is its own line with labor, parts, and notes</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setShowCommonPicker(true)}
                >
                  <BookOpen size={12} />Common Job
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={addBlankJob}
                  disabled={addJobMutation.isPending}
                >
                  <Plus size={12} />Add Job
                </Button>
              </div>
            </div>

            {woJobs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                <Wrench size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No job lines yet</p>
                <p className="text-xs mt-1 mb-3">Add a blank job or pick from your common jobs library</p>
                <div className="flex items-center gap-2 justify-center">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCommonPicker(true)}>
                    <BookOpen size={11} />Common Job
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={addBlankJob}>
                    <Plus size={11} />Add Blank Job
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {woJobs.map(wj => (
                  <JobLineCard
                    key={wj.id}
                    job={wj}
                    serviceId={woId}
                    defaultLaborRate={defaultLaborRate}
                    onDelete={() => queryClient.invalidateQueries({ queryKey: ["/api/service", woId, "jobs"] })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Legacy labor (only shown when no job lines) */}
          {woJobs.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-5 no-print">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Labor</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                  label="Labor Hours"
                  value={job.laborHours != null ? String(job.laborHours) : ""}
                  type="number"
                  onSave={(v, options) => updateMutation.mutateAsync({ laborHours: v !== "" ? parseFloat(v) : null, __save: options })}
                />
                <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                  label="Labor Rate ($/hr)"
                  value={job.laborRate != null ? String(job.laborRate) : "110"}
                  type="number"
                  onSave={(v, options) => updateMutation.mutateAsync({ laborRate: v !== "" ? parseFloat(v) : 110, __save: options })}
                />
              </div>
              {job.laborHours != null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Labor subtotal: <span className="font-semibold text-foreground">${legacyLaborCost.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {/* Legacy parts (only when no job lines) */}
          {woJobs.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-5 no-print">
              <PartsSection serviceId={woId} />
            </div>
          )}

          {/* Print-only jobs & parts table (Feature B) */}
          <PrintJobsTable job={job} lineParts={lineParts} woJobs={woJobs} defaultLaborRate={defaultLaborRate} total={total} />

          {/* Totals */}
          <div className="bg-card border border-border rounded-xl p-5 no-print">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Summary</h3>
            <div className="space-y-1.5 text-sm">
              {woJobs.length > 0 ? (
                <>
                  {woJobs.map(wj => {
                    const lc = wj.pricingType === "flat"
                      ? (wj.flatRate ?? 0)
                      : (wj.laborHours ?? 0) * (wj.laborRate ?? defaultLaborRate);
                    const jp = lineParts.filter(p => (p as any).jobId === wj.id);
                    const pc = jp.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
                    return (
                      <div key={wj.id} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[60%]">{wj.title}</span>
                        <span className="font-medium">${(lc + pc).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {unassignedPartsTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other parts</span>
                      <span className="font-medium">${unassignedPartsTotal.toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {legacyLaborCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Labor ({job.laborHours} hrs × ${defaultLaborRate}/hr)</span>
                      <span className="font-medium">${legacyLaborCost.toFixed(2)}</span>
                    </div>
                  )}
                  {legacyPartsCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parts ({lineParts.length} line{lineParts.length !== 1 ? "s" : ""})</span>
                      <span className="font-medium">${legacyPartsCost.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold text-base">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {job.depositAmount != null && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Deposit received</span>
                    <span>-${job.depositAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary">
                    <span>Balance due</span>
                    <span>${(total - job.depositAmount).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3">
              <EditableField resource={`/api/service/${woId}`} version={(job as any)._version}
                label="Deposit Amount"
                value={job.depositAmount != null ? String(job.depositAmount) : ""}
                type="number"
                onSave={(v, options) => updateMutation.mutateAsync({ depositAmount: v !== "" ? parseFloat(v) : null, __save: options })}
              />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Payment Status</p>
                <button
                  onClick={() => updateMutation.mutate({ paid: !job.paid })}
                  className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
                    job.paid
                      ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {job.paid ? "Paid" : "Mark as Paid"}
                </button>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border border-destructive/20 rounded-xl p-4 no-print">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Danger Zone</p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive flex-1">Delete this work order permanently?</p>
                <Button variant="destructive" size="sm" className="h-7" onClick={() => deleteMutation.mutate()}>
                  {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
                </Button>
                <Button variant="outline" size="sm" className="h-7" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-7 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} className="mr-1" />Delete Work Order
              </Button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="space-y-4 no-print">

          {/* Quick status change (desktop) */}
          <div className="bg-card border border-border rounded-xl p-4 hidden xl:block">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Change Status</h3>
            <div className="space-y-1">
              {STATUS_ORDER.map(s => (
                <button
                  key={s}
                  onClick={() => updateMutation.mutate({ status: s })}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    s === job.status
                      ? `${STATUS_COLORS[s]} font-semibold`
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {s === job.status && <Check size={12} className="inline mr-1.5" />}
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Signature (Feature C) ── */}
      <div className="bg-card border border-border rounded-xl p-5 mt-5" data-testid="section-signature">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <PenTool size={13} className="text-primary" />Customer Signature
        </h3>
        <SignatureSection job={job} woId={woId} />
      </div>

      </div>
      {/* ── end printable region ── */}
    </div>
  );
}

// ─── Print-only jobs & parts table (Feature B) ─────────────────────────────────
function PrintJobsTable({
  job, lineParts, woJobs, defaultLaborRate, total,
}: { job: OpenJob; lineParts: Part[]; woJobs: WorkOrderJob[]; defaultLaborRate: number; total: number }) {
  const legacyLabor = woJobs.length === 0 ? (job.laborHours ?? 0) * defaultLaborRate : 0;
  const balance = job.depositAmount != null ? total - job.depositAmount : null;

  return (
    <div className="hidden print-only bg-card border border-border rounded-xl p-5">
      <table className="w-full text-sm print-table">
        <thead>
          <tr>
            <th className="text-left">Description</th>
            <th className="text-right">Qty / Hrs</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {woJobs.length === 0 && legacyLabor > 0 && (
            <tr>
              <td>Labor @ ${defaultLaborRate}/hr</td>
              <td className="text-right">{job.laborHours}</td>
              <td className="text-right">${defaultLaborRate}</td>
              <td className="text-right">${legacyLabor.toFixed(2)}</td>
            </tr>
          )}
          {woJobs.map(wj => {
            const amt = wj.pricingType === "flat" ? (wj.flatRate ?? 0) : (wj.laborHours ?? 0) * (wj.laborRate ?? defaultLaborRate);
            return (
              <tr key={wj.id}>
                <td>{wj.title}</td>
                <td className="text-right">{wj.pricingType === "flat" ? "flat" : wj.laborHours}</td>
                <td className="text-right">{wj.pricingType === "flat" ? "—" : `$${wj.laborRate ?? defaultLaborRate}`}</td>
                <td className="text-right">${amt.toFixed(2)}</td>
              </tr>
            );
          })}
          {lineParts.map(p => (
            <tr key={`part-${p.id}`}>
              <td className="pl-4 text-muted-foreground">{p.description}</td>
              <td className="text-right">{p.quantity}</td>
              <td className="text-right">${p.unitPrice.toFixed(2)}</td>
              <td className="text-right">${(p.quantity * p.unitPrice).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <div className="w-64 text-sm">
          <div className="flex justify-between font-bold border-t border-border pt-2">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          {job.depositAmount != null && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Deposit</span><span>-${job.depositAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Balance Due</span><span>${balance!.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Signature capture/display section ─────────────────────────────────────────
function SignatureSection({ job, woId }: { job: OpenJob; woId: number }) {
  const { toast } = useToast();
  const [signedBy, setSignedBy] = useState(job.customerName ?? "");
  const [showPad, setShowPad] = useState(false);

  const signMutation = useMutation({
    mutationFn: (signatureDataUrl: string) =>
      apiRequest("POST", `/api/work-orders/${woId}/signature`, { signatureDataUrl, signedBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", woId] });
      toast({ title: "Signature saved" });
      setShowPad(false);
    },
    onError: (e: any) => toast({ title: "Failed to save signature", description: e?.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/service/${woId}`, { signatureDataUrl: null, signedBy: null, signedAt: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", woId] });
      toast({ title: "Signature cleared" });
    },
  });

  if (job.signatureDataUrl) {
    return (
      <div data-testid="signature-display">
        <img src={job.signatureDataUrl} alt="Customer signature" className="max-h-[90px] border-b border-border bg-white rounded" />
        <p className="text-xs text-muted-foreground mt-2">
          Signed by <span className="font-medium text-foreground">{job.signedBy || "Customer"}</span>
          {job.signedAt && <> on {new Date(job.signedAt).toLocaleString()}</>}
        </p>
        <button
          onClick={() => clearMutation.mutate()}
          className="text-xs text-muted-foreground hover:text-destructive underline mt-1 no-print"
          data-testid="button-clear-signature"
        >
          Clear signature
        </button>
      </div>
    );
  }

  return (
    <div className="no-print" data-testid="signature-capture">
      {!showPad ? (
        <button
          onClick={() => setShowPad(true)}
          className="text-sm text-primary hover:underline"
          data-testid="button-start-signature"
        >
          + Capture customer signature
        </button>
      ) : (
        <div className="space-y-3 max-w-xs">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Signed by</label>
            <Input
              value={signedBy}
              onChange={e => setSignedBy(e.target.value)}
              placeholder="Customer name"
              className="h-8 text-sm"
            />
          </div>
          <SignaturePad onSave={dataUrl => signMutation.mutate(dataUrl)} saving={signMutation.isPending} />
        </div>
      )}
    </div>
  );
}
