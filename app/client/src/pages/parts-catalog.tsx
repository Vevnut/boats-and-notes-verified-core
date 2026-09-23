import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, AlertTriangle, Package, Star, Trash2,
  ChevronRight, ChevronDown, X, Check, PenLine,
  Settings2, GripVertical, ExternalLink, PackagePlus,
  Link, Loader2, AlertCircle,
} from "lucide-react";
import type { PartsCatalog, InsertPartsCatalog } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

type OpenJob = { id: number; description: string; date: string; customerName: string; boatMake: string; boatModel: string; };
type JobLine = { id: number; title: string; description: string; status: string; };

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatalogTab {
  id: number;
  label: string;
  sortOrder: number;
  matchPrefix: string;
}

// Assign a tab id based on the category string + tab list
function tabForItem(item: PartsCatalog, tabs: CatalogTab[]): string {
  const cat = (item.category ?? "").toLowerCase();
  // Try each tab's matchPrefix as a keyword in the category
  for (const tab of tabs) {
    const prefix = tab.matchPrefix.toLowerCase();
    if (prefix === "other") continue; // "other" is the fallback
    if (cat.includes(prefix)) return String(tab.id);
  }
  // Fallback: find "other" tab or first tab
  const other = tabs.find(t => t.matchPrefix.toLowerCase() === "other");
  return other ? String(other.id) : String(tabs[0]?.id ?? "0");
}

// Subcategory: text after " - " in the category string
function subLabel(item: PartsCatalog): string {
  const cat = item.category ?? "";
  const idx = cat.indexOf(" - ");
  return idx !== -1 ? cat.slice(idx + 3).trim() : cat.trim() || "Uncategorized";
}

// Blank form state
const BLANK: InsertPartsCatalog = {
  partNumber: "",
  description: "",
  category: "",
  costPrice: 0,
  sellPrice: 0,
  qtyOnHand: 0,
  reorderPoint: 0,
  notes: "",
  isCommon: false,
};

// ─── Context menu ─────────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; item: PartsCatalog | null; }

function ContextMenu({ menu, onClose, onAddNew, onEdit, onDelete }: {
  menu: CtxMenu; onClose: () => void; onAddNew: () => void;
  onEdit: (item: PartsCatalog) => void; onDelete: (item: PartsCatalog) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const hKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", hClick);
    document.addEventListener("keydown", hKey);
    return () => { document.removeEventListener("mousedown", hClick); document.removeEventListener("keydown", hKey); };
  }, [onClose]);

  const MI = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left rounded-md transition-colors ${danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent"}`}
      onClick={() => { onClick(); onClose(); }}
    >{icon}{label}</button>
  );

  return (
    <div ref={ref} style={{ position: "fixed", top: menu.y, left: menu.x, zIndex: 9999 }}
      className="min-w-[180px] bg-popover border border-border rounded-lg shadow-lg p-1" data-testid="context-menu">
      <MI icon={<Plus size={14} />} label="Add New Part" onClick={onAddNew} />
      {menu.item && (<>
        <div className="my-1 border-t border-border" />
        <MI icon={<PenLine size={14} />} label="Edit Part" onClick={() => onEdit(menu.item!)} />
        <MI icon={<Trash2 size={14} />} label="Delete Part" onClick={() => onDelete(menu.item!)} danger />
      </>)}
    </div>
  );
}

// ─── Tab Manager Sheet ────────────────────────────────────────────────────────
function TabManager({ tabs, onClose }: { tabs: CatalogTab[]; onClose: () => void }) {
  const { toast } = useToast();
  const [localTabs, setLocalTabs] = useState<CatalogTab[]>([...tabs]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPrefix, setEditPrefix] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { label: string; matchPrefix: string }) =>
      apiRequest("POST", "/api/catalog-tabs", data).then(r => r.json()),
    onSuccess: (tab: CatalogTab) => {
      setLocalTabs(prev => [...prev, tab]);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-tabs"] });
      setNewLabel("");
      toast({ title: "Tab added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, label, matchPrefix }: { id: number; label: string; matchPrefix: string }) =>
      apiRequest("PATCH", `/api/catalog-tabs/${id}`, { label, matchPrefix }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-tabs"] });
      setEditingId(null);
      toast({ title: "Tab updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/catalog-tabs/${id}`),
    onSuccess: (_, id) => {
      setLocalTabs(prev => prev.filter(t => t.id !== id));
      queryClient.invalidateQueries({ queryKey: ["/api/catalog-tabs"] });
      toast({ title: "Tab removed" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/catalog-tabs/reorder", { ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/catalog-tabs"] }),
  });

  const startEdit = (tab: CatalogTab) => {
    setEditingId(tab.id);
    setEditLabel(tab.label);
    setEditPrefix(tab.matchPrefix);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setLocalTabs(prev => prev.map(t => t.id === editingId ? { ...t, label: editLabel, matchPrefix: editPrefix } : t));
    updateMutation.mutate({ id: editingId, label: editLabel, matchPrefix: editPrefix });
  };

  const addTab = () => {
    if (!newLabel.trim()) return;
    const prefix = newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    createMutation.mutate({ label: newLabel.trim(), matchPrefix: prefix });
  };

  // Drag-to-reorder
  const onDragStart = (id: number) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: number) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const reordered = [...localTabs];
    const fromIdx = reordered.findIndex(t => t.id === dragId);
    const toIdx = reordered.findIndex(t => t.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalTabs(reordered);
    setDragId(null);
    setDragOverId(null);
    reorderMutation.mutate(reordered.map(t => t.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-sm">Manage Tabs</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Tab list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-3">Drag to reorder. The "Match Prefix" tells the app which parts belong to this tab — it checks if the part's category contains that word.</p>
          {localTabs.map(tab => (
            <div
              key={tab.id}
              draggable
              onDragStart={() => onDragStart(tab.id)}
              onDragOver={e => onDragOver(e, tab.id)}
              onDrop={() => onDrop(tab.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`rounded-lg border transition-colors ${dragOverId === tab.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              {editingId === tab.id ? (
                <div className="p-3 space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Tab Label</label>
                    <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-8 text-sm" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Match Prefix</label>
                    <Input value={editPrefix} onChange={e => setEditPrefix(e.target.value)} className="h-8 text-sm font-mono" placeholder="e.g. yamaha, mercruiser" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={saveEdit} disabled={updateMutation.isPending}>
                      <Check size={13} className="mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <GripVertical size={14} className="text-muted-foreground shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tab.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tab.matchPrefix}</p>
                  </div>
                  <button onClick={() => startEdit(tab)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                    <PenLine size={13} />
                  </button>
                  <button
                    onClick={() => { if (localTabs.length > 1) deleteMutation.mutate(tab.id); else toast({ title: "Need at least one tab", variant: "destructive" }); }}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new tab */}
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="New tab name..."
              className="h-9 text-sm"
              onKeyDown={e => { if (e.key === "Enter") addTab(); }}
            />
            <Button size="sm" className="h-9 shrink-0" onClick={addTab} disabled={createMutation.isPending || !newLabel.trim()}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category combo-box ───────────────────────────────────────────────────────
function CategorySelect({ value, onChange, categories }: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
}) {
  const isCustom = value !== "" && !categories.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  useEffect(() => {
    if (value !== "" && !categories.includes(value)) setShowCustom(true);
  }, []); // only on mount

  const selectValue = showCustom ? "__custom__" : (value ?? "");

  return (
    <div className="space-y-1.5">
      <select
        value={selectValue}
        onChange={e => {
          if (e.target.value === "__custom__") {
            setShowCustom(true);
            onChange("");
          } else {
            setShowCustom(false);
            onChange(e.target.value);
          }
        }}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid="editor-category-select"
      >
        <option value="">— Select category —</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
        <option value="__custom__">Custom (type it in)...</option>
      </select>
      {showCustom && (
        <Input
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. MerCruiser - Cooling"
          className="h-8 text-sm"
          autoFocus
          data-testid="editor-category-custom"
        />
      )}
    </div>
  );
}

// ─── Inline editor form ───────────────────────────────────────────────────────
function EditorPanel({ value, onChange, onSave, onCancel, onDelete, isNew, isPending, allCategories }: {
  value: InsertPartsCatalog; onChange: (v: InsertPartsCatalog) => void;
  onSave: () => void; onCancel: () => void; onDelete?: () => void;
  isNew: boolean; isPending: boolean; allCategories: string[];
}) {
  const set = (k: keyof InsertPartsCatalog, v: any) => onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="font-semibold text-sm">{isNew ? "New Part" : "Edit Part"}</span>
        <button onClick={onCancel} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Part Number</label>
          <Input value={value.partNumber ?? ""} onChange={e => set("partNumber", e.target.value)} placeholder="e.g. 8M0097854" className="h-8 text-sm" data-testid="editor-part-number" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Description *</label>
          <Input value={value.description} onChange={e => set("description", e.target.value)} placeholder="Part description" className="h-8 text-sm" data-testid="editor-description" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
          <CategorySelect
            value={value.category ?? ""}
            onChange={v => set("category", v)}
            categories={allCategories}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Your Cost ($)</label>
            <Input type="number" step="0.01" min="0" value={value.costPrice ?? 0} onChange={e => set("costPrice", parseFloat(e.target.value) || 0)} className="h-8 text-sm" data-testid="editor-cost" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Sell Price ($)</label>
            <Input type="number" step="0.01" min="0" value={value.sellPrice ?? 0} onChange={e => set("sellPrice", parseFloat(e.target.value) || 0)} className="h-8 text-sm" data-testid="editor-sell" />
          </div>
        </div>
        {(value.costPrice ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            Markup: <span className="font-medium text-green-600">{((((value.sellPrice ?? 0) - (value.costPrice ?? 0)) / (value.costPrice ?? 1)) * 100).toFixed(0)}%</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Qty on Hand</label>
            <Input type="number" step="1" min="0" value={value.qtyOnHand ?? 0} onChange={e => set("qtyOnHand", parseFloat(e.target.value) || 0)} className="h-8 text-sm" data-testid="editor-qty" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Reorder Below</label>
            <Input type="number" step="1" min="0" value={value.reorderPoint ?? 0} onChange={e => set("reorderPoint", parseFloat(e.target.value) || 0)} className="h-8 text-sm" data-testid="editor-reorder" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
          <textarea value={value.notes ?? ""} onChange={e => set("notes", e.target.value)} placeholder="Fitment, supplier, lead time..." rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" data-testid="editor-notes" />
        </div>
        <button type="button" onClick={() => set("isCommon", !value.isCommon)}
          className={`flex items-center gap-2 text-sm rounded-md border px-3 py-2 w-full transition-colors ${value.isCommon ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          data-testid="editor-toggle-common">
          <Star size={14} className={value.isCommon ? "fill-amber-400 text-amber-400" : ""} />
          {value.isCommon ? "Common Part (starred)" : "Mark as Common Part"}
        </button>
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        <Button onClick={onSave} disabled={isPending || !value.description.trim()} className="w-full h-9" data-testid="editor-save">
          <Check size={14} className="mr-1.5" />{isPending ? "Saving..." : isNew ? "Add Part" : "Save Changes"}
        </Button>
        {!isNew && onDelete && (
          <Button variant="outline" onClick={onDelete} className="w-full h-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" data-testid="editor-delete">
            <Trash2 size={14} className="mr-1.5" />Delete Part
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Brand grouping config ───────────────────────────────────────────────────
const BRAND_GROUPS: { key: string; label: string; keywords: string[] }[] = [
  { key: "yamaha",    label: "Yamaha",    keywords: ["yamaha"] },
  { key: "mercury",   label: "Mercury",   keywords: ["mercury outboard", "mercury"] },
  { key: "mercruiser",label: "MerCruiser",keywords: ["mercruiser"] },
  { key: "volvo",     label: "Volvo Penta",keywords: ["volvo"] },
];

function brandForTab(tab: CatalogTab): string {
  const prefix = tab.matchPrefix.toLowerCase();
  const label  = tab.label.toLowerCase();
  // MerCruiser must match before Mercury to avoid false positives
  if (prefix.includes("mercruiser") || label.includes("mercruiser")) return "mercruiser";
  if (prefix.includes("mercury") || label.includes("mercury")) return "mercury";
  if (prefix.includes("yamaha") || label.includes("yamaha")) return "yamaha";
  if (prefix.includes("volvo") || label.includes("volvo")) return "volvo";
  return "other";
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartsCatalogPage() {
  usePageTitle("Parts Catalog");
  const [activeBrand, setActiveBrand] = useState<string>("yamaha");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCommonOnly, setShowCommonOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [editorValue, setEditorValue] = useState<InsertPartsCatalog>(BLANK);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showTabManager, setShowTabManager] = useState(false);
  const [addToWOPart, setAddToWOPart] = useState<PartsCatalog | null>(null);
  const [addToWOJobId, setAddToWOJobId] = useState<number | null>(null);  // WO id
  const [addToWOLineId, setAddToWOLineId] = useState<number | "none" | null>(null); // job line id
  const [addToWOQty, setAddToWOQty] = useState(1);
  const [addToWOSearch, setAddToWOSearch] = useState("");
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<null | {
    partNumber: string; description: string; sellPrice: number;
    costPrice: number; category: string; sourceUrl: string;
  }>(null);
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const { toast } = useToast();

  // Load tabs from DB
  const { data: tabs = [] } = useQuery<CatalogTab[]>({
    queryKey: ["/api/catalog-tabs"],
    queryFn: () => apiRequest("GET", "/api/catalog-tabs").then(r => r.json()),
  });

  // When brand changes or tabs load, set activeTabId to first tab of that brand
  useEffect(() => {
    if (tabs.length === 0) return;
    const brandTabs = tabs.filter(t => brandForTab(t) === activeBrand);
    if (brandTabs.length > 0) {
      // If current activeTabId is already in this brand, keep it
      if (!brandTabs.some(t => String(t.id) === activeTabId)) {
        setActiveTabId(String(brandTabs[0].id));
      }
    }
  }, [tabs, activeBrand]);

  const { data: catalog = [], isLoading } = useQuery<PartsCatalog[]>({
    queryKey: ["/api/parts-catalog", search],
    queryFn: () => apiRequest("GET", search ? `/api/parts-catalog?q=${encodeURIComponent(search)}` : "/api/parts-catalog").then(r => r.json()),
  });

  const { data: openJobs = [] } = useQuery<OpenJob[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then(r => r.json()),
  });

  const { data: woJobLines = [] } = useQuery<JobLine[]>({
    queryKey: ["/api/service", addToWOJobId, "jobs"],
    queryFn: () => apiRequest("GET", `/api/service/${addToWOJobId}/jobs`).then(r => r.json()),
    enabled: addToWOJobId !== null,
  });

  const addToWOMutation = useMutation({
    mutationFn: ({ woId, lineId, part, qty }: { woId: number; lineId: number | "none" | null; part: PartsCatalog; qty: number }) =>
      apiRequest("POST", `/api/service/${woId}/parts`, {
        partNumber: part.partNumber,
        description: part.description,
        quantity: qty,
        unitPrice: part.sellPrice ?? 0,
        catalogPartId: part.id,
        jobId: lineId !== "none" && lineId !== null ? lineId : undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      setAddToWOPart(null);
      setAddToWOJobId(null);
      setAddToWOLineId(null);
      setAddToWOQty(1);
      setAddToWOSearch("");
      toast({ title: "Part added to work order" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertPartsCatalog) => apiRequest("POST", "/api/parts-catalog", data).then(r => r.json()),
    onSuccess: (created: PartsCatalog) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-catalog"] });
      setSelectedId(created.id);
      setEditorValue({ ...created });
      toast({ title: "Part added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPartsCatalog> }) =>
      apiRequest("PATCH", `/api/parts-catalog/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-catalog"] });
      toast({ title: "Saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/parts-catalog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-catalog"] });
      setSelectedId(null);
      setDeleteConfirm(null);
      toast({ title: "Part deleted" });
    },
  });

  const selectItem = (item: PartsCatalog) => {
    setSelectedId(item.id);
    setEditorValue({ ...item });
    setDeleteConfirm(null);
  };

  const openNew = useCallback(() => {
    const activeTab = tabs.find(t => String(t.id) === activeTabId);
    const prefix = activeTab?.matchPrefix ?? "";
    // Try to form a reasonable default category
    const catDefault = activeTab
      ? (prefix === "other" ? "" : `${activeTab.label} - `)
      : "";
    setSelectedId("new");
    setEditorValue({ ...BLANK, category: catDefault });
    setDeleteConfirm(null);
  }, [activeTabId, tabs]);

  const handleSave = () => {
    if (selectedId === "new") {
      createMutation.mutate(editorValue as InsertPartsCatalog);
    } else if (typeof selectedId === "number") {
      updateMutation.mutate({ id: selectedId, data: editorValue });
    }
  };

  const handleDelete = () => {
    if (typeof selectedId === "number") {
      if (deleteConfirm === selectedId) {
        deleteMutation.mutate(selectedId);
      } else {
        setDeleteConfirm(selectedId);
      }
    }
  };

  const handleImportFetch = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportError("");
    try {
      const r = await apiRequest("POST", "/api/parts-catalog/import-url", { url: importUrl.trim() });
      const data = await r.json();
      if (!r.ok) { setImportError(data.error || "Failed to read page"); return; }
      setImportPreview(data);
    } catch (e: any) {
      setImportError(e.message || "Network error");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportSave = () => {
    if (!importPreview) return;
    createMutation.mutate(
      {
        partNumber: importPreview.partNumber,
        description: importPreview.description,
        category: importPreview.category,
        costPrice: importPreview.costPrice,
        sellPrice: importPreview.sellPrice,
        qtyOnHand: 0,
        reorderPoint: 0,
        notes: `Imported from: ${importPreview.sourceUrl}`,
        isCommon: false,
      },
      {
        onSuccess: () => {
          setShowImportUrl(false);
          setImportPreview(null);
          setImportUrl("");
          toast({ title: "Part imported and saved" });
        },
      }
    );
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, item: PartsCatalog | null) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    setCtxMenu({ x, y, item });
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Filter to active tab + search + common
  const tabItems = catalog.filter(p => {
    if (activeTabId === null || tabs.length === 0) return false;
    if (tabForItem(p, tabs) !== activeTabId) return false;
    if (showCommonOnly && !p.isCommon) return false;
    return true;
  });

  // Group by subcategory
  const groups: { label: string; items: PartsCatalog[] }[] = [];
  const groupMap = new Map<string, PartsCatalog[]>();
  for (const item of tabItems) {
    const key = subLabel(item);
    if (!groupMap.has(key)) { const arr: PartsCatalog[] = []; groupMap.set(key, arr); groups.push({ label: key, items: arr }); }
    groupMap.get(key)!.push(item);
  }

  const lowStockItems = catalog.filter(p => (p.reorderPoint ?? 0) > 0 && (p.qtyOnHand ?? 0) <= (p.reorderPoint ?? 0));
  const tabCounts = Object.fromEntries(tabs.map(t => [String(t.id), catalog.filter(p => tabForItem(p, tabs) === String(t.id)).length]));
  const isPending = createMutation.isPending || updateMutation.isPending;
  const allCategories = [...new Set(catalog.map(p => p.category ?? "").filter(Boolean))].sort();

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4" style={{ height: "calc(100vh - 56px)" }}>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} onAddNew={openNew}
          onEdit={item => { selectItem(item); }} onDelete={item => { selectItem(item); setDeleteConfirm(item.id); }} />
      )}

      {/* Tab manager sheet */}
      {showTabManager && tabs.length > 0 && (
        <TabManager tabs={tabs} onClose={() => setShowTabManager(false)} />
      )}

      {/* ── Top bar ── */}
      <div className="px-4 pt-4 pb-0 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Parts Catalog</h1>
            <p className="text-xs text-muted-foreground">
              {catalog.length} parts total
              {lowStockItems.length > 0 && <span className="text-amber-600 font-medium"> · {lowStockItems.length} low stock</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled title="External product imports are disconnected in this test copy." data-testid="button-import-url">
              <Link size={14} className="mr-1" /> Import disabled
            </Button>
            <Button onClick={openNew} size="sm" data-testid="button-add-part">
              <Plus size={15} className="mr-1" /> Add Part
            </Button>
          </div>
        </div>

        {/* Quick-reference links */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Yamaha Parts", url: "https://www.yamahaoutboards.com/en-us/owners/accessories-and-parts" },
            { label: "Mercury Parts", url: "https://www.mercurymarine.com/en/us/parts-and-accessories/" },
            { label: "Kellogg Land & Sea", url: "https://www.kelloggmarine.com" },
          ].map(({ label, url }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium rounded-md border border-border bg-background px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {label}
              <ExternalLink size={10} className="opacity-60" />
            </a>
          ))}
        </div>

        {/* Search + common filter */}
        <div className="flex gap-2">
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" data-testid="input-search-catalog" />
          <button
            onClick={() => setShowCommonOnly(v => !v)}
            className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 shrink-0 transition-colors ${showCommonOnly ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            data-testid="button-filter-common"
          >
            <Star size={12} className={showCommonOnly ? "fill-amber-400 text-amber-400" : ""} />
            Common
          </button>
        </div>

        {/* Brand selector — 4 main brand buttons */}
        <div className="flex gap-1 border-b border-border pb-0">
          {BRAND_GROUPS.map(brand => {
            const brandTabs = tabs.filter(t => brandForTab(t) === brand.key);
            const brandCount = brandTabs.reduce((sum, t) => sum + (tabCounts[String(t.id)] ?? 0), 0);
            const isActive = activeBrand === brand.key;
            return (
              <button
                key={brand.key}
                onClick={() => { setActiveBrand(brand.key); setSelectedId(null); setCollapsedGroups(new Set()); }}
                className={`flex-1 px-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`brand-${brand.key}`}
              >
                {brand.label}
                {brandCount > 0 && (
                  <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {brandCount}
                  </span>
                )}
              </button>
            );
          })}
          {/* Reorder tab */}
          <button
            onClick={() => { setActiveBrand("reorder"); setSelectedId(null); }}
            className={`px-2 py-2.5 text-xs font-semibold border-b-2 transition-colors relative ${
              activeBrand === "reorder" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="brand-reorder"
          >
            Reorder
            {lowStockItems.length > 0 && (
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                activeBrand === "reorder" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}>
                {lowStockItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowTabManager(true)}
            className="px-2.5 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground shrink-0"
            title="Manage tabs"
            data-testid="button-manage-tabs"
          >
            <Settings2 size={14} />
          </button>
        </div>

        {/* Sub-category dropdown for active brand — hidden on reorder tab */}
        {(() => {
          const brandTabs = tabs.filter(t => brandForTab(t) === activeBrand);
          if (activeBrand === "reorder" || brandTabs.length === 0) return null;
          return (
            <div className="flex items-center gap-2 py-2">
              <select
                value={activeTabId ?? ""}
                onChange={e => { setActiveTabId(e.target.value); setSelectedId(null); setCollapsedGroups(new Set()); }}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-subcategory"
              >
                {brandTabs.map(tab => (
                  <option key={tab.id} value={String(tab.id)}>
                    {tab.label}{(tabCounts[String(tab.id)] ?? 0) > 0 ? ` (${tabCounts[String(tab.id)]})` : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}
      </div>

      {/* ── Body: list + editor side-by-side ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Reorder view ── */}
        {activeBrand === "reorder" && (
          <div className="flex-1 overflow-y-auto p-4">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                <Package size={36} className="mb-3 opacity-30" />
                <p className="font-medium">Nothing to reorder</p>
                <p className="text-xs mt-1">Set a reorder point on any part to track it here</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">{lowStockItems.length} part{lowStockItems.length !== 1 ? "s" : ""} at or below reorder point</p>
                {lowStockItems.map(p => (
                  <div
                    key={p.id}
                    className="bg-card border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer hover:border-amber-400 transition-colors"
                    onClick={() => { setActiveBrand("reorder"); selectItem(p); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.description}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {p.partNumber && <span className="font-mono text-xs text-muted-foreground">#{p.partNumber}</span>}
                        {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {p.qtyOnHand ?? 0} on hand
                      </p>
                      <p className="text-xs text-muted-foreground">reorder at {p.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List — hidden when on reorder tab */}
        <div
          className={`flex flex-col overflow-hidden border-r border-border transition-all ${activeBrand === "reorder" ? "hidden" : selectedId !== null ? "w-1/2" : "w-full"}`}
          onContextMenu={e => handleContextMenu(e, null)}
        >
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : tabItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8 text-center">
              <Package size={32} className="mb-3 opacity-30" />
              <p className="font-medium text-sm">{showCommonOnly ? "No common parts in this tab" : "No parts here yet"}</p>
              <p className="text-xs mt-1">{showCommonOnly ? "Star a part to mark it common" : `Right-click or hit "+ Add Part" to add parts`}</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {groups.map(group => {
                const collapsed = collapsedGroups.has(group.label);
                const groupLow = group.items.filter(p => (p.reorderPoint ?? 0) > 0 && (p.qtyOnHand ?? 0) <= (p.reorderPoint ?? 0)).length;
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-muted/60 border-b border-border hover:bg-muted transition-colors"
                      data-testid={`group-${group.label}`}
                    >
                      {collapsed ? <ChevronRight size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1 text-left">{group.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{group.items.length}</span>
                      {groupLow > 0 && <AlertTriangle size={11} className="text-amber-500 ml-1" />}
                    </button>
                    {!collapsed && group.items.map(item => {
                      const isLow = (item.reorderPoint ?? 0) > 0 && (item.qtyOnHand ?? 0) <= (item.reorderPoint ?? 0);
                      const isSelected = selectedId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItem(item)}
                          onContextMenu={e => handleContextMenu(e, item)}
                          className={`w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-accent/50"}`}
                          data-testid={`list-item-${item.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {!!item.isCommon && <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
                              <span className="text-sm font-medium truncate">{item.description}</span>
                              {isLow && <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              {item.partNumber && <span>#{item.partNumber}</span>}
                              <span>${(item.sellPrice ?? 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={e => { e.stopPropagation(); setAddToWOPart(item); setAddToWOQty(1); setAddToWOSearch(""); }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Add to Work Order"
                              data-testid={`button-add-to-wo-${item.id}`}
                            >
                              <PackagePlus size={13} />
                            </button>
                            <ChevronRight size={14} className={`text-muted-foreground ${isSelected ? "text-primary" : ""}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor panel */}
        {selectedId !== null && (
          <div className="w-1/2 flex flex-col overflow-hidden bg-background">
            {deleteConfirm === selectedId ? (
              <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4">
                <Trash2 size={28} className="text-destructive" />
                <div>
                  <p className="font-semibold">Delete this part?</p>
                  <p className="text-sm text-muted-foreground mt-1">{editorValue.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">This cannot be undone.</p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" disabled={deleteMutation.isPending}
                    onClick={() => typeof selectedId === "number" && deleteMutation.mutate(selectedId)}>
                    {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <EditorPanel
                value={editorValue}
                onChange={setEditorValue}
                onSave={handleSave}
                onCancel={() => { setSelectedId(null); setDeleteConfirm(null); }}
                onDelete={selectedId !== "new" ? handleDelete : undefined}
                isNew={selectedId === "new"}
                isPending={isPending}
                allCategories={allCategories}
              />
            )}
          </div>
        )}
      </div>
      {/* Import by URL modal */}
      {showImportUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-0 sm:items-center sm:p-4"
          onClick={() => { if (!importLoading) setShowImportUrl(false); }}>
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-xl p-5 w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Link size={16} className="text-primary" />
                <span className="font-semibold text-base">Import by URL</span>
              </div>
              <button onClick={() => setShowImportUrl(false)} className="p-1 rounded hover:bg-accent text-muted-foreground" disabled={importLoading}>
                <X size={16} />
              </button>
            </div>

            {!importPreview ? (
              /* Step 1 — enter URL */
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste a product page URL from any marine parts site. The app will read the part number, description, and price from the page for you to review before saving.
                </p>
                <Input
                  placeholder="https://www.wholesalemarine.com/..."
                  value={importUrl}
                  onChange={e => { setImportUrl(e.target.value); setImportError(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && importUrl.trim()) handleImportFetch(); }}
                  className="h-9 text-sm"
                  autoFocus
                  disabled={importLoading}
                  data-testid="input-import-url"
                />
                {importError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {importError}
                  </div>
                )}
                <Button
                  className="w-full h-9"
                  disabled={importLoading || !importUrl.trim()}
                  onClick={handleImportFetch}
                  data-testid="button-import-fetch"
                >
                  {importLoading ? <><Loader2 size={14} className="mr-2 animate-spin" />Reading page...</> : <>Read Page</>}
                </Button>
              </div>
            ) : (
              /* Step 2 — review + edit before saving */
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Review and adjust anything before saving to your catalog.</p>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Part Number</label>
                  <Input value={importPreview.partNumber} onChange={e => setImportPreview(p => p && ({ ...p, partNumber: e.target.value }))} className="h-8 text-sm" data-testid="import-review-pn" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Description</label>
                  <Input value={importPreview.description} onChange={e => setImportPreview(p => p && ({ ...p, description: e.target.value }))} className="h-8 text-sm" data-testid="import-review-desc" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
                  <CategorySelect
                    value={importPreview.category}
                    onChange={v => setImportPreview(p => p && ({ ...p, category: v }))}
                    categories={allCategories}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Your Cost ($)</label>
                    <Input type="number" step="0.01" min="0" value={importPreview.costPrice} onChange={e => setImportPreview(p => p && ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" data-testid="import-review-cost" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Sell Price ($)</label>
                    <Input type="number" step="0.01" min="0" value={importPreview.sellPrice} onChange={e => setImportPreview(p => p && ({ ...p, sellPrice: parseFloat(e.target.value) || 0 }))} className="h-8 text-sm" data-testid="import-review-sell" />
                  </div>
                </div>
                <a href={importPreview.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary truncate">
                  <ExternalLink size={11} /> {importPreview.sourceUrl}
                </a>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => { setImportPreview(null); setImportError(""); }}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 h-9"
                    disabled={!importPreview.description.trim() || createMutation.isPending}
                    onClick={handleImportSave}
                    data-testid="button-import-save"
                  >
                    <Check size={14} className="mr-1.5" />
                    {createMutation.isPending ? "Saving..." : "Add to Catalog"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to Work Order modal */}
      {addToWOPart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setAddToWOPart(null); setAddToWOJobId(null); setAddToWOLineId(null); }}>
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-base mb-1">Add to Work Order</h3>
            <p className="text-sm text-muted-foreground mb-4 truncate">{addToWOPart.description}{addToWOPart.partNumber ? ` — #${addToWOPart.partNumber}` : ""}</p>

            {/* Step 1: Pick WO */}
            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                Step 1 — Work Order
              </label>
              <input
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2"
                placeholder="Search by customer or WO#..."
                value={addToWOSearch}
                onChange={e => { setAddToWOSearch(e.target.value); setAddToWOJobId(null); setAddToWOLineId(null); }}
                data-testid="input-add-to-wo-search"
              />
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-border/60">
                {openJobs
                  .filter(j => !addToWOSearch || j.customerName.toLowerCase().includes(addToWOSearch.toLowerCase()) || `WO-${String(j.id).padStart(4,"0")}`.toLowerCase().includes(addToWOSearch.toLowerCase()) || j.description.toLowerCase().includes(addToWOSearch.toLowerCase()))
                  .slice(0, 20)
                  .map(j => (
                    <button
                      key={j.id}
                      onClick={() => { setAddToWOJobId(j.id); setAddToWOLineId(null); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${addToWOJobId === j.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"}`}
                      data-testid={`button-wo-pick-${j.id}`}
                    >
                      <span className="font-mono text-xs mr-2 opacity-60">WO-{String(j.id).padStart(4,"0")}</span>
                      {j.customerName} — {j.boatMake} {j.boatModel}
                    </button>
                  ))}
                {openJobs.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No open work orders</p>}
              </div>
            </div>

            {/* Step 2: Pick job line — only shows after a WO is selected */}
            {addToWOJobId && (
              <div className="mb-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Step 2 — Job Line
                </label>
                <div className="border border-border rounded-lg divide-y divide-border/60 max-h-36 overflow-y-auto">
                  {/* No specific job option */}
                  <button
                    onClick={() => setAddToWOLineId("none")}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${addToWOLineId === "none" ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-muted-foreground"}`}
                    data-testid="button-line-none"
                  >
                    No specific job (WO level)
                  </button>
                  {woJobLines.map(line => (
                    <button
                      key={line.id}
                      onClick={() => setAddToWOLineId(line.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${addToWOLineId === line.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"}`}
                      data-testid={`button-line-pick-${line.id}`}
                    >
                      {line.title}
                      {line.description ? <span className="text-xs text-muted-foreground ml-1.5 truncate">— {line.description}</span> : null}
                    </button>
                  ))}
                  {woJobLines.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground italic">No job lines on this WO — will add at WO level</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Quantity — only shows after job line picked (or WO has no lines) */}
            {addToWOJobId && (addToWOLineId !== null || woJobLines.length === 0) && (
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Step 3 — Quantity
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="w-24 text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    value={addToWOQty}
                    onChange={e => setAddToWOQty(Math.max(1, Number(e.target.value)))}
                    data-testid="input-add-to-wo-qty"
                  />
                  {addToWOPart.sellPrice ? (
                    <span className="text-sm text-muted-foreground">× ${addToWOPart.sellPrice.toFixed(2)} = <span className="font-semibold text-foreground">${(addToWOQty * (addToWOPart.sellPrice ?? 0)).toFixed(2)}</span></span>
                  ) : null}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAddToWOPart(null); setAddToWOJobId(null); setAddToWOLineId(null); setAddToWOQty(1); setAddToWOSearch(""); }}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >Cancel</button>
              <button
                disabled={!addToWOJobId || (addToWOLineId === null && woJobLines.length > 0) || addToWOMutation.isPending}
                onClick={() => addToWOJobId && addToWOMutation.mutate({ woId: addToWOJobId, lineId: addToWOLineId, part: addToWOPart!, qty: addToWOQty })}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="button-confirm-add-to-wo"
              >
                {addToWOMutation.isPending ? "Adding..." : "Add to WO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
