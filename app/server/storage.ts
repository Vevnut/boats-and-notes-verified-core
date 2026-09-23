import supabase from "./supabase.js";

// ─── Type helpers ─────────────────────────────────────────────────────────────
// Map Supabase snake_case rows to camelCase objects the rest of the app uses

function toCust(r: any) {
  return { id: r.id, name: r.name, phone: r.phone ?? null, email: r.email ?? null, address: r.address ?? null, notes: r.notes ?? null };
}
function toBoat(r: any) {
  return {
    id: r.id, customerId: r.customer_id, make: r.make, model: r.model ?? null, year: r.year ?? null,
    color: r.color ?? null, length: r.length ?? null, engineType: r.engine_type ?? null,
    engineMake: r.engine_make ?? null, engineModel: r.engine_model ?? null, engineHours: r.engine_hours ?? null,
    horsepower: r.horsepower ?? null, hullId: r.hull_id ?? null, registrationNumber: r.registration_number ?? null,
    storageLocation: r.storage_location ?? null, notes: r.notes ?? null, reminders: r.reminders ?? "[]",
    stickyNote: r.sticky_note ?? null, engineSerial: r.engine_serial ?? null,
    transomSerial: r.transom_serial ?? null, driveSerial: r.drive_serial ?? null,
  };
}
function toSvc(r: any) {
  return {
    id: r.id, boatId: r.boat_id, date: r.date, description: r.description ?? "",
    techNotes: r.tech_notes ?? null, laborHours: r.labor_hours ?? null, cost: r.cost ?? null,
    status: r.status ?? "open", laborRate: r.labor_rate ?? 110, depositAmount: r.deposit_amount ?? null,
    paid: r.paid ?? 0, dueDate: r.due_date ?? null,
    signatureDataUrl: r.signature_data_url ?? null, signedBy: r.signed_by ?? null, signedAt: r.signed_at ?? null,
  };
}
function toPart(r: any) {
  return {
    id: r.id, serviceRecordId: r.service_record_id, partNumber: r.part_number ?? null,
    description: r.description, quantity: r.quantity ?? 1, unitPrice: r.unit_price ?? 0,
    orderStatus: r.order_status ?? null, catalogPartId: r.catalog_part_id ?? null, jobId: r.job_id ?? null,
  };
}
function toCatalog(r: any) {
  return {
    id: r.id, partNumber: r.part_number ?? null, description: r.description,
    category: r.category ?? null, costPrice: r.cost_price ?? 0, sellPrice: r.sell_price ?? 0,
    qtyOnHand: r.qty_on_hand ?? 0, reorderPoint: r.reorder_point ?? 0,
    notes: r.notes ?? null, isCommon: r.is_common ?? 0,
  };
}
function toLabor(r: any) {
  return { id: r.id, code: r.code ?? null, description: r.description, hours: r.hours, category: r.category ?? null };
}
function toWOJob(r: any) {
  return {
    id: r.id, serviceRecordId: r.service_record_id, title: r.name ?? "Job", name: r.name ?? "Job",
    description: r.description ?? null, pricingType: r.pricing_type ?? "hourly",
    laborHours: r.labor_hours ?? 0, laborRate: r.labor_rate ?? 110,
    flatRate: r.flat_rate ?? null, sortOrder: r.sort_order ?? 0,
    customerNotes: r.customer_notes ?? null, techNotes: r.tech_notes ?? null,
    status: r.status ?? "open",
  };
}
function toCommonJob(r: any) {
  return {
    id: r.id, name: r.name, description: r.description ?? null, pricingType: r.pricing_type ?? "hourly",
    laborHours: r.labor_hours ?? 0, laborRate: r.labor_rate ?? 110, flatRate: r.flat_rate ?? null,
    category: r.category ?? null,
  };
}
function toPhoto(r: any) {
  return {
    id: r.id,
    serviceRecordId: r.service_record_id ?? null,
    customerId: r.customer_id ?? null,
    dataUrl: r.data_url ?? null,
    storageUrl: r.storage_url ?? null,
    storagePath: r.storage_path ?? null,
    filename: r.filename ?? "",
    caption: r.caption ?? null,
    createdAt: r.created_at,
  };
}
function toCommLog(r: any) {
  return { id: r.id, customerId: r.customer_id, timestamp: r.timestamp, type: r.type, notes: r.notes ?? null };
}
function toTab(r: any) {
  return { id: r.id, label: r.label, sortOrder: r.sort_order ?? 0, matchPrefix: r.match_prefix ?? "" };
}
function toEvent(r: any) {
  return {
    id: r.id, eventType: r.event_type, scheduledDate: r.scheduled_date,
    timeSlot: r.time_slot, customerId: r.customer_id ?? null,
    boatId: r.boat_id ?? null, serviceRecordId: r.service_record_id ?? null,
    title: r.title, notes: r.notes ?? null, status: r.status ?? "scheduled",
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
    // Only present when joined:
    customerName: r.customers?.name ?? r._customerName ?? null,
    boatMake: r.boats?.make ?? r._boatMake ?? null,
  };
}

async function logActivity(action: string, entityType: string, entityId: number | undefined, description: string) {
  await supabase.from("activity_log").insert({
    timestamp: new Date().toISOString(), action, entity_type: entityType, entity_id: entityId ?? null, description,
  });
}

// ─── Expanded joined type used by routes ─────────────────────────────────────
type OpenJobRow = ReturnType<typeof toSvc> & {
  boatMake: string; boatModel: string; boatYear: number | null; boatColor: string | null;
  boatEngineType: string | null; boatEngineMake: string | null; boatEngineModel: string | null;
  boatEngineHours: number | null; boatHullId: string | null; boatRegistration: string | null;
  boatStorageLocation: string | null; customerName: string; customerPhone: string | null;
  customerEmail: string | null; customerAddress: string | null; customerNotes: string | null; boatId: number;
};

function joinJobRow(svc: any, boat: any, customer: any): OpenJobRow {
  return {
    ...toSvc(svc),
    boatId: svc.boat_id,
    boatMake: boat?.make ?? "",
    boatModel: boat?.model ?? "",
    boatYear: boat?.year ?? null,
    boatColor: boat?.color ?? null,
    boatEngineType: boat?.engine_type ?? null,
    boatEngineMake: boat?.engine_make ?? null,
    boatEngineModel: boat?.engine_model ?? null,
    boatEngineHours: boat?.engine_hours ?? null,
    boatHullId: boat?.hull_id ?? null,
    boatRegistration: boat?.registration_number ?? null,
    boatStorageLocation: boat?.storage_location ?? null,
    customerName: customer?.name ?? "Unknown",
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    customerAddress: customer?.address ?? null,
    customerNotes: customer?.notes ?? null,
  };
}

// ─── Storage implementation (all async) ──────────────────────────────────────
export const storage = {
  // Missing from the recovered implementation; restored for the test copy.
  async getWorkOrderTemplates() {
    const { data } = await supabase.from("work_order_templates").select("*").order("name");
    return data.map((r: any) => ({ ...r, techNotes: r.tech_notes, laborHours: r.labor_hours, laborRate: r.labor_rate }));
  },
  async createWorkOrderTemplate(data: any) {
    const { data: r } = await supabase.from("work_order_templates").insert({
      name: data.name, description: data.description ?? "", tech_notes: data.techNotes ?? "",
      labor_hours: data.laborHours ?? 0, labor_rate: data.laborRate ?? 110,
      category: data.category ?? null, parts: typeof data.parts === "string" ? data.parts : JSON.stringify(data.parts ?? []),
    }).select().single();
    return { ...r, techNotes: r.tech_notes, laborHours: r.labor_hours, laborRate: r.labor_rate };
  },
  async updateWorkOrderTemplate(id: number, data: any) {
    const changes: any = {};
    const fields: Record<string, string> = { name: "name", description: "description", techNotes: "tech_notes", laborHours: "labor_hours", laborRate: "labor_rate", category: "category", parts: "parts" };
    for (const [key, field] of Object.entries(fields)) if (data[key] !== undefined) changes[field] = data[key];
    const { data: r } = await supabase.from("work_order_templates").update(changes).eq("id", id).select().single();
    return r ? { ...r, techNotes: r.tech_notes, laborHours: r.labor_hours, laborRate: r.labor_rate } : undefined;
  },
  async deleteWorkOrderTemplate(id: number) {
    await supabase.from("work_order_templates").delete().eq("id", id);
  },

  // ── Customers ────────────────────────────────────────────────────────────
  async getCustomers() {
    const { data: custs } = await supabase.from("customers").select("*").order("name");
    const { data: allBoats } = await supabase.from("boats").select("id, customer_id");
    return (custs ?? []).map(c => ({
      ...toCust(c),
      boatCount: (allBoats ?? []).filter(b => b.customer_id === c.id).length,
    }));
  },
  async getCustomer(id: number) {
    const { data } = await supabase.from("customers").select("*").eq("id", id).single();
    return data ? toCust(data) : undefined;
  },
  async createCustomer(data: any) {
    const { data: r } = await supabase.from("customers").insert({
      name: data.name, phone: data.phone ?? null, email: data.email ?? null,
      address: data.address ?? null, notes: data.notes ?? null,
    }).select().single();
    await logActivity("created", "customer", r!.id, `Added customer: ${r!.name}`);
    return toCust(r!);
  },
  async updateCustomer(id: number, data: any) {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.email !== undefined) update.email = data.email;
    if (data.address !== undefined) update.address = data.address;
    if (data.notes !== undefined) update.notes = data.notes;
    const { data: r } = await supabase.from("customers").update(update).eq("id", id).select().single();
    if (r) await logActivity("updated", "customer", id, `Updated customer: ${r.name}`);
    return r ? toCust(r) : undefined;
  },
  async deleteCustomer(id: number) {
    const { data: c } = await supabase.from("customers").select("name").eq("id", id).single();
    await supabase.from("customers").delete().eq("id", id);
    if (c) await logActivity("deleted", "customer", id, `Removed customer: ${c.name}`);
  },
  async searchCustomers(query: string) {
    const all = await this.getCustomers();
    const q = query.toLowerCase();
    return all.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  },

  // ── Boats ────────────────────────────────────────────────────────────────
  async getBoats(customerId?: number) {
    let q = supabase.from("boats").select("*");
    if (customerId !== undefined) q = q.eq("customer_id", customerId);
    const { data } = await q;
    return (data ?? []).map(toBoat);
  },
  async getBoat(id: number) {
    const { data } = await supabase.from("boats").select("*").eq("id", id).single();
    return data ? toBoat(data) : undefined;
  },
  async createBoat(data: any) {
    const { data: r } = await supabase.from("boats").insert({
      customer_id: data.customerId, make: data.make, model: data.model ?? null, year: data.year ?? null,
      color: data.color ?? null, length: data.length ?? null, engine_type: data.engineType ?? null,
      engine_make: data.engineMake ?? null, engine_model: data.engineModel ?? null,
      engine_hours: data.engineHours ?? null, horsepower: data.horsepower ?? null,
      hull_id: data.hullId ?? null, registration_number: data.registrationNumber ?? null,
      storage_location: data.storageLocation ?? null, notes: data.notes ?? null,
      reminders: data.reminders ?? "[]", sticky_note: data.stickyNote ?? null,
      engine_serial: data.engineSerial ?? null, transom_serial: data.transomSerial ?? null,
      drive_serial: data.driveSerial ?? null,
    }).select().single();
    await logActivity("created", "boat", r!.id, `Added boat: ${r!.year ?? ""} ${r!.make} ${r!.model ?? ""}`);
    return toBoat(r!);
  },
  async updateBoat(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      customerId: "customer_id", make: "make", model: "model", year: "year", color: "color",
      length: "length", engineType: "engine_type", engineMake: "engine_make", engineModel: "engine_model",
      engineHours: "engine_hours", horsepower: "horsepower", hullId: "hull_id",
      registrationNumber: "registration_number", storageLocation: "storage_location", notes: "notes",
      reminders: "reminders", stickyNote: "sticky_note", engineSerial: "engine_serial",
      transomSerial: "transom_serial", driveSerial: "drive_serial",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    const { data: r } = await supabase.from("boats").update(update).eq("id", id).select().single();
    if (r) await logActivity("updated", "boat", id, `Updated boat: ${r.make} ${r.model ?? ""}`);
    return r ? toBoat(r) : undefined;
  },
  async deleteBoat(id: number) {
    const { data: b } = await supabase.from("boats").select("make,model").eq("id", id).single();
    await supabase.from("boats").delete().eq("id", id);
    if (b) await logActivity("deleted", "boat", id, `Removed boat: ${b.make} ${b.model ?? ""}`);
  },
  async searchBoats(query: string) {
    const { data: allBoats } = await supabase.from("boats").select("*");
    const { data: allCustomers } = await supabase.from("customers").select("id,name");
    const q = query.toLowerCase();
    return (allBoats ?? [])
      .filter(b =>
        b.make.toLowerCase().includes(q) ||
        (b.model ?? "").toLowerCase().includes(q) ||
        String(b.year ?? "").includes(q) ||
        (b.hull_id ?? "").toLowerCase().includes(q)
      )
      .map(b => ({
        ...toBoat(b),
        customerName: (allCustomers ?? []).find(c => c.id === b.customer_id)?.name ?? "Unknown",
      }));
  },

  // ── Service Records ───────────────────────────────────────────────────────
  async getServiceRecords(boatId: number) {
    const { data } = await supabase.from("service_records").select("*").eq("boat_id", boatId).order("date", { ascending: false });
    return (data ?? []).map(toSvc);
  },
  async getServiceRecord(id: number) {
    const { data } = await supabase.from("service_records").select("*").eq("id", id).single();
    return data ? toSvc(data) : undefined;
  },
  async getAllOpenJobs() {
    const { data: svcs } = await supabase.from("service_records").select("*").not("status", "in", '("invoiced","complete")');
    const { data: allBoats } = await supabase.from("boats").select("*");
    const { data: allCustomers } = await supabase.from("customers").select("*");
    return (svcs ?? []).map(s => {
      const boat = (allBoats ?? []).find(b => b.id === s.boat_id);
      const customer = (allCustomers ?? []).find(c => c.id === boat?.customer_id);
      return joinJobRow(s, boat, customer);
    });
  },
  async getInvoicedJobs() {
    const { data: svcs } = await supabase.from("service_records").select("*").in("status", ["invoiced", "complete"]);
    const { data: allBoats } = await supabase.from("boats").select("*");
    const { data: allCustomers } = await supabase.from("customers").select("*");
    return (svcs ?? []).map(s => {
      const boat = (allBoats ?? []).find(b => b.id === s.boat_id);
      const customer = (allCustomers ?? []).find(c => c.id === boat?.customer_id);
      return joinJobRow(s, boat, customer);
    });
  },
  async createServiceRecord(data: any) {
    const { data: r } = await supabase.from("service_records").insert({
      boat_id: data.boatId, date: data.date, description: data.description ?? "",
      tech_notes: data.techNotes ?? null, labor_hours: data.laborHours ?? null,
      cost: data.cost ?? null, status: data.status ?? "open",
      labor_rate: data.laborRate ?? 110, deposit_amount: data.depositAmount ?? null,
      paid: data.paid ?? 0, due_date: data.dueDate ?? null,
    }).select().single();
    await logActivity("created", "service", r!.id, `New service record: ${r!.description}`);
    return toSvc(r!);
  },
  async updateServiceRecord(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      boatId: "boat_id", date: "date", description: "description", techNotes: "tech_notes",
      laborHours: "labor_hours", cost: "cost", status: "status", laborRate: "labor_rate",
      depositAmount: "deposit_amount", paid: "paid", dueDate: "due_date",
      signatureDataUrl: "signature_data_url", signedBy: "signed_by", signedAt: "signed_at",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    const { data: r } = await supabase.from("service_records").update(update).eq("id", id).select().single();
    if (r) await logActivity("updated", "service", id, `Updated service: ${r.description}`);
    return r ? toSvc(r) : undefined;
  },
  async deleteServiceRecord(id: number) {
    const { data: s } = await supabase.from("service_records").select("description").eq("id", id).single();
    await supabase.from("service_records").delete().eq("id", id);
    if (s) await logActivity("deleted", "service", id, `Removed service record: ${s.description}`);
  },

  // ── Parts ─────────────────────────────────────────────────────────────────
  async getParts(serviceRecordId: number) {
    const { data } = await supabase.from("parts").select("*").eq("service_record_id", serviceRecordId);
    return (data ?? []).map(toPart);
  },
  async getAllPendingOrderParts() {
    const { data: allParts } = await supabase.from("parts").select("*").not("order_status", "in", '("received")');
    const { data: allSvc } = await supabase.from("service_records").select("*");
    const { data: allBoats } = await supabase.from("boats").select("*");
    const { data: allCustomers } = await supabase.from("customers").select("*");
    return (allParts ?? []).map(p => {
      const svc = (allSvc ?? []).find(s => s.id === p.service_record_id);
      const boat = (allBoats ?? []).find(b => b.id === svc?.boat_id);
      const customer = (allCustomers ?? []).find(c => c.id === boat?.customer_id);
      return {
        ...toPart(p),
        serviceDescription: svc?.description ?? "",
        boatName: boat ? `${boat.year ?? ""} ${boat.make} ${boat.model ?? ""}`.trim() : "",
        customerName: customer?.name ?? "",
        serviceRecordId: p.service_record_id,
      };
    });
  },
  async createPart(data: any) {
    const { data: r } = await supabase.from("parts").insert({
      service_record_id: data.serviceRecordId, part_number: data.partNumber ?? null,
      description: data.description, quantity: data.quantity ?? 1, unit_price: data.unitPrice ?? 0,
      order_status: data.orderStatus ?? null, catalog_part_id: data.catalogPartId ?? null,
      job_id: data.jobId ?? null,
    }).select().single();
    return toPart(r!);
  },
  async updatePart(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      partNumber: "part_number", description: "description", quantity: "quantity",
      unitPrice: "unit_price", orderStatus: "order_status", catalogPartId: "catalog_part_id", jobId: "job_id",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    const { data: r } = await supabase.from("parts").update(update).eq("id", id).select().single();
    return r ? toPart(r) : undefined;
  },
  async deletePart(id: number) {
    await supabase.from("parts").delete().eq("id", id);
  },

  // ── Parts Catalog ─────────────────────────────────────────────────────────
  async getPartsCatalog(search?: string) {
    let q = supabase.from("parts_catalog").select("*").order("description");
    if (search) q = q.ilike("description", `%${search}%`);
    const { data } = await q;
    return (data ?? []).map(toCatalog);
  },
  async getPartsCatalogItem(id: number) {
    const { data } = await supabase.from("parts_catalog").select("*").eq("id", id).single();
    return data ? toCatalog(data) : undefined;
  },
  async createPartsCatalogItem(data: any) {
    const { data: r, error } = await supabase.from("parts_catalog").insert({
      part_number: data.partNumber ?? null, description: data.description,
      category: data.category ?? null, cost_price: data.costPrice ?? 0, sell_price: data.sellPrice ?? 0,
      qty_on_hand: data.qtyOnHand ?? 0, reorder_point: data.reorderPoint ?? 0,
      notes: data.notes ?? null, is_common: data.isCommon ? 1 : 0,
    }).select().single();
    if (error) throw new Error(error.message);
    return toCatalog(r!);
  },
  async updatePartsCatalogItem(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      partNumber: "part_number", description: "description", category: "category",
      costPrice: "cost_price", sellPrice: "sell_price", qtyOnHand: "qty_on_hand",
      reorderPoint: "reorder_point", notes: "notes", isCommon: "is_common",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    const { data: r } = await supabase.from("parts_catalog").update(update).eq("id", id).select().single();
    return r ? toCatalog(r) : undefined;
  },
  async deletePartsCatalogItem(id: number) {
    await supabase.from("parts_catalog").delete().eq("id", id);
  },
  async adjustInventory(id: number, qtyChange: number) {
    const { data: item } = await supabase.from("parts_catalog").select("qty_on_hand").eq("id", id).single();
    if (!item) return undefined;
    const newQty = (item.qty_on_hand ?? 0) + qtyChange;
    const { data: r } = await supabase.from("parts_catalog").update({ qty_on_hand: newQty }).eq("id", id).select().single();
    return r ? toCatalog(r) : undefined;
  },

  // ── Labor Codes ───────────────────────────────────────────────────────────
  async getLaborCodes() {
    const { data } = await supabase.from("labor_codes").select("*").order("category");
    return (data ?? []).map(toLabor);
  },
  async createLaborCode(data: any) {
    const { data: r } = await supabase.from("labor_codes").insert({
      code: data.code ?? null, description: data.description, hours: data.hours, category: data.category ?? null,
    }).select().single();
    return toLabor(r!);
  },
  async updateLaborCode(id: number, data: any) {
    const { data: r } = await supabase.from("labor_codes").update({
      code: data.code, description: data.description, hours: data.hours, category: data.category,
    }).eq("id", id).select().single();
    return r ? toLabor(r) : undefined;
  },
  async deleteLaborCode(id: number) {
    await supabase.from("labor_codes").delete().eq("id", id);
  },

  // ── Catalog Tabs ──────────────────────────────────────────────────────────
  async getCatalogTabs() {
    const { data } = await supabase.from("catalog_tabs").select("*").order("sort_order");
    return (data ?? []).map(toTab);
  },
  async createCatalogTab(label: string, matchPrefix: string) {
    const { data: existing } = await supabase.from("catalog_tabs").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;
    const { data: r } = await supabase.from("catalog_tabs").insert({ label, sort_order: nextOrder, match_prefix: matchPrefix }).select().single();
    return toTab(r!);
  },
  async updateCatalogTab(id: number, label: string, matchPrefix: string) {
    await supabase.from("catalog_tabs").update({ label, match_prefix: matchPrefix }).eq("id", id);
  },
  async deleteCatalogTab(id: number) {
    await supabase.from("catalog_tabs").delete().eq("id", id);
  },
  async reorderCatalogTabs(ids: number[]) {
    await Promise.all(ids.map((id, i) => supabase.from("catalog_tabs").update({ sort_order: i }).eq("id", id)));
  },

  // ── Activity Log ─────────────────────────────────────────────────────────
  async getRecentActivity(limit = 20) {
    const { data } = await supabase.from("activity_log").select("*").order("timestamp", { ascending: false }).limit(limit);
    return (data ?? []).map(r => ({
      id: r.id, timestamp: r.timestamp, action: r.action,
      entityType: r.entity_type, entityId: r.entity_id ?? null, description: r.description,
    }));
  },

  // ── Export ────────────────────────────────────────────────────────────────
  async exportAll() {
    const [{ data: custs }, { data: bts }, { data: svcs }, { data: pts }] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("boats").select("*"),
      supabase.from("service_records").select("*"),
      supabase.from("parts").select("*"),
    ]);
    return {
      customers: (custs ?? []).map(toCust),
      boats: (bts ?? []).map(toBoat),
      serviceRecords: (svcs ?? []).map(toSvc),
      parts: (pts ?? []).map(toPart),
    };
  },

  // ── Work Order Jobs ───────────────────────────────────────────────────────
  async getWorkOrderJobs(serviceRecordId: number) {
    const { data } = await supabase.from("work_order_jobs").select("*").eq("service_record_id", serviceRecordId).order("sort_order");
    return (data ?? []).map(toWOJob);
  },
  async createWorkOrderJob(data: any) {
    const { data: r } = await supabase.from("work_order_jobs").insert({
      service_record_id: data.serviceRecordId, name: data.title ?? data.name ?? "Job",
      description: data.description ?? null, pricing_type: data.pricingType ?? "hourly",
      labor_hours: data.laborHours ?? 0, labor_rate: data.laborRate ?? 110,
      flat_rate: data.flatRate ?? null, sort_order: data.sortOrder ?? 0,
      customer_notes: data.customerNotes ?? null, tech_notes: data.techNotes ?? null,
      status: data.status ?? "open",
    }).select().single();
    return toWOJob(r!);
  },
  async updateWorkOrderJob(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      name: "name", title: "name", description: "description", pricingType: "pricing_type",
      laborHours: "labor_hours", laborRate: "labor_rate", flatRate: "flat_rate",
      sortOrder: "sort_order", customerNotes: "customer_notes", techNotes: "tech_notes",
      status: "status",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    // If the client sent nothing recognizable, don't attempt an empty UPDATE — just return the row.
    if (Object.keys(update).length === 0) {
      const { data: r } = await supabase.from("work_order_jobs").select("*").eq("id", id).single();
      return r ? toWOJob(r) : undefined;
    }
    const { data: r, error } = await supabase.from("work_order_jobs").update(update).eq("id", id).select().single();
    if (error) throw new Error(`updateWorkOrderJob: ${error.message} | update payload: ${JSON.stringify(update)}`);
    return toWOJob(r!);
  },
  async deleteWorkOrderJob(id: number) {
    await supabase.from("work_order_jobs").delete().eq("id", id);
  },

  // ── Common Jobs ───────────────────────────────────────────────────────────
  async getCommonJobs() {
    const { data } = await supabase.from("common_jobs").select("*").order("name");
    return (data ?? []).map(toCommonJob);
  },
  async createCommonJob(data: any) {
    const { data: r } = await supabase.from("common_jobs").insert({
      name: data.name, description: data.description ?? null, pricing_type: data.pricingType ?? "hourly",
      labor_hours: data.laborHours ?? 0, labor_rate: data.laborRate ?? 110,
      flat_rate: data.flatRate ?? null, category: data.category ?? null,
    }).select().single();
    return toCommonJob(r!);
  },
  async updateCommonJob(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      name: "name", description: "description", pricingType: "pricing_type",
      laborHours: "labor_hours", laborRate: "labor_rate", flatRate: "flat_rate", category: "category",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    const { data: r } = await supabase.from("common_jobs").update(update).eq("id", id).select().single();
    return toCommonJob(r!);
  },
  async deleteCommonJob(id: number) {
    await supabase.from("common_jobs").delete().eq("id", id);
  },

  // ── Service Photos ────────────────────────────────────────────────────────
  async getCustomerGeneralPhotos(customerId: number) {
    const { data } = await supabase.from("service_photos").select("*")
      .eq("customer_id", customerId)
      .is("service_record_id", null)
      .order("created_at");
    return (data ?? []).map(toPhoto);
  },
  async getServicePhotos(serviceRecordId: number) {
    const { data } = await supabase.from("service_photos").select("*").eq("service_record_id", serviceRecordId).order("created_at");
    return (data ?? []).map(toPhoto);
  },
  async addServicePhoto(data: any) {
    const { data: r } = await supabase.from("service_photos").insert({
      service_record_id: data.serviceRecordId ?? null,
      customer_id: data.customerId ?? null,
      data_url: data.dataUrl ?? null,
      storage_url: data.storageUrl ?? null,
      storage_path: data.storagePath ?? null,
      filename: data.filename ?? null,
      caption: data.caption ?? null,
      created_at: data.uploadedAt ?? new Date().toISOString(),
    }).select().single();
    return toPhoto(r!);
  },
  async updateServicePhotoCaption(id: number, caption: string) {
    await supabase.from("service_photos").update({ caption }).eq("id", id);
  },
  async deleteServicePhoto(id: number) {
    await supabase.from("service_photos").delete().eq("id", id);
  },

  // ── Customer Comm Log ─────────────────────────────────────────────────────
  async getCommLog(customerId: number) {
    const { data } = await supabase.from("customer_comm_log").select("*").eq("customer_id", customerId).order("timestamp", { ascending: false });
    return (data ?? []).map(toCommLog);
  },
  async createCommLogEntry(data: any) {
    const { data: r } = await supabase.from("customer_comm_log").insert({
      customer_id: data.customerId, timestamp: data.timestamp ?? new Date().toISOString(),
      type: data.type, notes: data.notes ?? null,
    }).select().single();
    return toCommLog(r!);
  },
  async updateCommLogEntry(id: number, data: any) {
    const { data: r } = await supabase.from("customer_comm_log").update({ type: data.type, notes: data.notes }).eq("id", id).select().single();
    return r ? toCommLog(r) : undefined;
  },
  async deleteCommLogEntry(id: number) {
    await supabase.from("customer_comm_log").delete().eq("id", id);
  },

  // ── Scheduled Events (calendar) ──────────────────────────────────────────
  async getScheduledEvents(start: string, end: string) {
    const { data } = await supabase.from("scheduled_events")
      .select("*, customers(name), boats(make)")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .order("scheduled_date")
      .order("sort_order");
    return (data ?? []).map(toEvent);
  },
  async getScheduledEvent(id: number) {
    const { data } = await supabase.from("scheduled_events").select("*, customers(name), boats(make)").eq("id", id).single();
    return data ? toEvent(data) : undefined;
  },
  async createScheduledEvent(data: any) {
    const { data: r, error } = await supabase.from("scheduled_events").insert({
      event_type: data.eventType ?? "other", scheduled_date: data.scheduledDate,
      time_slot: data.timeSlot ?? "am", customer_id: data.customerId ?? null,
      boat_id: data.boatId ?? null, service_record_id: data.serviceRecordId ?? null,
      title: data.title, notes: data.notes ?? null, status: data.status ?? "scheduled",
      sort_order: data.sortOrder ?? 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select("*, customers(name), boats(make)").single();
    if (error) throw new Error(error.message);
    await logActivity("created", "schedule", r!.id, `Scheduled: ${r!.title}`);
    return toEvent(r!);
  },
  async updateScheduledEvent(id: number, data: any) {
    const update: any = {};
    const map: Record<string, string> = {
      eventType: "event_type", scheduledDate: "scheduled_date", timeSlot: "time_slot",
      customerId: "customer_id", boatId: "boat_id", serviceRecordId: "service_record_id",
      title: "title", notes: "notes", status: "status", sortOrder: "sort_order",
    };
    for (const [k, v] of Object.entries(map)) if (data[k] !== undefined) update[v] = data[k];
    update.updated_at = new Date().toISOString();
    const { data: r, error } = await supabase.from("scheduled_events").update(update).eq("id", id).select("*, customers(name), boats(make)").single();
    if (error) throw new Error(error.message);
    return r ? toEvent(r) : undefined;
  },
  async deleteScheduledEvent(id: number) {
    const { data: e } = await supabase.from("scheduled_events").select("title").eq("id", id).single();
    await supabase.from("scheduled_events").delete().eq("id", id);
    if (e) await logActivity("deleted", "schedule", id, `Removed scheduled event: ${e.title}`);
  },
  async getWorkOrderDueEvents(start: string, end: string) {
    const { data } = await supabase.from("service_records")
      .select("*, boats(make, model, year, customer_id, customers(name))")
      .not("due_date", "is", null)
      .gte("due_date", start)
      .lte("due_date", end);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      dueDate: r.due_date,
      description: r.description ?? "",
      status: r.status ?? "open",
      boatId: r.boat_id,
      boatMake: r.boats?.make ?? null,
      boatModel: r.boats?.model ?? null,
      boatYear: r.boats?.year ?? null,
      customerName: r.boats?.customers?.name ?? null,
    }));
  },

  // ── Global Search ─────────────────────────────────────────────────────────
  async globalSearch(query: string, limit = 8) {
    const q = `%${query}%`;
    const [{ data: custs }, { data: boats }, { data: svcs }] = await Promise.all([
      supabase.from("customers").select("*").or(`name.ilike.${q},phone.ilike.${q},email.ilike.${q}`).limit(limit),
      supabase.from("boats").select("*, customers(name)").or(`make.ilike.${q},model.ilike.${q},hull_id.ilike.${q},registration_number.ilike.${q}`).limit(limit),
      supabase.from("service_records").select("*, boats(make, model, year, customer_id, customers(name))").ilike("description", q).limit(limit),
    ]);
    // Also try matching work order by numeric id if query is a number
    let idMatches: any[] = [];
    const asNum = parseInt(query, 10);
    if (!isNaN(asNum) && String(asNum) === query.trim()) {
      const { data } = await supabase.from("service_records").select("*, boats(make, model, year, customer_id, customers(name))").eq("id", asNum).limit(limit);
      idMatches = data ?? [];
    }
    const svcMap = new Map<number, any>();
    for (const s of [...(svcs ?? []), ...idMatches]) svcMap.set(s.id, s);
    return {
      customers: (custs ?? []).map(toCust),
      boats: (boats ?? []).map((b: any) => ({ ...toBoat(b), customerName: b.customers?.name ?? "Unknown" })),
      workOrders: Array.from(svcMap.values()).slice(0, limit).map((s: any) => ({
        ...toSvc(s),
        boatMake: s.boats?.make ?? null,
        boatModel: s.boats?.model ?? null,
        boatYear: s.boats?.year ?? null,
        customerName: s.boats?.customers?.name ?? "Unknown",
      })),
    };
  },

  // ── Customer Service History ────────────────────────────────────────────
  async getCustomerHistory(customerId: number) {
    const { data: boats } = await supabase.from("boats").select("*").eq("customer_id", customerId);
    const boatIds = (boats ?? []).map(b => b.id);
    if (boatIds.length === 0) return [];
    const { data: svcs } = await supabase.from("service_records").select("*").in("boat_id", boatIds).order("date", { ascending: false });
    const svcIds = (svcs ?? []).map(s => s.id);
    const [{ data: allJobs }, { data: allParts }] = await Promise.all([
      svcIds.length ? supabase.from("work_order_jobs").select("*").in("service_record_id", svcIds) : Promise.resolve({ data: [] as any[] }),
      svcIds.length ? supabase.from("parts").select("*").in("service_record_id", svcIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    return (svcs ?? []).map(s => {
      const boat = (boats ?? []).find(b => b.id === s.boat_id);
      const jobs = (allJobs ?? []).filter(j => j.service_record_id === s.id).map(toWOJob);
      const parts = (allParts ?? []).filter(p => p.service_record_id === s.id).map(toPart);
      const jobsTotal = jobs.reduce((sum, j) => sum + (j.pricingType === "flat" ? (j.flatRate ?? 0) : (j.laborHours ?? 0) * (j.laborRate ?? 110)), 0);
      const partsTotal = parts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
      const legacyLabor = jobs.length === 0 ? (s.labor_hours ?? 0) * (s.labor_rate ?? 110) : 0;
      const totalCost = jobs.length > 0 ? jobsTotal + partsTotal : legacyLabor + partsTotal;
      return {
        serviceRecord: toSvc(s),
        boat: boat ? toBoat(boat) : null,
        jobs,
        parts,
        totalCost,
      };
    });
  },

  // ── Clone Work Order ────────────────────────────────────────────────────
  async cloneWorkOrder(id: number, opts: { boatId?: number; date?: string }) {
    const { data: original } = await supabase.from("service_records").select("*").eq("id", id).single();
    if (!original) return undefined;
    const { data: created, error } = await supabase.from("service_records").insert({
      boat_id: opts.boatId ?? original.boat_id,
      date: opts.date ?? new Date().toISOString().slice(0, 10),
      description: original.description ?? "",
      tech_notes: original.tech_notes ?? null,
      labor_hours: original.labor_hours ?? null,
      cost: null,
      status: "open",
      labor_rate: original.labor_rate ?? 110,
      deposit_amount: null,
      paid: 0,
      due_date: null,
    }).select().single();
    if (error) throw new Error(error.message);
    const newId = created!.id;
    const [{ data: jobs }, { data: parts }] = await Promise.all([
      supabase.from("work_order_jobs").select("*").eq("service_record_id", id),
      supabase.from("parts").select("*").eq("service_record_id", id),
    ]);
    if (jobs && jobs.length > 0) {
      await supabase.from("work_order_jobs").insert(jobs.map((j: any) => ({
        service_record_id: newId, name: j.name, description: j.description ?? null,
        pricing_type: j.pricing_type ?? "hourly", labor_hours: j.labor_hours ?? 0,
        labor_rate: j.labor_rate ?? 110, flat_rate: j.flat_rate ?? null,
        sort_order: j.sort_order ?? 0, customer_notes: j.customer_notes ?? null,
        tech_notes: j.tech_notes ?? null, status: "open",
      })));
    }
    if (parts && parts.length > 0) {
      await supabase.from("parts").insert(parts.map((p: any) => ({
        service_record_id: newId, part_number: p.part_number ?? null,
        description: p.description, quantity: p.quantity ?? 1, unit_price: p.unit_price ?? 0,
      })));
    }
    await logActivity("created", "service", newId, `Duplicated WO-${String(id).padStart(4, "0")} → WO-${String(newId).padStart(4, "0")}`);
    return toSvc(created!);
  },

  // ── At-a-Glance (Batch 3) ────────────────────────────────────────────────
  async getCustomerAtAGlance(customerId: number) {
    const { data: boats } = await supabase.from("boats").select("*").eq("customer_id", customerId);
    const boatIds = (boats ?? []).map(b => b.id);
    let svcs: any[] = [];
    let allJobs: any[] = [];
    let allParts: any[] = [];
    if (boatIds.length > 0) {
      const { data: svcData } = await supabase.from("service_records").select("*").in("boat_id", boatIds);
      svcs = svcData ?? [];
      const svcIds = svcs.map(s => s.id);
      if (svcIds.length > 0) {
        const [{ data: jobsData }, { data: partsData }] = await Promise.all([
          supabase.from("work_order_jobs").select("*").in("service_record_id", svcIds),
          supabase.from("parts").select("*").in("service_record_id", svcIds),
        ]);
        allJobs = jobsData ?? [];
        allParts = partsData ?? [];
      }
    }

    const computeTotalCost = (s: any) => {
      const jobs = allJobs.filter(j => j.service_record_id === s.id).map(toWOJob);
      const parts = allParts.filter(p => p.service_record_id === s.id).map(toPart);
      const jobsTotal = jobs.reduce((sum, j) => sum + (j.pricingType === "flat" ? (j.flatRate ?? 0) : (j.laborHours ?? 0) * (j.laborRate ?? 110)), 0);
      const partsTotal = parts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
      const legacyLabor = jobs.length === 0 ? (s.labor_hours ?? 0) * (s.labor_rate ?? 110) : 0;
      return jobs.length > 0 ? jobsTotal + partsTotal : legacyLabor + partsTotal;
    };

    const paidStatuses = new Set(["complete", "invoiced"]);
    const lifetimeSpend = svcs
      .filter(s => paidStatuses.has(s.status ?? "open"))
      .reduce((sum, s) => sum + computeTotalCost(s), 0);

    const openWOs = svcs.filter(s => !paidStatuses.has(s.status ?? "open")).length;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count: upcomingEvents } = await supabase
      .from("scheduled_events")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", in30);

    let lastVisitDate: string | null = null;
    for (const s of svcs) {
      if (s.date && (!lastVisitDate || s.date > lastVisitDate)) lastVisitDate = s.date;
    }
    const lastVisitRelative = relativeTimeFromDate(lastVisitDate);

    return {
      lifetimeSpend,
      boatsServiced: (boats ?? []).length,
      openWOs,
      upcomingEvents: upcomingEvents ?? 0,
      lastVisitDate,
      lastVisitRelative,
    };
  },

  async getBoatAtAGlance(boatId: number) {
    const boat = await this.getBoat(boatId);
    const records = await this.getServiceRecords(boatId);

    const totalServices = records.length;
    const mostRecent = records.reduce((latest: any, r: any) => {
      if (!latest || (r.date && r.date > latest.date)) return r;
      return latest;
    }, null as any);

    const outstandingBalance = records
      .filter((r: any) => !r.paid)
      .reduce((sum: number, r: any) => sum + (r.cost ?? ((r.laborHours ?? 0) * (r.laborRate ?? 110))), 0);

    return {
      totalServices,
      lastServiceDate: mostRecent?.date ?? null,
      lastServiceSummary: mostRecent?.description ? String(mostRecent.description).slice(0, 120) : null,
      engineHours: boat?.engineHours ?? null,
      outstandingBalance,
    };
  },
};

function relativeTimeFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.round(diffDays / 7);
  if (diffDays < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.round(diffDays / 30);
  if (diffDays < 365) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.round(diffDays / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
