import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  ChevronLeft, Plus,
  Pencil, Trash2, ChevronRight, ChevronDown, Anchor, Check, X as XIcon,
  MessageSquare, PhoneCall, CalendarClock, Trash,
  Camera, ZoomIn, ImageOff, Search, Wrench, Package, Copy, History,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { photoDataUrl } from "@/lib/test-photos";
import type { Customer, Boat, InsertBoat } from "@shared/schema";
import { useKeybind, useClickBind } from "@/lib/keybind-provider";


// ─── At-a-glance types ────────────────────────────────────────────────────────────
type CustomerAtAGlance = {
  lifetimeSpend: number;
  boatsServiced: number;
  openWOs: number;
  upcomingEvents: number;
  lastVisitDate: string | null;
  lastVisitRelative: string | null;
};

function AtAGlanceStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 bg-card border border-border rounded-xl px-3 py-2.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{label}</span>
      <span className="text-base font-bold leading-tight truncate">{value}</span>
    </div>
  );
}

// ─── Photo types ─────────────────────────────────────────────────────────────────
type CustomerPhoto = {
  id: number;
  serviceRecordId: number;
  serviceDate: string;
  serviceDescription: string;
  storageUrl: string | null;
  dataUrl: string | null;
  storagePath: string | null;
  filename: string;
  caption: string | null;
};

// Compress before upload (matches photos-section logic)
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Compression failed")), "image/jpeg", 0.78);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Customer Photo Gallery Sheet ──────────────────────────────────────────────
function CustomerPhotoGallery({ customerId, customerName, open, onClose }: {
  customerId: number;
  customerName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<{ id: number; value: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos = [], isLoading } = useQuery<CustomerPhoto[]>({
    queryKey: ["/api/customers", customerId, "photos"],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}/photos`).then(r => r.json()),
    enabled: open,
  });

  const photoSrc = (p: CustomerPhoto) => p.storageUrl ?? p.dataUrl ?? "";

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImage(file);
        await apiRequest("POST", `/api/customers/${customerId}/photos`, {
          dataUrl: await photoDataUrl(compressed),
          filename: file.name,
          caption: "",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "photos"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveCaption = useMutation({
    mutationFn: ({ id, caption }: { id: number; caption: string }) =>
      apiRequest("PATCH", `/api/photos/${id}/caption`, { caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "photos"] });
      setEditingCaption(null);
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: CustomerPhoto) => {
      await apiRequest("DELETE", `/api/photos/${photo.id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "photos"] }),
  });

  return (
    <>
      <Sheet open={open} onOpenChange={o => !o && onClose()}>
        <SheetContent side="bottom" className="h-[92vh] flex flex-col p-0 rounded-t-2xl">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Camera size={16} className="text-primary" />
                Photos — {customerName}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Plus size={14} className="mr-1" />{uploading ? "Uploading..." : "Add Photo"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={e => { handleUpload(e.target.files); e.target.value = ""; }}
                />
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map(i => <Skeleton key={i} className="aspect-square rounded-lg" />)}
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ImageOff size={32} className="opacity-20 mb-3" />
                <p className="text-sm font-medium">No photos yet</p>
                <p className="text-xs mt-1">Tap "Add Photo" to attach repair or damage photos</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted" data-testid={`customer-photo-${photo.id}`}>
                    <img
                      src={photoSrc(photo)}
                      alt={photo.caption || photo.filename}
                      className="w-full aspect-square object-cover cursor-pointer"
                      loading="lazy"
                      onClick={() => setLightboxIndex(photos.findIndex(p => p.id === photo.id))}
                    />
                    {/* Caption strip */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-4 pb-1.5">
                      {editingCaption?.id === photo.id ? (
                        <div className="flex gap-1 items-center">
                          <input
                            autoFocus
                            className="flex-1 text-[10px] bg-white/20 text-white placeholder:text-white/50 rounded px-1.5 py-0.5 border-none outline-none min-w-0"
                            value={editingCaption.value}
                            placeholder="Add note..."
                            onChange={e => setEditingCaption(c => c ? { ...c, value: e.target.value } : c)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveCaption.mutate({ id: photo.id, caption: editingCaption.value });
                              if (e.key === "Escape") setEditingCaption(null);
                            }}
                          />
                          <button onClick={() => saveCaption.mutate({ id: photo.id, caption: editingCaption.value })} className="text-green-400 shrink-0"><Check size={11} /></button>
                          <button onClick={() => setEditingCaption(null)} className="text-white/60 shrink-0"><XIcon size={11} /></button>
                        </div>
                      ) : (
                        <button
                          className="w-full text-left"
                          onClick={() => setEditingCaption({ id: photo.id, value: photo.caption ?? "" })}
                        >
                          <p className="text-[10px] text-white/90 truncate leading-tight">
                            {photo.caption || <span className="text-white/40 italic">tap to add note</span>}
                          </p>
                          {photo.serviceDescription && (
                            <p className="text-[9px] text-white/50 truncate leading-tight mt-0.5">{photo.serviceDescription}</p>
                          )}
                        </button>
                      )}
                    </div>
                    {/* Actions overlay */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setLightboxIndex(photos.findIndex(p => p.id === photo.id))} className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                        <ZoomIn size={11} />
                      </button>
                      <button
                        onClick={() => deletePhoto.mutate(photo)}
                        className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500/80"
                        data-testid={`button-delete-customer-photo-${photo.id}`}
                      >
                        <XIcon size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox (Feature D, Batch 2) */}
      <PhotoLightbox
        photos={photos.map(p => ({
          id: p.id,
          src: photoSrc(p),
          caption: p.caption,
          filename: p.filename,
          createdAt: p.serviceDate,
        }))}
        startIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onUpdateCaption={(id, caption) => saveCaption.mutate({ id, caption })}
        onDelete={id => {
          const photo = photos.find(p => p.id === id);
          if (photo) deletePhoto.mutate(photo);
          setLightboxIndex(null);
        }}
      />
    </>
  );
}

// ─── Communication Log types ─────────────────────────────────────────────────
type CommLog = {
  id: number;
  customerId: number;
  type: string; // 'note' | 'call' | 'followup'
  text: string;
  timestamp: string;
  done: boolean | null;
};

function commTypeIcon(type: string) {
  if (type === "call") return <PhoneCall size={12} />;
  if (type === "followup") return <CalendarClock size={12} />;
  return <MessageSquare size={12} />;
}

function commTypeLabel(type: string) {
  if (type === "call") return "Call";
  if (type === "followup") return "Follow-up";
  return "Note";
}

function timeAgo(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Inline editable field ─────────────────────────────────────────────────────
function InlineField({
  label, value, onSave, type = "text", multiline = false, placeholder = ""
}: {
  label: string;
  value: string | null | undefined;
  onSave: (val: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => { setDraft(value ?? ""); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = () => { onSave(draft); setEditing(false); };

  const inputClass = "flex-1 h-7 px-2 py-0 text-sm border border-primary/40 rounded focus:outline-none focus:ring-1 focus:ring-ring bg-background";

  return (
    <div className="group flex items-start gap-2 py-1 min-h-[28px]">
      <span className="w-24 shrink-0 text-xs text-muted-foreground font-medium pt-1">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {multiline ? (
            <textarea
              autoFocus
              className="flex-1 px-2 py-1 text-sm border border-primary/40 rounded focus:outline-none focus:ring-1 focus:ring-ring bg-background resize-none min-h-[56px]"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={placeholder}
            />
          ) : (
            <input
              autoFocus
              type={type}
              className={inputClass}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              placeholder={placeholder}
            />
          )}
          <button onClick={save} className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 shrink-0"><Check size={14} /></button>
          <button onClick={cancel} className="p-1 rounded text-muted-foreground hover:bg-accent shrink-0"><XIcon size={14} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm flex-1 min-w-0 break-words">{value || <span className="text-muted-foreground italic text-xs">—</span>}</span>
          <button onClick={startEdit} className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-all shrink-0">
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Boat form ─────────────────────────────────────────────────────────────────
// ─── ComboField — typeable input with dropdown suggestions ────────────────────
function ComboField({
  label, value, onChange, options, placeholder = "", required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep input in sync when form resets
  useEffect(() => { setInput(value ?? ""); }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes(input.toLowerCase()));

  const select = (v: string) => {
    setInput(v);
    onChange(v);
    setOpen(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if focus leaves the whole container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      onChange(input);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <p className="text-sm font-medium leading-none mb-1.5">{label}{required && " *"}</p>
      <input
        type="text"
        value={input}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(opt); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${opt === input ? "bg-accent/50 font-semibold" : ""}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoatForm({
  customerId, defaultValues, onSubmit, isPending,
}: {
  customerId: number;
  defaultValues?: Partial<InsertBoat>;
  onSubmit: (data: InsertBoat) => void;
  isPending: boolean;
}) {
  const form = useForm<InsertBoat>({
    defaultValues: {
      customerId,
      make: "", model: "", year: undefined, color: "", length: undefined,
      engineType: "", engineMake: "", engineModel: "", engineHours: undefined,
      horsepower: undefined, engineSerial: "", transomSerial: "", driveSerial: "",
      hullId: "", registrationNumber: "", storageLocation: "", notes: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="make" rules={{ required: "Make is required" }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ComboField
                    label="Make"
                    required
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Type or select..."
                    options={["Sea Ray","Bayliner","Boston Whaler","Malibu","MasterCraft","Grady-White","Ranger","Lund","Tracker","Crestliner","Chaparral","Cobalt","Regal","Four Winns","Larson","Stratos","Triton","Yamaha","Kawasaki","Polaris","Alumacraft","Nitro","Skeeter","Wellcraft","Contender","Pursuit","Robalo","Scout","Tidewater","Carolina Skiff","Other"]}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          <FormField control={form.control} name="model"
            render={({ field }) => (
              <FormItem><FormLabel>Model</FormLabel>
                <FormControl><Input placeholder="e.g. Sundancer 320" {...field} value={field.value ?? ""} data-testid="input-boat-model" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="year"
            render={({ field }) => (
              <FormItem><FormLabel>Year</FormLabel>
                <FormControl><Input type="number" placeholder="2022" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-boat-year" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="color"
            render={({ field }) => (
              <FormItem><FormLabel>Color</FormLabel>
                <FormControl><Input placeholder="White / Blue" {...field} value={field.value ?? ""} data-testid="input-boat-color" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="length"
            render={({ field }) => (
              <FormItem><FormLabel>Length (ft)</FormLabel>
                <FormControl><Input type="number" step="0.1" placeholder="22.5" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-boat-length" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="engineType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ComboField
                    label="Engine Type"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Type or select..."
                    options={["Outboard","Sterndrive","Inboard","Jet Drive","Electric","Other"]}
                  />
                </FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="engineMake"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ComboField
                    label="Engine Make"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Type or select..."
                    options={["Yamaha","Mercury","Evinrude","Honda","Suzuki","Volvo Penta","MerCruiser","OMC","Johnson","Tohatsu","BRP","Mercruiser","Crusader","PCM","Indmar","Ilmor","Minn Kota","Other"]}
                  />
                </FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="engineModel"
            render={({ field }) => (
              <FormItem><FormLabel>Engine Model</FormLabel>
                <FormControl><Input placeholder="e.g. F150" {...field} value={field.value ?? ""} data-testid="input-engine-model" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="engineHours"
            render={({ field }) => (
              <FormItem><FormLabel>Engine Hours <span style={{fontSize:11,color:"var(--muted-foreground)",fontWeight:400}}>(optional)</span></FormLabel>
                <FormControl><Input type="number" step="0.1" placeholder="342" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-engine-hours" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="horsepower"
            render={({ field }) => (
              <FormItem><FormLabel>Horsepower <span style={{fontSize:11,color:"var(--muted-foreground)",fontWeight:400}}>(optional)</span></FormLabel>
                <FormControl><Input type="number" placeholder="150" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid="input-horsepower" /></FormControl>
              </FormItem>
            )} />
        </div>

        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1">Serial Numbers</div>
        <div className="grid grid-cols-1 gap-3">
          <FormField control={form.control} name="engineSerial"
            render={({ field }) => (
              <FormItem><FormLabel>Engine Serial #</FormLabel>
                <FormControl><Input placeholder="Engine serial number" {...field} value={field.value ?? ""} data-testid="input-engine-serial" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="transomSerial"
            render={({ field }) => (
              <FormItem><FormLabel>Transom Serial #</FormLabel>
                <FormControl><Input placeholder="Transom serial number" {...field} value={field.value ?? ""} data-testid="input-transom-serial" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="driveSerial"
            render={({ field }) => (
              <FormItem><FormLabel>Drive Serial #</FormLabel>
                <FormControl><Input placeholder="Drive serial number" {...field} value={field.value ?? ""} data-testid="input-drive-serial" /></FormControl>
              </FormItem>
            )} />
        </div>

        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2 pb-1">Identification</div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="hullId"
            render={({ field }) => (
              <FormItem><FormLabel>HIN / Hull ID</FormLabel>
                <FormControl><Input placeholder="SERWA123M89H" {...field} value={field.value ?? ""} data-testid="input-hull-id" /></FormControl>
              </FormItem>
            )} />
          <FormField control={form.control} name="registrationNumber"
            render={({ field }) => (
              <FormItem><FormLabel>Registration #</FormLabel>
                <FormControl><Input placeholder="NH1234AB" {...field} value={field.value ?? ""} data-testid="input-registration" /></FormControl>
              </FormItem>
            )} />
        </div>
        <FormField control={form.control} name="storageLocation"
          render={({ field }) => (
            <FormItem><FormLabel>Storage Location</FormLabel>
              <FormControl><Input placeholder="e.g. Slip 14, Rack B-3" {...field} value={field.value ?? ""} data-testid="input-storage-location" /></FormControl>
            </FormItem>
          )} />
        <FormField control={form.control} name="notes"
          render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel>
              <FormControl>
                <textarea
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[70px]"
                  placeholder="Any relevant notes about this boat..."
                  {...field} value={field.value ?? ""} data-testid="input-boat-notes"
                />
              </FormControl>
            </FormItem>
          )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-boat">
            {isPending ? "Saving..." : "Save Boat"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
// ─── Service History types ──────────────────────────────────────────────────
interface HistoryJob {
  id: number; title: string; name: string; description: string | null;
  laborHours: number; laborRate: number; flatRate: number | null;
  pricingType: string; techNotes: string | null; status: string;
}
interface HistoryPart {
  id: number; partNumber: string | null; description: string; quantity: number; unitPrice: number;
}
interface HistoryEntry {
  serviceRecord: {
    id: number; boatId: number; date: string; description: string;
    techNotes: string | null; status: string; dueDate: string | null;
  };
  boat: { id: number; make: string; model: string | null; year: number | null } | null;
  jobs: HistoryJob[];
  parts: HistoryPart[];
  totalCost: number;
}

function fmtHistoryDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

const HISTORY_STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

function HistoryCard({ entry, onCloned }: { entry: HistoryEntry; onCloned: (newId: number) => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const boatLabel = entry.boat ? [entry.boat.year, entry.boat.make, entry.boat.model].filter(Boolean).join(" ") : "—";

  const cloneMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/work-orders/${entry.serviceRecord.id}/clone`, {}).then(r => r.json()),
    onSuccess: (created: any) => {
      toast({ title: "Work order duplicated" });
      onCloned(created.id);
    },
    onError: (err: any) => toast({ title: err?.message ?? "Failed to duplicate work order", variant: "destructive" }),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-3.5" data-testid={`history-card-${entry.serviceRecord.id}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{fmtHistoryDate(entry.serviceRecord.date)}</p>
          <p className="text-xs text-muted-foreground truncate">{boatLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${HISTORY_STATUS_STYLES[entry.serviceRecord.status] ?? "bg-muted text-muted-foreground"}`}>
            {entry.serviceRecord.status}
          </span>
          <span className="text-sm font-bold">${entry.totalCost.toFixed(2)}</span>
        </div>
      </div>

      <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>
        {entry.serviceRecord.description || "No description"}
      </p>

      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
        data-testid={`button-expand-history-${entry.serviceRecord.id}`}
      >
        <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Show less" : "Show details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {entry.serviceRecord.techNotes && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tech Notes</p>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">{entry.serviceRecord.techNotes}</p>
            </div>
          )}

          {entry.jobs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Wrench size={11} />Jobs</p>
              <div className="space-y-1.5">
                {entry.jobs.map(j => (
                  <div key={j.id} className="text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
                    <p className="font-medium">{j.title || j.name}</p>
                    {j.techNotes && <p className="text-muted-foreground mt-0.5">{j.techNotes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.parts.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Package size={11} />Parts</p>
              <div className="space-y-1">
                {entry.parts.map(p => (
                  <div key={p.id} className="text-xs flex items-center justify-between">
                    <span className="text-muted-foreground truncate">{p.description} {p.partNumber ? `(${p.partNumber})` : ""}</span>
                    <span className="shrink-0 ml-2">{p.quantity} × ${p.unitPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <a href={`#/jobs/${entry.serviceRecord.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
              Open full WO <ChevronRight size={12} />
            </a>
            <button
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto disabled:opacity-50"
              data-testid={`button-clone-history-${entry.serviceRecord.id}`}
            >
              <Copy size={12} />{cloneMutation.isPending ? "Duplicating..." : "Clone as new WO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceHistorySection({ customerId, collapsed, onToggleCollapsed }: {
  customerId: number;
  // Batch 2.5 minimal addition: section-level collapse state, lifted to the parent so the
  // cust.historyToggle keybind can drive it. Previously this section had no collapse toggle
  // at all (only per-card expand/collapse inside HistoryCard, which is untouched).
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: history = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ["/api/customers", customerId, "history"],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}/history`).then(r => r.json()),
  });

  const filtered = search.trim() === ""
    ? history
    : history.filter(h => h.serviceRecord.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mb-6" data-testid="section-service-history">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onToggleCollapsed}
          className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
          data-testid="button-toggle-history-section"
        >
          <History size={14} />Service History ({history.length})
          <ChevronDown size={13} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>

      {!collapsed && (
        <>
          {history.length > 0 && (
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by description..."
                className="h-9 pl-8 text-sm"
                data-testid="input-filter-history"
              />
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">{history.length === 0 ? "No service history yet." : "No results match your search."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => (
                <HistoryCard
                  key={entry.serviceRecord.id}
                  entry={entry}
                  onCloned={newId => navigate(`/jobs/${newId}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const [addBoatOpen, setAddBoatOpen] = useState(false);
  const [editBoat, setEditBoat] = useState<Boat | null>(null);
  const [deleteBoat, setDeleteBoat] = useState<Boat | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const { toast } = useToast();

  // Communication log state
  const [newLogType, setNewLogType] = useState<"note" | "call" | "followup">("note");
  const [newLogText, setNewLogText] = useState("");
  const [addingLog, setAddingLog] = useState(false);

  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}`).then(r => r.json()),
  });

  const { data: boats = [], isLoading: loadingBoats } = useQuery<Boat[]>({
    queryKey: ["/api/customers", customerId, "boats"],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}/boats`).then(r => r.json()),
  });

  const { data: atAGlance, isLoading: loadingAtAGlance } = useQuery<CustomerAtAGlance>({
    queryKey: ["/api/customers", customerId, "at-a-glance"],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}/at-a-glance`).then(r => r.json()),
    enabled: !!customerId,
  });

  usePageTitle(customer?.name ?? "Customer");

  const updateCustomerMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => apiRequest("PATCH", `/api/customers/${customerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
  });

  const createBoatMutation = useMutation({
    mutationFn: (data: InsertBoat) => apiRequest("POST", "/api/boats", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "boats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setAddBoatOpen(false);
      toast({ title: "Boat added" });
    },
  });

  const updateBoatMutation = useMutation({
    mutationFn: ({ boatId, data }: { boatId: number; data: Partial<InsertBoat> }) =>
      apiRequest("PATCH", `/api/boats/${boatId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "boats"] });
      setEditBoat(null);
      toast({ title: "Boat updated" });
    },
  });

  const deleteBoatMutation = useMutation({
    mutationFn: (boatId: number) => apiRequest("DELETE", `/api/boats/${boatId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "boats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDeleteBoat(null);
      toast({ title: "Boat removed" });
    },
  });

  // Comm log
  const { data: commLog = [] } = useQuery<CommLog[]>({
    queryKey: ["/api/customers", customerId, "comm-log"],
    queryFn: () => apiRequest("GET", `/api/customers/${customerId}/comm-log`).then(r => r.json()),
  });

  const addLogMutation = useMutation({
    mutationFn: (data: { type: string; text: string }) =>
      apiRequest("POST", `/api/customers/${customerId}/comm-log`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "comm-log"] });
      setNewLogText("");
      setAddingLog(false);
    },
  });

  const toggleLogDone = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      apiRequest("PATCH", `/api/comm-log/${id}`, { done }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "comm-log"] }),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/comm-log/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "comm-log"] }),
  });

  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  // ─── Keybinds (Batch 2.5): cust.* scope ───
  useKeybind("cust.newBoat", () => setAddBoatOpen(true), []);
  useKeybind("cust.historyToggle", () => setHistoryCollapsed(v => !v), []);
  useKeybind("cust.copyInfo", () => {
    if (!customer) return;
    const lines = [customer.name, customer.phone, customer.email, customer.address].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => toast({ title: "Customer info copied" }))
      .catch(() => toast({ title: "Failed to copy", variant: "destructive" }));
  }, [customer]);
  // No dedicated "New WO" button exists on this page (WO creation currently only happens
  // from the Work Orders list via NewWOSheet). We navigate there with a query flag carrying
  // this customer's id so the sheet can prefill it — same ?new=1 pattern used by Layout.tsx's
  // global new.workOrder binding. TODO: if NewWOSheet doesn't yet read/prefill ?customerId=,
  // that's a small follow-up in work-orders.tsx (out of scope here per "don't touch Batch 2").
  useKeybind("cust.newWO", () => {
    window.location.hash = `#/jobs?new=1&customerId=${customerId}`;
  }, [customerId]);

  if (loadingCustomer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Customer not found.</p>
        <Link href="/customers" className="text-primary text-sm mt-2 inline-block">← Back to customers</Link>
      </div>
    );
  }

  const saveField = (field: keyof Customer) => (val: string) => {
    updateCustomerMutation.mutate({ [field]: val || null } as any);
  };

  const copyCustomerInfo = () => {
    const lines = [customer.name, customer.phone, customer.email, customer.address].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => toast({ title: "Customer info copied" }))
      .catch(() => toast({ title: "Failed to copy", variant: "destructive" }));
  };

  return (
    <div>
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors" data-testid="link-back">
        <ChevronLeft size={16} />Customers
      </Link>

      {/* Customer info card with inline editing */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
            {customer.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <InlineField
                label="Name"
                value={customer.name}
                onSave={saveField("name")}
                placeholder="Full name"
              />
              <button
                onClick={copyCustomerInfo}
                className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 hover:bg-accent transition-colors"
                data-testid="button-copy-customer-info"
                title="Copy name, phone, email, address"
              >
                <Copy size={12} />Copy info
              </button>
            </div>
            <div className="divide-y divide-border/50">
              <InlineField label="Phone" value={customer.phone} onSave={saveField("phone")} placeholder="603-555-0100" />
              <InlineField label="Email" value={customer.email} onSave={saveField("email")} type="email" placeholder="email@example.com" />
              <InlineField label="Address" value={customer.address} onSave={saveField("address")} placeholder="123 Lake Rd, Conway, NH" />
              <InlineField label="Notes" value={customer.notes} onSave={saveField("notes")} multiline placeholder="Any notes..." />
            </div>
          </div>
        </div>
      </div>

      {/* At-a-glance stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {loadingAtAGlance ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : (
          <>
            <AtAGlanceStat label="Lifetime Spend" value={atAGlance ? `$${Math.round(atAGlance.lifetimeSpend).toLocaleString()}` : "—"} />
            <AtAGlanceStat label="Boats Serviced" value={atAGlance?.boatsServiced ?? "—"} />
            <AtAGlanceStat label="Open WOs" value={atAGlance?.openWOs ?? "—"} />
            <AtAGlanceStat label="Upcoming Events" value={atAGlance?.upcomingEvents ?? "—"} />
            <AtAGlanceStat label="Last Visit" value={atAGlance?.lastVisitRelative ?? "Never"} />
          </>
        )}
      </div>

      {/* Photos button */}
      <button
        onClick={() => setPhotosOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 mb-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all"
        data-testid="button-customer-photos"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Camera size={16} />
          Customer Photos
        </span>
        <ChevronRight size={16} className="opacity-70" />
      </button>

      {/* Boats section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Boats ({boats.length})
        </h2>
        <Button size="sm" onClick={() => setAddBoatOpen(true)} data-testid="button-add-boat">
          <Plus size={14} className="mr-1" />Add Boat
        </Button>
      </div>

      {loadingBoats ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : boats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Anchor size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No boats on file</p>
          <p className="text-xs mt-0.5">Add a boat to start tracking service</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="boats-list">
          {boats.map(boat => (
            <div
              key={boat.id}
              className="group flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 hover:bg-accent/30 transition-all"
              data-testid={`card-boat-${boat.id}`}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Anchor size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {[boat.year, boat.make, boat.model].filter(Boolean).join(" ")}
                </p>
                <div className="flex flex-wrap gap-x-3 mt-0.5">
                  {boat.color && <span className="text-xs text-muted-foreground">{boat.color}</span>}
                  {boat.engineMake && <span className="text-xs text-muted-foreground">{boat.engineMake} {boat.engineModel}</span>}
                  {boat.engineHours != null && <span className="text-xs text-muted-foreground">{boat.engineHours} hrs</span>}
                  {boat.storageLocation && <span className="text-xs text-muted-foreground">{boat.storageLocation}</span>}
                </div>
                {boat.stickyNote && (
                  <p className="mt-1 text-xs px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 truncate max-w-full">
                    {boat.stickyNote}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditBoat(boat)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  data-testid={`button-edit-boat-${boat.id}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteBoat(boat)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  data-testid={`button-delete-boat-${boat.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <Link
                href={`/boats/${boat.id}`}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                data-testid={`link-boat-detail-${boat.id}`}
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Communication Log */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Communication Log ({commLog.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setAddingLog(v => !v)} data-testid="button-add-log">
            <Plus size={14} className="mr-1" />{addingLog ? "Cancel" : "Add Entry"}
          </Button>
        </div>

        {/* New entry form */}
        {addingLog && (
          <div className="bg-card border border-border rounded-xl p-4 mb-3 space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {(["note", "call", "followup"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewLogType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    newLogType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                  }`}
                  data-testid={`button-log-type-${t}`}
                >
                  {commTypeIcon(t)}{commTypeLabel(t)}
                </button>
              ))}
            </div>
            <textarea
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              placeholder={newLogType === "call" ? "Log the call — what was discussed..." : newLogType === "followup" ? "What needs follow-up..." : "Add a note..."}
              value={newLogText}
              onChange={e => setNewLogText(e.target.value)}
              data-testid="input-log-text"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setAddingLog(false); setNewLogText(""); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={!newLogText.trim() || addLogMutation.isPending}
                onClick={() => newLogText.trim() && addLogMutation.mutate({ type: newLogType, text: newLogText.trim() })}
                data-testid="button-save-log"
              >
                Save
              </Button>
            </div>
          </div>
        )}

        {commLog.length === 0 && !addingLog ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No entries yet</p>
            <p className="text-xs mt-0.5">Log calls, notes, and follow-ups here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commLog.map(entry => (
              <div
                key={entry.id}
                className={`group flex gap-3 bg-card border rounded-xl px-4 py-3 transition-all ${entry.done ? "opacity-60 border-border/40" : "border-border"}`}
                data-testid={`card-log-${entry.id}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  entry.type === "call" ? "bg-blue-500/10 text-blue-500" :
                  entry.type === "followup" ? "bg-amber-500/10 text-amber-500" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {commTypeIcon(entry.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{commTypeLabel(entry.type)}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                  </div>
                  <p className={`text-sm ${entry.done ? "line-through text-muted-foreground" : ""}`}>{entry.text}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {entry.type === "followup" && (
                    <button
                      onClick={() => toggleLogDone.mutate({ id: entry.id, done: !entry.done })}
                      className={`p-1.5 rounded-md transition-colors ${entry.done ? "text-green-500 hover:bg-green-500/10" : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"}`}
                      data-testid={`button-toggle-done-${entry.id}`}
                      title={entry.done ? "Mark open" : "Mark done"}
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteLogMutation.mutate(entry.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid={`button-delete-log-${entry.id}`}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service History */}
      <ServiceHistorySection customerId={customerId} collapsed={historyCollapsed} onToggleCollapsed={() => setHistoryCollapsed(v => !v)} />

      {/* Customer Photo Gallery */}
      {customer && (
        <CustomerPhotoGallery
          customerId={customerId}
          customerName={customer.name}
          open={photosOpen}
          onClose={() => setPhotosOpen(false)}
        />
      )}

      {/* Add Boat Dialog */}
      <Dialog open={addBoatOpen} onOpenChange={setAddBoatOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Boat</DialogTitle></DialogHeader>
          <BoatForm customerId={customerId} onSubmit={data => createBoatMutation.mutate(data)} isPending={createBoatMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit Boat Dialog */}
      <Dialog open={!!editBoat} onOpenChange={o => !o && setEditBoat(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Boat</DialogTitle></DialogHeader>
          {editBoat && (
            <BoatForm
              customerId={customerId}
              defaultValues={editBoat}
              onSubmit={data => updateBoatMutation.mutate({ boatId: editBoat.id, data })}
              isPending={updateBoatMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Boat */}
      <Dialog open={!!deleteBoat} onOpenChange={o => !o && setDeleteBoat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Boat</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium text-foreground">{[deleteBoat?.year, deleteBoat?.make, deleteBoat?.model].filter(Boolean).join(" ")}</span>? This will also delete all service records for this boat. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteBoat(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteBoatMutation.isPending}
              onClick={() => deleteBoat && deleteBoatMutation.mutate(deleteBoat.id)}
              data-testid="button-confirm-delete-boat"
            >
              {deleteBoatMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
