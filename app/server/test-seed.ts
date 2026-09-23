// All people, identifiers, pricing and records are fictional test fixtures.
export function sampleData(): Record<string, any[]> {
  const date = (offset = 0) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const now = new Date().toISOString();
  return {
    customers: [
      { id: 1, name: "Alex Morgan (Sample)", phone: "603-555-0101", email: "alex@example.invalid", address: "Sample dock A, Test Lake, NH", notes: "FICTIONAL SAMPLE. Call before test winterization visit." },
      { id: 2, name: "Jamie Parker (Sample)", phone: "603-555-0102", email: "jamie@example.invalid", address: "Sample dock B, Test Lake, NH", notes: "FICTIONAL SAMPLE. Pontoon service reference." },
      { id: 3, name: "Taylor Reed (Sample)", phone: "603-555-0103", email: "taylor@example.invalid", address: "Sample storage bay C, NH", notes: "FICTIONAL SAMPLE. PWC seasonal service." },
      { id: 4, name: "Casey Ellis (Sample)", phone: "603-555-0104", email: "casey@example.invalid", address: "Sample launch D, NH", notes: "FICTIONAL SAMPLE. Use this record to try edits." },
    ],
    boats: [
      { id: 1, customer_id: 1, make: "Sea Ray", model: "185 Sport", year: 2012, color: "White / navy", length: 18.5, engine_type: "Sterndrive", engine_make: "MerCruiser", engine_model: "4.3 MPI", horsepower: 220, engine_hours: 410, hull_id: "SAMPLE-HULL-001", registration_number: "SAMPLE-001", engine_serial: "TEST-ENGINE-001", storage_location: "Test dock A", reminders: JSON.stringify([{ label: "Sample winterization reminder", dueDate: date(7), done: false }]), sticky_note: "Sample only: inspect bellows before winter storage." },
      { id: 2, customer_id: 2, make: "Bennington", model: "22 SSR", year: 2019, color: "Silver", length: 22, engine_type: "Outboard", engine_make: "Yamaha", engine_model: "F150", horsepower: 150, engine_hours: 225, hull_id: "SAMPLE-HULL-002", registration_number: "SAMPLE-002", storage_location: "Test dock B", reminders: "[]" },
      { id: 3, customer_id: 3, make: "Yamaha", model: "VX Cruiser", year: 2020, color: "Blue", length: 11, engine_type: "PWC", engine_make: "Yamaha", engine_model: "TR-1", engine_hours: 135, hull_id: "SAMPLE-HULL-003", storage_location: "Sample bay C", reminders: "[]" },
      { id: 4, customer_id: 4, make: "Boston Whaler", model: "170 Montauk", year: 2016, color: "White", length: 17, engine_type: "Outboard", engine_make: "Mercury", engine_model: "FourStroke 90", horsepower: 90, engine_hours: 285, hull_id: "SAMPLE-HULL-004", storage_location: "Test launch D", reminders: "[]" },
    ],
    service_records: [
      { id: 1, boat_id: 1, date: date(-2), due_date: date(2), description: "Fall winterization & drive inspection", tech_notes: "Sample work order. Inspect cooling system and bellows.", labor_rate: 110, status: "open", paid: 0, deposit_amount: 100 },
      { id: 2, boat_id: 2, date: date(-1), due_date: date(3), description: "100-hour outboard service", tech_notes: "Sample work order. Filters awaiting delivery.", labor_rate: 110, status: "waiting_on_parts", paid: 0 },
      { id: 3, boat_id: 3, date: date(-3), due_date: date(1), description: "PWC seasonal inspection", tech_notes: "Sample work order. Customer copy ready to review.", labor_rate: 110, status: "ready_for_pickup", paid: 0 },
      { id: 4, boat_id: 4, date: date(-10), description: "Outboard oil & gearcase service", tech_notes: "Fictional completed service.", labor_rate: 110, status: "invoiced", paid: 0, cost: 244.5 },
      { id: 5, boat_id: 1, date: date(-45), description: "Summer cooling-system inspection", tech_notes: "Fictional paid history record.", labor_rate: 110, status: "complete", paid: 1, cost: 165 },
    ],
    work_order_jobs: [
      { id: 1, service_record_id: 1, name: "Winterization", description: "Seasonal preparation test job", pricing_type: "flat", flat_rate: 225, labor_hours: 0, labor_rate: 110, sort_order: 0, status: "open", customer_notes: "Sample: stabilize fuel and prepare cooling system for storage.", tech_notes: "Sample: follow model-specific procedure." },
      { id: 2, service_record_id: 1, name: "Drive inspection", description: "Inspect bellows and drive condition", pricing_type: "hourly", labor_hours: 0.75, labor_rate: 110, sort_order: 1, status: "open", customer_notes: "Report any additional repairs before proceeding." },
      { id: 3, service_record_id: 2, name: "100-hour service", pricing_type: "hourly", labor_hours: 2, labor_rate: 110, status: "in_progress", sort_order: 0 },
      { id: 4, service_record_id: 3, name: "Seasonal inspection", pricing_type: "flat", flat_rate: 175, labor_rate: 110, status: "complete", sort_order: 0 },
      { id: 5, service_record_id: 4, name: "Oil and gearcase service", pricing_type: "hourly", labor_hours: 1.5, labor_rate: 110, status: "complete", sort_order: 0 },
      { id: 6, service_record_id: 5, name: "Cooling-system inspection", pricing_type: "hourly", labor_hours: 1.5, labor_rate: 110, status: "complete", sort_order: 0 },
    ],
    parts_catalog: [
      { id: 1, part_number: "DEMO-MC-001", description: "Sample MerCruiser oil filter", category: "MerCruiser - Filters", cost_price: 10, sell_price: 16, qty_on_hand: 6, reorder_point: 2, is_common: 1, notes: "FICTIONAL part number and price. Not for ordering." },
      { id: 2, part_number: "DEMO-YA-001", description: "Sample Yamaha service filter", category: "Yamaha - Filters", cost_price: 12, sell_price: 22, qty_on_hand: 1, reorder_point: 3, is_common: 1, notes: "FICTIONAL part number and price. Not for ordering." },
      { id: 3, part_number: "DEMO-ME-001", description: "Sample Mercury gear lubricant", category: "Mercury - Fluids", cost_price: 9, sell_price: 15.9, qty_on_hand: 8, reorder_point: 4, notes: "FICTIONAL fixture." },
      { id: 4, part_number: "DEMO-VP-001", description: "Sample Volvo Penta impeller", category: "Volvo Penta - Impellers", cost_price: 30, sell_price: 49, qty_on_hand: 0, reorder_point: 1, notes: "FICTIONAL fixture." },
      { id: 5, part_number: "DEMO-SH-001", description: "Sample winterization fluid", category: "MerCruiser - Fluids", cost_price: 5, sell_price: 9, qty_on_hand: 12, reorder_point: 4, is_common: 1, notes: "FICTIONAL fixture." },
      { id: 6, part_number: "DEMO-YA-002", description: "Sample Yamaha service kit", category: "Yamaha - Service Kits", cost_price: 55, sell_price: 89, qty_on_hand: 2, reorder_point: 1, notes: "FICTIONAL fixture." },
    ],
    parts: [
      { id: 1, service_record_id: 1, job_id: 1, catalog_part_id: 5, part_number: "DEMO-SH-001", description: "Sample winterization fluid", quantity: 4, unit_price: 9, order_status: "received" },
      { id: 2, service_record_id: 2, job_id: 3, catalog_part_id: 2, part_number: "DEMO-YA-001", description: "Sample Yamaha service filter", quantity: 1, unit_price: 22, order_status: null },
      { id: 3, service_record_id: 4, job_id: 5, catalog_part_id: 3, part_number: "DEMO-ME-001", description: "Sample Mercury gear lubricant", quantity: 5, unit_price: 15.9, order_status: "received" },
    ],
    catalog_tabs: ["Yamaha", "Mercury", "MerCruiser", "Volvo Penta"].map((label, i) => ({ id: i + 1, label, match_prefix: label, sort_order: i })),
    common_jobs: [
      { name: "Sample outboard winterization", category: "Winterization", description: "Fictional canned job for testing.", pricing_type: "flat", flat_rate: 199, labor_hours: 0, labor_rate: 110 },
      { name: "Sample diagnostic hour", category: "Diagnostics", description: "Fictional diagnostic job.", pricing_type: "hourly", labor_hours: 1, labor_rate: 110 },
    ],
    work_order_templates: [
      { name: "Sample fall service package", description: "Winterization and inspection (sample)", tech_notes: "Use only for testing.", labor_hours: 2, labor_rate: 110, category: "Seasonal", parts: JSON.stringify([{ partNumber: "DEMO-SH-001", description: "Sample winterization fluid", quantity: 4, unitPrice: 9 }]) },
    ],
    labor_codes: [{ code: "DEMO-DIAG", description: "Sample diagnostic inspection", hours: 1, category: "Diagnostics" }],
    scheduled_events: [
      { id: 1, event_type: "drop_off", scheduled_date: date(1), time_slot: "am", customer_id: 1, boat_id: 1, service_record_id: 1, title: "Sample winterization visit", notes: "Fictional appointment.", status: "scheduled", sort_order: 0, created_at: now, updated_at: now },
      { id: 2, event_type: "pickup", scheduled_date: date(2), time_slot: "pm", customer_id: 3, boat_id: 3, service_record_id: 3, title: "Sample PWC pickup", status: "scheduled", sort_order: 0, created_at: now, updated_at: now },
      { id: 3, event_type: "other", scheduled_date: date(), time_slot: "am", customer_id: 2, boat_id: 2, service_record_id: 2, title: "Sample pontoon service", status: "scheduled", sort_order: 0, created_at: now, updated_at: now },
    ],
    customer_comm_log: [{ customer_id: 1, timestamp: now, type: "note", notes: "SAMPLE log entry only. No message was sent." }],
    activity_log: [{ timestamp: now, action: "created", entity_type: "customer", entity_id: 1, description: "Isolated test copy initialized with fictional sample records." }],
    service_photos: [],
    status_history: [{ service_record_id: 1, status: "open", changed_at: now }],
  };
}
