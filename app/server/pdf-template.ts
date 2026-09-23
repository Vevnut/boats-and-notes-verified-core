// ─── Server-rendered Work Order PDF template (Feature A, Batch 2) ─────────────
// Kept in its own module to avoid bloating routes.ts. Navy accent per brief spec.

const NAVY = "#1e3a5f";
const BBC_PHONE = "(603) 273-2491";
const BBC_EMAIL = "BradleysBoatCare@gmail.com";

function esc(s: any): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt$(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export type PdfJob = {
  id: number;
  date: string;
  dueDate?: string | null;
  status: string;
  description?: string | null;
  techNotes?: string | null;
  laborHours?: number | null;
  laborRate?: number | null;
  depositAmount?: number | null;
  signatureDataUrl?: string | null;
  signedBy?: string | null;
  signedAt?: string | null;
};

export type PdfCustomer = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type PdfBoat = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  hullId?: string | null;
  registrationNumber?: string | null;
  engineMake?: string | null;
  engineModel?: string | null;
};

export type PdfWoJob = {
  id: number;
  title?: string;
  name?: string;
  description?: string | null;
  pricingType: string;
  laborHours?: number | null;
  laborRate?: number | null;
  flatRate?: number | null;
};

export type PdfPart = {
  jobId?: number | null;
  partNumber?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function renderWorkOrderPdfHtml(opts: {
  job: PdfJob;
  customer: PdfCustomer;
  boat: PdfBoat;
  woJobs: PdfWoJob[];
  parts: PdfPart[];
}): string {
  const { job, customer, boat, woJobs, parts } = opts;
  const woNum = `WO-${String(job.id).padStart(4, "0")}`;
  const boatLine = [boat.year, boat.make, boat.model].filter(Boolean).join(" ") || "—";

  let totalLabor = 0;
  let totalParts = 0;
  const jobRows: string[] = [];

  if (woJobs.length > 0) {
    for (const wj of woJobs) {
      const jobParts = parts.filter(p => p.jobId === wj.id);
      const laborAmt = wj.pricingType === "flat" ? (wj.flatRate ?? 0) : (wj.laborHours ?? 0) * (wj.laborRate ?? 110);
      totalLabor += laborAmt;
      jobRows.push(`<tr class="job-row"><td colspan="4"><strong>${esc(wj.title ?? wj.name ?? "Job")}</strong>${wj.description ? ` — ${esc(wj.description)}` : ""}</td></tr>`);
      if (laborAmt > 0) {
        const laborLabel = wj.pricingType === "flat" ? "Flat rate" : `Labor (${wj.laborHours ?? 0} hrs @ ${fmt$(wj.laborRate ?? 110)}/hr)`;
        jobRows.push(`<tr><td class="indent">${esc(laborLabel)}</td><td class="right">—</td><td class="right">—</td><td class="right">${fmt$(laborAmt)}</td></tr>`);
      }
      for (const p of jobParts) {
        const lineTotal = p.quantity * p.unitPrice;
        totalParts += lineTotal;
        jobRows.push(`<tr><td class="indent">${esc(p.description)}${p.partNumber ? ` <span class="muted">(${esc(p.partNumber)})</span>` : ""}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lineTotal)}</td></tr>`);
      }
    }
    const unassigned = parts.filter(p => !p.jobId);
    if (unassigned.length > 0) {
      jobRows.push(`<tr class="job-row"><td colspan="4">Other Parts &amp; Materials</td></tr>`);
      for (const p of unassigned) {
        const lineTotal = p.quantity * p.unitPrice;
        totalParts += lineTotal;
        jobRows.push(`<tr><td class="indent">${esc(p.description)}${p.partNumber ? ` <span class="muted">(${esc(p.partNumber)})</span>` : ""}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lineTotal)}</td></tr>`);
      }
    }
  } else {
    // Legacy WO with no job lines — use WO-level labor + flat parts list
    const legacyLabor = (job.laborHours ?? 0) * (job.laborRate ?? 110);
    if (legacyLabor > 0) {
      totalLabor += legacyLabor;
      jobRows.push(`<tr><td>Labor (${job.laborHours} hrs @ ${fmt$(job.laborRate ?? 110)}/hr)</td><td class="right">${job.laborHours}</td><td class="right">${fmt$(job.laborRate ?? 110)}</td><td class="right">${fmt$(legacyLabor)}</td></tr>`);
    }
    for (const p of parts) {
      const lineTotal = p.quantity * p.unitPrice;
      totalParts += lineTotal;
      jobRows.push(`<tr><td>${esc(p.description)}${p.partNumber ? ` <span class="muted">(${esc(p.partNumber)})</span>` : ""}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lineTotal)}</td></tr>`);
    }
  }

  const grandTotal = totalLabor + totalParts;
  const deposit = job.depositAmount ?? 0;
  const balance = grandTotal - deposit;

  const signatureBlock = job.signatureDataUrl
    ? `<div class="sig-box">
         <img src="${esc(job.signatureDataUrl)}" alt="Customer signature" class="sig-img" />
         <div class="sig-meta">Signed by <strong>${esc(job.signedBy ?? "Customer")}</strong>${job.signedAt ? ` on ${esc(new Date(job.signedAt).toLocaleString())}` : ""}</div>
       </div>`
    : `<div class="sig-box sig-empty">
         <div class="sig-rule"></div>
         <div class="sig-caption">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</div>
       </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${woNum} — Bradley's Boat Care</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 0; padding: 0; }
  .page { padding: 42px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${NAVY}; padding-bottom: 16px; margin-bottom: 20px; }
  .brand-name { font-size: 26px; font-weight: bold; color: ${NAVY}; }
  .brand-sub { font-size: 13px; color: #555; margin-top: 2px; font-style: italic; }
  .doc-meta { text-align: right; font-family: Arial, sans-serif; font-size: 12px; color: #333; }
  .doc-meta .wo-num { font-size: 18px; font-weight: bold; color: ${NAVY}; font-family: Arial, sans-serif; }
  .info-grid { display: flex; gap: 24px; margin-bottom: 20px; }
  .info-box { flex: 1; background: #f7f8fa; border: 1px solid #e2e5e9; border-radius: 6px; padding: 12px 14px; font-family: Arial, sans-serif; }
  .info-label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: ${NAVY}; margin-bottom: 6px; }
  .info-row { font-size: 12px; color: #333; margin-top: 2px; }
  .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: ${NAVY}; border-bottom: 1px solid #d8dce1; padding-bottom: 5px; margin: 22px 0 10px; font-family: Arial, sans-serif; }
  .desc-block { font-family: Arial, sans-serif; font-size: 12.5px; line-height: 1.5; color: #333; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
  thead th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #666; border-bottom: 2px solid #d8dce1; padding: 6px 4px; }
  tbody td { padding: 6px 4px; border-bottom: 1px solid #eceef1; vertical-align: top; }
  tr.job-row td { background: #f0f3f6; font-weight: bold; padding-top: 10px; }
  td.indent { padding-left: 18px; }
  td.right, th.right { text-align: right; }
  .muted { color: #888; font-size: 11px; }
  .totals { margin-top: 16px; margin-left: auto; width: 280px; font-family: Arial, sans-serif; font-size: 12.5px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals-row.grand { border-top: 2px solid ${NAVY}; margin-top: 4px; padding-top: 8px; font-weight: bold; font-size: 14px; color: ${NAVY}; }
  .totals-row.balance { font-weight: bold; color: #b34700; }
  .sig-box { margin-top: 34px; }
  .sig-img { max-height: 70px; border-bottom: 1px solid #999; }
  .sig-meta { font-family: Arial, sans-serif; font-size: 11px; color: #555; margin-top: 4px; }
  .sig-rule { border-top: 1px solid #999; width: 320px; }
  .sig-caption { font-family: Arial, sans-serif; font-size: 10px; color: #777; margin-top: 4px; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #d8dce1; text-align: center; font-family: Arial, sans-serif; font-size: 10.5px; color: #777; }
</style>
</head>
<body><div class="page">

  <div class="header">
    <div>
      <div class="brand-name">Bradley's Boat Care</div>
      <div class="brand-sub">Marine Service Work Order</div>
    </div>
    <div class="doc-meta">
      <div class="wo-num">${woNum}</div>
      <div>Date: ${esc(job.date)}</div>
      ${job.dueDate ? `<div>Due: ${esc(job.dueDate)}</div>` : ""}
      <div>Status: ${esc(job.status)}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Customer</div>
      <div class="info-row"><strong>${esc(customer.name)}</strong></div>
      ${customer.phone ? `<div class="info-row">${esc(customer.phone)}</div>` : ""}
      ${customer.email ? `<div class="info-row">${esc(customer.email)}</div>` : ""}
      ${customer.address ? `<div class="info-row">${esc(customer.address)}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-label">Vessel</div>
      <div class="info-row"><strong>${esc(boatLine)}</strong></div>
      ${boat.hullId ? `<div class="info-row">HIN: ${esc(boat.hullId)}</div>` : ""}
      ${boat.registrationNumber ? `<div class="info-row">Reg: ${esc(boat.registrationNumber)}</div>` : ""}
      ${(boat.engineMake || boat.engineModel) ? `<div class="info-row">Engine: ${esc([boat.engineMake, boat.engineModel].filter(Boolean).join(" "))}</div>` : ""}
    </div>
  </div>

  ${job.description || job.techNotes ? `
  <div class="section-title">Work Performed</div>
  ${job.description ? `<div class="desc-block">${esc(job.description)}</div>` : ""}
  ${job.techNotes ? `<div class="desc-block" style="margin-top:6px;color:#666;"><em>Notes: ${esc(job.techNotes)}</em></div>` : ""}
  ` : ""}

  <div class="section-title">Jobs &amp; Parts</div>
  <table>
    <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${jobRows.length > 0 ? jobRows.join("\n") : `<tr><td colspan="4" class="muted">No jobs or parts recorded.</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    ${totalLabor > 0 ? `<div class="totals-row"><span>Total Labor</span><span>${fmt$(totalLabor)}</span></div>` : ""}
    ${totalParts > 0 ? `<div class="totals-row"><span>Total Parts &amp; Materials</span><span>${fmt$(totalParts)}</span></div>` : ""}
    <div class="totals-row grand"><span>Total</span><span>${fmt$(grandTotal)}</span></div>
    ${deposit > 0 ? `<div class="totals-row"><span>Deposit Received</span><span>-${fmt$(deposit)}</span></div><div class="totals-row balance"><span>Balance Due</span><span>${fmt$(balance)}</span></div>` : ""}
  </div>

  ${signatureBlock}

  <div class="footer">
    Bradley's Boat Care &bull; Conway, NH &bull; ${BBC_PHONE} &bull; ${BBC_EMAIL}<br>
    Thank you for your business.
  </div>

</div></body></html>`;
}
