import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrderJob, Part } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OpenJob {
  id: number; status: string; date: string; dueDate?: string | null;
  description: string; techNotes?: string | null;
  laborHours?: number | null; laborRate?: number | null;
  depositAmount?: number | null;
  customerName: string; customerPhone?: string | null; customerEmail?: string | null;
  boatId: number; boatMake: string; boatModel: string; boatYear?: number | null;
  boatColor?: string | null; boatEngineType?: string | null;
  boatEngineMake?: string | null; boatEngineModel?: string | null;
  boatEngineHours?: number | null; boatHullId?: string | null;
  boatRegistration?: string | null; boatStorageLocation?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BBC_PHONE = "(603) 273-2491";
const BBC_EMAIL = "BradleysBoatCare@gmail.com";
const PRIMARY = "#076579";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt$(n: number) { return "$" + n.toFixed(2); }

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#f7f9fa", border: "1px solid #dde4e8", borderRadius: 7, padding: "13px 16px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: PRIMARY, marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}
function BoxRow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: "#444", marginTop: 3 }}>{children}</div>;
}
function BoxPrimary({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 700 }}>{children}</div>;
}

// ─── Job rows builder ─────────────────────────────────────────────────────────
function buildRows(woJobs: WorkOrderJob[], allParts: Part[], mode: "customer" | "tech") {
  const rows: React.ReactNode[] = [];
  let grandTotal = 0;

  for (const job of woJobs) {
    const laborCost = job.pricingType === "flat"
      ? (job.flatRate ?? 0)
      : (job.laborHours ?? 0) * (job.laborRate ?? 110);
    const jobParts = allParts.filter(p => (p as any).jobId === job.id);
    const partsCost = jobParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
    const jobTotal = laborCost + partsCost;
    grandTotal += jobTotal;

    rows.push(
      <tr key={`jh-${job.id}`} style={{ background: "#f0f5f7" }}>
        <td colSpan={4} style={{ fontWeight: 700, fontSize: 12.5, color: PRIMARY, borderTop: "2px solid #dde4e8", borderBottom: "1px solid #dde4e8", padding: "9px 8px" }}>
          {job.title}
        </td>
      </tr>
    );

    // Notes — customer sees customerNotes, tech sees techNotes
    const note = mode === "customer" ? job.customerNotes : job.techNotes;
    const noteColor = mode === "customer" ? "#1d5c8a" : "#92400e";
    if (note) {
      rows.push(
        <tr key={`jn-${job.id}`} style={{ background: "#f9fafb" }}>
          <td colSpan={4} style={{ fontSize: 11, fontStyle: "italic", color: noteColor, padding: "3px 8px 7px 22px", borderBottom: "1px solid #eaedf0" }}>
            {note}
          </td>
        </tr>
      );
    }

    if (laborCost > 0) {
      if (job.pricingType === "flat") {
        rows.push(
          <tr key={`jl-${job.id}`}>
            <td style={{ paddingLeft: 22 }}>Flat Rate Labor</td>
            <td style={{ textAlign: "right" }}>—</td>
            <td style={{ textAlign: "right" }}>—</td>
            <td style={{ textAlign: "right" }}>{fmt$(laborCost)}</td>
          </tr>
        );
      } else {
        rows.push(
          <tr key={`jl-${job.id}`}>
            <td style={{ paddingLeft: 22 }}>Labor @ {fmt$(job.laborRate ?? 110)}/hr</td>
            <td style={{ textAlign: "right" }}>{job.laborHours} hrs</td>
            <td style={{ textAlign: "right" }}>{fmt$(job.laborRate ?? 110)}</td>
            <td style={{ textAlign: "right" }}>{fmt$(laborCost)}</td>
          </tr>
        );
      }
    }

    for (const p of jobParts) {
      const lt = p.quantity * p.unitPrice;
      rows.push(
        <tr key={`jp-${p.id}`}>
          <td style={{ paddingLeft: 22 }}>
            {p.partNumber && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#666", marginRight: 4 }}>#{p.partNumber}</span>}
            {p.description}
          </td>
          <td style={{ textAlign: "right" }}>{p.quantity}</td>
          <td style={{ textAlign: "right" }}>{fmt$(p.unitPrice)}</td>
          <td style={{ textAlign: "right" }}>{fmt$(lt)}</td>
        </tr>
      );
    }

    rows.push(
      <tr key={`js-${job.id}`} style={{ background: "#f9fafb" }}>
        <td colSpan={3} style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#555", padding: "5px 8px", borderBottom: "1px solid #eaedf0" }}>Job Subtotal</td>
        <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12, padding: "5px 8px", borderBottom: "1px solid #eaedf0" }}>{fmt$(jobTotal)}</td>
      </tr>
    );
  }

  // Unassigned parts
  const unassigned = allParts.filter(p => !(p as any).jobId);
  if (unassigned.length > 0) {
    rows.push(
      <tr key="other-header" style={{ background: "#fff8e1" }}>
        <td colSpan={4} style={{ fontWeight: 700, fontSize: 12.5, color: "#92400e", borderTop: "2px solid #f6cc6a", borderBottom: "1px solid #f6cc6a", padding: "9px 8px" }}>
          {mode === "tech" ? "⚠ Unassigned Parts — not linked to a job line" : "Other Charges"}
        </td>
      </tr>
    );
    for (const p of unassigned) {
      const lt = p.quantity * p.unitPrice;
      grandTotal += lt;
      rows.push(
        <tr key={`up-${p.id}`}>
          <td style={{ paddingLeft: 22 }}>{p.description}</td>
          <td style={{ textAlign: "right" }}>{p.quantity}</td>
          <td style={{ textAlign: "right" }}>{fmt$(p.unitPrice)}</td>
          <td style={{ textAlign: "right" }}>{fmt$(lt)}</td>
        </tr>
      );
    }
  }

  return { rows, grandTotal };
}

// ─── Print Page ───────────────────────────────────────────────────────────────
export default function WorkOrderPrintPage() {
  const { id, mode } = useParams<{ id: string; mode: string }>();
  const [, navigate] = useLocation();
  const woId = Number(id);
  const isCustomer = mode === "customer";

  const { data: job, isLoading: jobLoading } = useQuery<OpenJob>({
    queryKey: ["/api/service", woId],
    queryFn: () => apiRequest("GET", `/api/service/${woId}`).then(r => r.json()),
    enabled: !!woId,
  });

  const { data: lineParts = [], isLoading: partsLoading } = useQuery<Part[]>({
    queryKey: ["/api/service", woId, "parts"],
    queryFn: () => apiRequest("GET", `/api/service/${woId}/parts`).then(r => r.json()),
    enabled: !!woId,
  });

  const { data: woJobs = [], isLoading: jobsLoading } = useQuery<WorkOrderJob[]>({
    queryKey: ["/api/service", woId, "jobs"],
    queryFn: () => apiRequest("GET", `/api/service/${woId}/jobs`).then(r => r.json()),
    enabled: !!woId,
  });

  const isLoading = jobLoading || partsLoading || jobsLoading;

  // Auto-print once data is loaded (longer delay for mobile)
  useEffect(() => {
    if (!isLoading && job) {
      const timer = setTimeout(() => window.print(), 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, job]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
        Loading work order...
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
        Work order not found.
      </div>
    );
  }

  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const boatLine = [job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ") || "—";
  const legacyLabor = woJobs.length === 0 ? (job.laborHours ?? 0) * (job.laborRate ?? 110) : 0;
  const { rows, grandTotal } = buildRows(woJobs, lineParts, isCustomer ? "customer" : "tech");
  const subtotal = grandTotal + legacyLabor;
  const deposit = job.depositAmount ?? 0;
  const balance = subtotal - deposit;

  // Shared styles as objects (works in React without a <style> tag)
  const cell: React.CSSProperties = { padding: "8px 8px", borderBottom: "1px solid #eaedf0", fontSize: 12, verticalAlign: "top" };
  const thStyle: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#666", borderBottom: "1.5px solid #ccd3d8", padding: "6px 8px", textAlign: "left" };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .page { padding: 20px 24px !important; }
        }
        body { background: #fff; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eaedf0; font-size: 12px; vertical-align: top; }
        .right { text-align: right; }
      `}</style>

      {/* Back button — hidden on print */}
      <div className="no-print" style={{ position: "fixed", top: 12, left: 12, zIndex: 100, display: "flex", gap: 8 }}>
        <button
          onClick={() => navigate(`/jobs/${woId}`)}
          style={{ background: "#076579", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
        >
          ← Back to Work Order
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: "#fff", color: "#076579", border: "1px solid #076579", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
        >
          Print / Save PDF
        </button>
      </div>

      <div className="page" style={{ maxWidth: 760, margin: "0 auto", padding: "60px 48px 40px" }}>

        {/* Banner */}
        <div style={{
          textAlign: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em",
          textTransform: "uppercase", padding: "6px", borderRadius: 5, marginBottom: 22,
          ...(isCustomer
            ? { background: "#e8f4f7", color: PRIMARY, border: "1px solid #b0d4df" }
            : { background: PRIMARY, color: "#fff" })
        }}>
          {isCustomer ? "Customer Copy" : "Technician Copy — Internal Use Only"}
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 20, borderBottom: `3px solid ${PRIMARY}`, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", color: PRIMARY }}>Bradley's Boat Care</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>Marine Service &amp; Repair</div>
            <div style={{ fontSize: 11.5, color: "#444", marginTop: 6, lineHeight: 1.7 }}>
              {BBC_PHONE}<br />{BBC_EMAIL}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: PRIMARY, marginBottom: 4 }}>Work Order</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-.5px" }}>{woNum}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4, lineHeight: 1.8 }}>
              Date: {job.date}
              {job.dueDate && <><br />Due: {job.dueDate}</>}
              <br />Status: {job.status}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <InfoBox label="Customer">
            <BoxPrimary>{job.customerName}</BoxPrimary>
            {job.customerPhone && <BoxRow>{job.customerPhone}</BoxRow>}
            {job.customerEmail && <BoxRow>{job.customerEmail}</BoxRow>}
          </InfoBox>
          <InfoBox label="Boat Info">
            <BoxPrimary>{boatLine}</BoxPrimary>
            {job.boatColor && <BoxRow>Color: {job.boatColor}</BoxRow>}
            {!isCustomer && job.boatEngineType && <BoxRow>Type: {job.boatEngineType}</BoxRow>}
            {job.boatEngineMake && <BoxRow>Engine: {job.boatEngineMake}{job.boatEngineModel ? " " + job.boatEngineModel : ""}</BoxRow>}
            {!isCustomer && job.boatEngineHours != null && <BoxRow>Hours: <strong>{job.boatEngineHours}</strong></BoxRow>}
            {job.boatHullId && <BoxRow>HIN: <span style={{ fontFamily: "monospace" }}>{job.boatHullId}</span></BoxRow>}
            {job.boatRegistration && isCustomer && <BoxRow>Reg: {job.boatRegistration}</BoxRow>}
            {!isCustomer && job.boatStorageLocation && <BoxRow>Storage: <strong>{job.boatStorageLocation}</strong></BoxRow>}
          </InfoBox>
          {job.description && (
            <div style={{ gridColumn: "1 / -1", background: "#f7f9fa", border: "1px solid #dde4e8", borderRadius: 7, padding: "13px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: PRIMARY, marginBottom: 7 }}>
                {isCustomer ? "Work Description" : "Work to Perform"}
              </div>
              <div style={{ fontWeight: isCustomer ? 600 : 700, fontSize: 13 }}>{job.description}</div>
            </div>
          )}
        </div>

        {/* WO-level tech notes — tech copy only */}
        {!isCustomer && job.techNotes && (
          <div style={{ background: "#fffbeb", border: "1px solid #f6cc6a", borderRadius: 7, padding: "13px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "#92400e", marginBottom: 6 }}>Tech Notes (WO Level)</div>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", color: "#222", lineHeight: 1.6 }}>{job.techNotes}</div>
          </div>
        )}

        {/* Charges table */}
        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: PRIMARY, marginBottom: 10 }}>
          {isCustomer ? "Charges" : "Job Lines"}
        </div>
        <table>
          <thead>
            <tr>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: "right" }}>{isCustomer ? "Qty" : "Qty / Hrs"}</th>
              <th style={{ ...thStyle, textAlign: "right" }}>{isCustomer ? "Unit Price" : "Rate"}</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {woJobs.length === 0 && legacyLabor > 0 && (
              <tr>
                <td style={cell}>Labor @ {fmt$(job.laborRate ?? 110)}/hr</td>
                <td style={{ ...cell, textAlign: "right" }}>{job.laborHours}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt$(job.laborRate ?? 110)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt$(legacyLabor)}</td>
              </tr>
            )}
            {rows}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${PRIMARY}` }}>
              <td colSpan={3} style={{ fontWeight: 800, fontSize: 14, padding: "10px 8px" }}>Total</td>
              <td style={{ fontWeight: 800, fontSize: 14, textAlign: "right", padding: "10px 8px" }}>{fmt$(subtotal)}</td>
            </tr>
            {deposit > 0 && (
              <>
                <tr>
                  <td colSpan={3} style={{ fontSize: 12, color: "#555", padding: "6px 8px", borderBottom: "1px dashed #ccc" }}>Deposit Received</td>
                  <td style={{ fontSize: 12, color: "#555", textAlign: "right", padding: "6px 8px", borderBottom: "1px dashed #ccc" }}>- {fmt$(deposit)}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ fontWeight: 800, fontSize: 14, color: PRIMARY, padding: "8px 8px" }}>Balance Due</td>
                  <td style={{ fontWeight: 800, fontSize: 14, color: PRIMARY, textAlign: "right", padding: "8px 8px" }}>{fmt$(balance)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>

        {/* Signature lines — customer copy only */}
        {isCustomer && (
          <div style={{ display: "flex", gap: 36, marginTop: 32, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ borderTop: "1px solid #555", marginBottom: 5 }} />
              <div style={{ fontSize: 10.5, color: "#555" }}>Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ borderTop: "1px solid #555", marginBottom: 5 }} />
              <div style={{ fontSize: 10.5, color: "#555" }}>Authorized By &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #dde4e8", paddingTop: 12, fontSize: 10.5, color: "#999", textAlign: "center" }}>
          {isCustomer
            ? <>Bradley's Boat Care &bull; {BBC_PHONE} &bull; {BBC_EMAIL}<br />Thank you for your business.</>
            : <>INTERNAL — {woNum} &bull; Bradley's Boat Care</>
          }
        </div>

      </div>
    </>
  );
}
