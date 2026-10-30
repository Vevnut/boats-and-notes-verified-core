// ─── Server-rendered Work Order PDF template (Feature A, Batch 2) ─────────────
// Kept in its own module to avoid bloating routes.ts. Logo and colors come from shared/brand.

import { BRAND, BRAND_LOGO_DATA_URL } from "../shared/brand.js";

const NAVY = BRAND.navy;
const BLUE = BRAND.blue;

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
  customerNotes?: string | null;
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
    woJobs.forEach((wj, ji) => {
      const jobParts = parts.filter(p => p.jobId === wj.id);
      const laborAmt = wj.pricingType === "flat" ? (wj.flatRate ?? 0) : (wj.laborHours ?? 0) * (wj.laborRate ?? 110);
      const jobTitle = wj.title ?? wj.name ?? "Job";
      let jobAmt = laborAmt;
      totalLabor += laborAmt;
      jobRows.push(`</tbody><tbody class="job-block">`);
      if (ji > 0) jobRows.push(`<tr class="job-gap"><td colspan="4"></td></tr>`);
      jobRows.push(`<tr class="job-row"><td colspan="4"><span class="job-num">${ji + 1}</span><strong>${esc(jobTitle)}</strong></td></tr>`);
      if (wj.customerNotes) jobRows.push(`<tr class="job-notes"><td colspan="4">${esc(wj.customerNotes)}</td></tr>`);
      if (laborAmt > 0) {
        const laborLabel = wj.pricingType === "flat" ? "Flat rate" : `Labor (${wj.laborHours ?? 0} hrs @ ${fmt$(wj.laborRate ?? 110)}/hr)`;
        jobRows.push(`<tr><td class="indent">${esc(laborLabel)}</td><td class="right">—</td><td class="right">—</td><td class="right">${fmt$(laborAmt)}</td></tr>`);
      }
      for (const p of jobParts) {
        const lineTotal = p.quantity * p.unitPrice;
        totalParts += lineTotal;
        jobAmt += lineTotal;
        jobRows.push(`<tr><td class="indent">${esc(p.description)}${p.partNumber ? ` <span class="muted">(${esc(p.partNumber)})</span>` : ""}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lineTotal)}</td></tr>`);
      }
      jobRows.push(`<tr class="job-total"><td colspan="3">${esc(jobTitle)} total</td><td class="right">${fmt$(jobAmt)}</td></tr>`);
    });
    const unassigned = parts.filter(p => !p.jobId);
    if (unassigned.length > 0) {
      let otherAmt = 0;
      jobRows.push(`</tbody><tbody class="job-block">`);
      jobRows.push(`<tr class="job-gap"><td colspan="4"></td></tr>`);
      jobRows.push(`<tr class="job-row"><td colspan="4">Other Parts &amp; Materials</td></tr>`);
      for (const p of unassigned) {
        const lineTotal = p.quantity * p.unitPrice;
        totalParts += lineTotal;
        otherAmt += lineTotal;
        jobRows.push(`<tr><td class="indent">${esc(p.description)}${p.partNumber ? ` <span class="muted">(${esc(p.partNumber)})</span>` : ""}</td><td class="right">${p.quantity}</td><td class="right">${fmt$(p.unitPrice)}</td><td class="right">${fmt$(lineTotal)}</td></tr>`);
      }
      jobRows.push(`<tr class="job-total"><td colspan="3">Other parts total</td><td class="right">${fmt$(otherAmt)}</td></tr>`);
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
<title>${woNum} — ${esc(BRAND.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: ${BRAND.ink}; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 36px 44px; }
  .header { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand-logo { width: 88px; height: 88px; border-radius: 50%; display: block; }
  .brand-name { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: .01em; color: ${NAVY}; line-height: 1.1; }
  .brand-sub { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: ${BLUE}; margin-top: 4px; }
  .brand-contact { font-size: 11px; color: ${BRAND.muted}; margin-top: 7px; line-height: 1.7; }
  .doc-meta { text-align: right; font-size: 11px; color: ${BRAND.muted}; line-height: 1.8; flex-shrink: 0; }
  .doc-meta .doc-type { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .16em; color: #fff; background: ${NAVY}; padding: 4px 10px; border-radius: 3px; }
  .doc-meta .wo-num { font-size: 26px; font-weight: 900; color: ${NAVY}; line-height: 1.2; margin-top: 4px; }
  .doc-meta strong { color: ${BRAND.ink}; }
  .header-rule { height: 6px; background: ${NAVY}; border-bottom: 3px solid ${BLUE}; box-sizing: content-box; margin-bottom: 22px; }
  .info-grid { display: flex; gap: 14px; margin-bottom: 20px; }
  .info-box { flex: 1; background: ${BRAND.navyTint}; border: 1px solid ${BRAND.rule}; border-top: 3px solid ${NAVY}; border-radius: 8px; padding: 12px 14px; }
  .info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; color: ${BLUE}; margin-bottom: 6px; }
  .info-row { font-size: 12px; color: #39445c; margin-top: 2px; }
  .info-row strong { color: ${NAVY}; font-size: 13.5px; }
  .section-title { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; color: ${NAVY}; margin: 22px 0 9px; display: flex; align-items: center; gap: 7px; }
  .section-title::after { content: ''; flex: 1; height: 2px; background: ${BLUE}; opacity: .35; }
  .desc-block { font-size: 12.5px; line-height: 1.55; color: #1c2740; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { text-align: left; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #fff; background: ${NAVY}; padding: 8px 8px; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #e6eaf2; vertical-align: top; color: #1c2740; }
  .job-block { page-break-inside: avoid; break-inside: avoid; }
  tr.job-gap td { height: 20px; padding: 0; border: none; background: #fff; }
  tr.job-row td { background: ${BRAND.blueTint}; color: ${NAVY}; font-weight: 700; padding: 9px 8px; border-top: 3px solid ${NAVY}; border-bottom: 1px solid ${BRAND.rule}; }
  .job-num { display: inline-block; min-width: 20px; height: 20px; line-height: 20px; border-radius: 10px; background: ${NAVY}; color: #fff; font-size: 10.5px; font-weight: 800; text-align: center; margin-right: 8px; padding: 0 6px; }
  tr.job-total td { background: ${BRAND.navyTint}; color: ${NAVY}; font-weight: 800; padding: 8px 8px; border-top: 1px solid ${BRAND.rule}; border-bottom: 2px solid ${NAVY}; }
  tr.job-notes td { font-size: 11.5px; line-height: 1.55; color: #39445c; white-space: pre-wrap; padding: 8px 8px 9px 20px; }
  td.indent { padding-left: 20px; }
  td.right, th.right { text-align: right; }
  .muted { color: ${BRAND.muted}; font-size: 11px; }
  .totals { margin-top: 14px; margin-left: auto; width: 290px; font-size: 12.5px; border: 1px solid ${BRAND.rule}; border-radius: 8px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 7px 12px; color: #39445c; }
  .totals-row.grand { border-top: 2px solid ${NAVY}; background: ${BRAND.navyTint}; font-weight: 800; font-size: 14.5px; color: ${NAVY}; padding: 9px 12px; }
  .totals-row.balance { font-weight: 900; font-size: 14.5px; color: #fff; background: ${NAVY}; border-top: 3px solid ${BLUE}; padding: 10px 12px; }
  .sig-box { margin-top: 34px; }
  .sig-img { max-height: 70px; border-bottom: 1px solid ${NAVY}; }
  .sig-meta { font-size: 11px; color: ${BRAND.muted}; margin-top: 4px; }
  .sig-rule { border-top: 1px solid ${NAVY}; width: 320px; }
  .sig-caption { font-size: 10px; color: ${BRAND.muted}; margin-top: 4px; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 2px solid ${NAVY}; text-align: center; font-size: 10px; color: ${BRAND.muted}; line-height: 1.7; }
  .footer strong { color: ${NAVY}; }
</style>
</head>
<body><div class="page">

  <div class="header">
    <div class="brand">
      <img class="brand-logo" src="${BRAND_LOGO_DATA_URL}" alt="${esc(BRAND.name)} logo" />
      <div>
        <div class="brand-name">${esc(BRAND.name)}</div>
        <div class="brand-sub">${BRAND.tagline} &bull; ${BRAND.town}</div>
        <div class="brand-contact">${BRAND.phone} &bull; ${BRAND.email}<br>${BRAND.website}</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">Work Order</div>
      <div class="wo-num">${woNum}</div>
      <div>Date: <strong>${esc(job.date)}</strong></div>
      ${job.dueDate ? `<div>Due: <strong>${esc(job.dueDate)}</strong></div>` : ""}
      <div>Status: ${esc(job.status)}</div>
    </div>
  </div>
  <div class="header-rule"></div>

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
  ${job.techNotes ? `<div class="desc-block" style="margin-top:6px;color:${BRAND.muted};"><em>Notes: ${esc(job.techNotes)}</em></div>` : ""}
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
    <strong>${esc(BRAND.name)}</strong> &bull; ${BRAND.tagline} &bull; ${BRAND.town}<br>
    ${BRAND.phone} &bull; ${BRAND.email} &bull; ${BRAND.website}<br>
    Thank you for your business.
  </div>

</div></body></html>`;
}
