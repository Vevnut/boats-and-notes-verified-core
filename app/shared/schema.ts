import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Customers ───────────────────────────────────────────────────────────────
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ─── Boats ───────────────────────────────────────────────────────────────────
export const boats = sqliteTable("boats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  make: text("make").notNull(),
  model: text("model"),
  year: integer("year"),
  color: text("color"),
  length: real("length"),
  engineType: text("engine_type"),
  engineMake: text("engine_make"),
  engineModel: text("engine_model"),
  engineHours: real("engine_hours"),
  horsepower: integer("horsepower"),
  engineSerial: text("engine_serial"),
  transomSerial: text("transom_serial"),
  driveSerial: text("drive_serial"),
  hullId: text("hull_id"),
  registrationNumber: text("registration_number"),
  storageLocation: text("storage_location"),
  notes: text("notes"),
  // Reminders stored as JSON array of { label, dueDate, done }
  reminders: text("reminders").default("[]"),
  // Sticky notes
  stickyNote: text("sticky_note"),
});

export const insertBoatSchema = createInsertSchema(boats).omit({ id: true });
export type InsertBoat = z.infer<typeof insertBoatSchema>;
export type Boat = typeof boats.$inferSelect;

// ─── Service Records ─────────────────────────────────────────────────────────
export const serviceRecords = sqliteTable("service_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  boatId: integer("boat_id").notNull().references(() => boats.id),
  date: text("date").notNull(),
  description: text("description").notNull(),
  techNotes: text("tech_notes"),
  laborHours: real("labor_hours"),
  laborRate: real("labor_rate").default(110),
  cost: real("cost"),
  status: text("status").notNull().default("open"),
  // Deposit / payment
  depositAmount: real("deposit_amount"),
  paid: integer("paid", { mode: "boolean" }).default(false),
  dueDate: text("due_date"),
});

export const insertServiceRecordSchema = createInsertSchema(serviceRecords).omit({ id: true });
export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecords.$inferSelect;

// ─── Parts (on a service record) ─────────────────────────────────────────────
export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceRecordId: integer("service_record_id").notNull().references(() => serviceRecords.id),
  partNumber: text("part_number"),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  // order status: null = not ordered, 'ordered' = ordered, 'received' = in hand
  orderStatus: text("order_status"),
  catalogPartId: integer("catalog_part_id"),
  jobId: integer("job_id"),
});

export const insertPartSchema = createInsertSchema(parts).omit({ id: true });
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

// ─── Parts Catalog ────────────────────────────────────────────────────────────
export const partsCatalog = sqliteTable("parts_catalog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partNumber: text("part_number"),
  description: text("description").notNull(),
  category: text("category"),
  costPrice: real("cost_price").default(0),
  sellPrice: real("sell_price").default(0),
  qtyOnHand: real("qty_on_hand").default(0),
  reorderPoint: real("reorder_point").default(0),
  notes: text("notes"),
  isCommon: integer("is_common", { mode: "boolean" }).default(false),
});

export const insertPartsCatalogSchema = createInsertSchema(partsCatalog).omit({ id: true });
export type InsertPartsCatalog = z.infer<typeof insertPartsCatalogSchema>;
export type PartsCatalog = typeof partsCatalog.$inferSelect;

// ─── Flat Rate Labor Codes ────────────────────────────────────────────────────
export const laborCodes = sqliteTable("labor_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code"),
  description: text("description").notNull(),
  hours: real("hours").notNull(),
  category: text("category"),
});

export const insertLaborCodeSchema = createInsertSchema(laborCodes).omit({ id: true });
export type InsertLaborCode = z.infer<typeof insertLaborCodeSchema>;
export type LaborCode = typeof laborCodes.$inferSelect;

// ─── Work Order Templates ───────────────────────────────────────────────────
// A template is a reusable work order blueprint. Each template stores:
//   - name: short label (e.g. "100-Hour Service")
//   - description: the work order description pre-filled when applied
//   - techNotes: default tech notes
//   - laborHours: estimated hours
//   - laborRate: rate in $/hr
//   - parts: JSON array of { partNumber, description, quantity, unitPrice }
export const workOrderTemplates = sqliteTable("work_order_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  techNotes: text("tech_notes"),
  laborHours: real("labor_hours"),
  laborRate: real("labor_rate").default(110),
  // JSON: [{partNumber,description,quantity,unitPrice}]
  parts: text("parts").notNull().default("[]"),
  category: text("category"),
});

export const insertWorkOrderTemplateSchema = createInsertSchema(workOrderTemplates).omit({ id: true });
export type InsertWorkOrderTemplate = z.infer<typeof insertWorkOrderTemplateSchema>;
export type WorkOrderTemplate = typeof workOrderTemplates.$inferSelect;

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(), // customer | boat | service | part
  entityId: integer("entity_id"),
  description: text("description").notNull(),
});

export const insertActivitySchema = createInsertSchema(activityLog).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityLog.$inferSelect;

// ─── Work Order Jobs ──────────────────────────────────────────────────────────
// Each service record (work order) can have multiple job lines.
// pricingType: 'hourly' = laborHours * laborRate, 'flat' = flatRate
export const workOrderJobs = sqliteTable("work_order_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceRecordId: integer("service_record_id").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  techNotes: text("tech_notes").default(""),
  customerNotes: text("customer_notes").default(""),
  pricingType: text("pricing_type").notNull().default("hourly"), // 'hourly' | 'flat'
  laborHours: real("labor_hours").default(0),
  laborRate: real("labor_rate").default(110),
  flatRate: real("flat_rate").default(0),
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'complete'
  sortOrder: integer("sort_order").default(0),
  // common job this was copied from (for reference only)
  commonJobId: integer("common_job_id"),
});

export const insertWorkOrderJobSchema = createInsertSchema(workOrderJobs).omit({ id: true });
export type InsertWorkOrderJob = z.infer<typeof insertWorkOrderJobSchema>;
export type WorkOrderJob = typeof workOrderJobs.$inferSelect;

// ─── Common Jobs (Canned Jobs Library) ───────────────────────────────────────
// Reusable job templates that can be copied into any work order.
export const commonJobs = sqliteTable("common_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").default("General"),
  description: text("description").default(""),
  techNotes: text("tech_notes").default(""),
  customerNotes: text("customer_notes").default(""),
  pricingType: text("pricing_type").notNull().default("hourly"), // 'hourly' | 'flat'
  laborHours: real("labor_hours").default(0),
  laborRate: real("labor_rate").default(110),
  flatRate: real("flat_rate").default(0),
  // JSON: [{partNumber, description, quantity, unitPrice}]
  defaultParts: text("default_parts").notNull().default("[]"),
  sortOrder: integer("sort_order").default(0),
});

export const insertCommonJobSchema = createInsertSchema(commonJobs).omit({ id: true });
export type InsertCommonJob = z.infer<typeof insertCommonJobSchema>;
export type CommonJob = typeof commonJobs.$inferSelect;

// ─── Service Photos ─────────────────────────────────────────────────────────
// Photos attached to a service record (damage, completed work, etc.)
export const servicePhotos = sqliteTable("service_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceRecordId: integer("service_record_id").notNull().references(() => serviceRecords.id),
  filename: text("filename").notNull(),
  caption: text("caption"),
  dataUrl: text("data_url").notNull(), // base64 data URL stored directly in SQLite
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertServicePhotoSchema = createInsertSchema(servicePhotos).omit({ id: true });
export type InsertServicePhoto = z.infer<typeof insertServicePhotoSchema>;
export type ServicePhoto = typeof servicePhotos.$inferSelect;

// ─── Customer Communication Log ───────────────────────────────────────────────
// Notes, calls, and follow-ups per customer.
// type: 'note' | 'call' | 'followup'
export const customerCommLog = sqliteTable("customer_comm_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull().default("note"), // 'note' | 'call' | 'followup'
  text: text("text").notNull(),
  timestamp: text("timestamp").notNull(),
  done: integer("done", { mode: "boolean" }).default(false),
});

export const insertCommLogSchema = createInsertSchema(customerCommLog).omit({ id: true });
export type InsertCommLog = z.infer<typeof insertCommLogSchema>;
export type CommLog = typeof customerCommLog.$inferSelect;
