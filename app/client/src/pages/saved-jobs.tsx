import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wrench, BookOpen, DollarSign, Clock, ChevronDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { LaborCode, InsertLaborCode, CommonJob, InsertCommonJob } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

const CATEGORIES = ["Engine", "Electrical", "Hull", "Seasonal", "Trailer", "Other"];
const COMMON_CATEGORIES = ["Engine", "Electrical", "Bilge / Pumps", "Cooling System", "Seasonal", "Fuel System", "Hull / Fiberglass", "Electronics", "Trailer", "General"];

// ─── Labor Code Form (existing templates tab) ──────────────────────────────────
function LaborCodeForm({ defaultValues, onSubmit, isPending }: {
  defaultValues?: Partial<InsertLaborCode>;
  onSubmit: (data: InsertLaborCode) => void;
  isPending: boolean;
}) {
  const form = useForm<InsertLaborCode>({
    defaultValues: { code: "", description: "", hours: 1, category: "Engine", ...defaultValues },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="description" rules={{ required: "Description is required" }}
          render={({ field }) => (
            <FormItem><FormLabel>Job Description *</FormLabel>
              <FormControl><Input placeholder="e.g. Yamaha 4-stroke oil service" {...field} data-testid="input-labor-desc" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="hours" rules={{ required: true }}
            render={({ field }) => (
              <FormItem><FormLabel>Standard Hours *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min="0.1" placeholder="1.5"
                    {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-labor-hours" />
                </FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="category"
            render={({ field }) => (
              <FormItem><FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? "Engine"}>
                  <FormControl><SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
        </div>
        <FormField control={form.control} name="code"
          render={({ field }) => (
            <FormItem><FormLabel>Code (optional)</FormLabel>
              <FormControl><Input placeholder="e.g. OIL-YAM4S" {...field} value={field.value ?? ""} data-testid="input-labor-code" /></FormControl>
            </FormItem>
          )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-labor">
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Common Job Form ───────────────────────────────────────────────────────────
function CommonJobForm({ defaultValues, onSubmit, isPending }: {
  defaultValues?: Partial<InsertCommonJob>;
  onSubmit: (data: InsertCommonJob) => void;
  isPending: boolean;
}) {
  const form = useForm<InsertCommonJob>({
    defaultValues: {
      name: "",
      category: "Engine",
      description: "",
      techNotes: "",
      customerNotes: "",
      pricingType: "hourly",
      laborHours: 0,
      laborRate: 110,
      flatRate: 0,
      defaultParts: "[]",
      ...defaultValues,
    },
  });

  const pricingType = form.watch("pricingType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="name" rules={{ required: "Name is required" }}
            render={({ field }) => (
              <FormItem className="col-span-2"><FormLabel>Job Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Oil Change" {...field} data-testid="input-cj-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          <FormField control={form.control} name="category"
            render={({ field }) => (
              <FormItem><FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "Engine"}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {COMMON_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          <FormField control={form.control} name="pricingType"
            render={({ field }) => (
              <FormItem><FormLabel>Pricing Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="flat">Flat Rate</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
        </div>

        {/* Labor fields based on pricing type */}
        {pricingType === "hourly" ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="laborHours"
              render={({ field }) => (
                <FormItem><FormLabel>Default Hours</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.25" min="0" placeholder="1.5"
                      {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                  </FormControl>
                </FormItem>
              )} />
            <FormField control={form.control} name="laborRate"
              render={({ field }) => (
                <FormItem><FormLabel>Rate ($/hr)</FormLabel>
                  <FormControl>
                    <Input type="number" step="5" min="0" placeholder="110"
                      {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 110)} />
                  </FormControl>
                </FormItem>
              )} />
          </div>
        ) : (
          <FormField control={form.control} name="flatRate"
            render={({ field }) => (
              <FormItem><FormLabel>Flat Rate ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="5" min="0" placeholder="0.00"
                    {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                </FormControl>
              </FormItem>
            )} />
        )}

        <FormField control={form.control} name="description"
          render={({ field }) => (
            <FormItem><FormLabel>Default Description (customer-facing)</FormLabel>
              <FormControl>
                <textarea {...field} value={field.value ?? ""} rows={2} placeholder="What the customer sees on the work order..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </FormControl>
            </FormItem>
          )} />

        <FormField control={form.control} name="techNotes"
          render={({ field }) => (
            <FormItem><FormLabel>Default Tech Notes (internal)</FormLabel>
              <FormControl>
                <textarea {...field} value={field.value ?? ""} rows={2} placeholder="Internal notes for the tech..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </FormControl>
            </FormItem>
          )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-cj">
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────
function TemplatesTab() {
  const [addOpen, setAddOpen] = useState(false);
  const [editCode, setEditCode] = useState<LaborCode | null>(null);
  const { toast } = useToast();

  const { data: codes = [], isLoading } = useQuery<LaborCode[]>({
    queryKey: ["/api/labor-codes"],
    queryFn: () => apiRequest("GET", "/api/labor-codes").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLaborCode) => apiRequest("POST", "/api/labor-codes", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/labor-codes"] }); setAddOpen(false); toast({ title: "Job saved" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertLaborCode> }) => apiRequest("PATCH", `/api/labor-codes/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/labor-codes"] }); setEditCode(null); toast({ title: "Job updated" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/labor-codes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/labor-codes"] }); toast({ title: "Removed" }); },
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = codes.filter(c => (c.category ?? "Other") === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, LaborCode[]>);
  const uncategorized = codes.filter(c => !c.category || !CATEGORIES.includes(c.category));
  if (uncategorized.length > 0) grouped["Other"] = [...(grouped["Other"] ?? []), ...uncategorized];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{codes.length} flat rate presets</p>
        <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-labor-code">
          <Plus size={14} className="mr-1" />Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1.5">
                {items.map(lc => (
                  <div key={lc.id} className="group flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-all" data-testid={`labor-code-${lc.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{lc.description}</p>
                        {lc.code && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{lc.code}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0 flex items-center gap-1">
                      <Clock size={12} />{lc.hours} hrs
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditCode(lc)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" data-testid={`button-edit-labor-${lc.id}`}><Pencil size={14} /></button>
                      <button onClick={() => deleteMutation.mutate(lc.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-labor-${lc.id}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add Labor Template</DialogTitle></DialogHeader>
          <LaborCodeForm onSubmit={data => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editCode} onOpenChange={o => !o && setEditCode(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit Labor Template</DialogTitle></DialogHeader>
          {editCode && <LaborCodeForm defaultValues={editCode} onSubmit={data => updateMutation.mutate({ id: editCode.id, data })} isPending={updateMutation.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Common Jobs Tab ───────────────────────────────────────────────────────────
function CommonJobsTab() {
  const [addOpen, setAddOpen] = useState(false);
  const [editJob, setEditJob] = useState<CommonJob | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<CommonJob[]>({
    queryKey: ["/api/common-jobs"],
    queryFn: () => apiRequest("GET", "/api/common-jobs").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCommonJob) => apiRequest("POST", "/api/common-jobs", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/common-jobs"] }); setAddOpen(false); toast({ title: "Common job saved" }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertCommonJob> }) =>
      apiRequest("PATCH", `/api/common-jobs/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/common-jobs"] }); setEditJob(null); toast({ title: "Updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/common-jobs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/common-jobs"] }); setConfirmDel(null); toast({ title: "Removed" }); },
  });

  // Seed some defaults if empty
  const defaultCommonJobs: InsertCommonJob[] = [
    { name: "Oil Change", category: "Engine", description: "Engine oil and filter change", pricingType: "flat", flatRate: 120, laborHours: 1, laborRate: 110, techNotes: "Check oil level after fill. Dispose of old oil properly.", customerNotes: "", defaultParts: "[]" },
    { name: "Impeller Service", category: "Cooling System", description: "Water pump impeller replacement", pricingType: "flat", flatRate: 180, laborHours: 1.5, laborRate: 110, techNotes: "Inspect housing for cracks. Replace gasket.", customerNotes: "", defaultParts: "[]" },
    { name: "Replace Bilge Pump", category: "Bilge / Pumps", description: "Bilge pump removal and replacement", pricingType: "flat", flatRate: 150, laborHours: 1.5, laborRate: 110, techNotes: "Test float switch. Check wiring connections.", customerNotes: "", defaultParts: "[]" },
    { name: "Battery Replacement", category: "Electrical", description: "Marine battery removal and installation", pricingType: "flat", flatRate: 60, laborHours: 0.5, laborRate: 110, techNotes: "Check terminals for corrosion. Secure battery box.", customerNotes: "", defaultParts: "[]" },
    { name: "Winterize Outboard", category: "Seasonal", description: "Full winterization of outboard engine", pricingType: "flat", flatRate: 225, laborHours: 2, laborRate: 110, techNotes: "Fogging oil, flush with fresh water, drain gear lube, stabilize fuel, grease fittings.", customerNotes: "Engine has been winterized and is ready for off-season storage.", defaultParts: "[]" },
    { name: "Summerize / Spring Commissioning", category: "Seasonal", description: "Spring commissioning and launch prep", pricingType: "flat", flatRate: 275, laborHours: 2.5, laborRate: 110, techNotes: "Check impeller, inspect belts and hoses, test all systems, lubricate controls.", customerNotes: "Vessel has been inspected and prepared for the season.", defaultParts: "[]" },
    { name: "Diagnose Electrical Issue", category: "Electrical", description: "Electrical diagnosis and troubleshooting", pricingType: "hourly", laborHours: 1.5, laborRate: 110, flatRate: 0, techNotes: "Document all test points. Take photos of wiring before moving anything.", customerNotes: "", defaultParts: "[]" },
    { name: "Diagnose No-Start", category: "Engine", description: "Engine no-start diagnosis", pricingType: "hourly", laborHours: 1.5, laborRate: 110, flatRate: 0, techNotes: "Check spark, fuel delivery, compression. Pull codes if applicable.", customerNotes: "", defaultParts: "[]" },
    { name: "Spark Plug Service", category: "Engine", description: "Spark plug replacement", pricingType: "flat", flatRate: 90, laborHours: 0.75, laborRate: 110, techNotes: "Use torque spec. Check gap on new plugs.", customerNotes: "", defaultParts: "[]" },
  ];

  const [seeding, setSeeding] = useState(false);
  async function seedDefaults() {
    setSeeding(true);
    for (const j of defaultCommonJobs) {
      await apiRequest("POST", "/api/common-jobs", j);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/common-jobs"] });
    setSeeding(false);
    toast({ title: "Default common jobs added" });
  }

  // Group by category
  const grouped = jobs.reduce<Record<string, CommonJob[]>>((acc, j) => {
    const cat = j.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(j);
    return acc;
  }, {});

  function pricingLabel(j: CommonJob) {
    if (j.pricingType === "flat") return `$${(j.flatRate ?? 0).toFixed(2)} flat`;
    return `${j.laborHours ?? 0} hrs @ $${j.laborRate ?? 110}/hr`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{jobs.length} common jobs — used to quickly add job lines to work orders</p>
        <div className="flex items-center gap-2">
          {jobs.length === 0 && (
            <Button size="sm" variant="outline" onClick={seedDefaults} disabled={seeding} className="text-xs">
              {seeding ? "Adding..." : "Add Defaults"}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-common-job">
            <Plus size={14} className="mr-1" />Add Common Job
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No common jobs yet</p>
          <p className="text-xs mt-1 mb-4">Build a library of your most common repairs to add to work orders fast</p>
          <Button size="sm" variant="outline" onClick={seedDefaults} disabled={seeding}>
            {seeding ? "Adding..." : "Add Default Common Jobs"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1.5">
                {items.map(cj => (
                  <div key={cj.id}
                    className="group bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-all"
                    data-testid={`common-job-${cj.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{cj.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            cj.pricingType === "flat"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                          }`}>
                            {cj.pricingType === "flat" ? "Flat" : "Hourly"}
                          </span>
                          <span className="text-xs text-primary font-medium">{pricingLabel(cj)}</span>
                        </div>
                        {cj.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{cj.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => setEditJob(cj)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                          data-testid={`button-edit-cj-${cj.id}`}
                        >
                          <Pencil size={14} />
                        </button>
                        {confirmDel === cj.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button onClick={() => deleteMutation.mutate(cj.id)} className="text-destructive font-semibold hover:underline px-1">Delete</button>
                            <button onClick={() => setConfirmDel(null)} className="text-muted-foreground hover:underline px-1">Cancel</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDel(cj.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-cj-${cj.id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Add Common Job</DialogTitle></DialogHeader>
          <CommonJobForm
            onSubmit={data => createMutation.mutate(data)}
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editJob} onOpenChange={o => !o && setEditJob(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Edit Common Job</DialogTitle></DialogHeader>
          {editJob && (
            <CommonJobForm
              defaultValues={editJob}
              onSubmit={data => updateMutation.mutate({ id: editJob.id, data })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SavedJobsPage() {
  usePageTitle("Saved Jobs");
  const [tab, setTab] = useState<"templates" | "common">("templates");

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Templates &amp; Common Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reusable job presets and canned job library</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-5">
        <button
          onClick={() => setTab("templates")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "templates"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Labor Templates
        </button>
        <button
          onClick={() => setTab("common")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            tab === "common"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen size={13} />Common Jobs
        </button>
      </div>

      {tab === "templates" ? <TemplatesTab /> : <CommonJobsTab />}
    </div>
  );
}
