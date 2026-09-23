import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, Plus, X, ZoomIn } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useClickBind } from "@/lib/keybind-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { photoDataUrl } from "@/lib/test-photos";
import type { ServicePhoto } from "@shared/schema";


// Compress + resize a File before upload. Targets ~150KB JPEG max.
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // Max dimension 1200px — enough for damage documentation, small enough to load fast
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error("Compression failed")),
          "image/jpeg",
          0.78 // quality 78% — good clarity, small file
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotosSection({ serviceId }: { serviceId: number }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<{ id: number; value: string } | null>(null);

  const { data: photos = [], isLoading } = useQuery<ServicePhoto[]>({
    queryKey: ["/api/service", serviceId, "photos"],
    queryFn: () => apiRequest("GET", `/api/service/${serviceId}/photos`).then(r => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1. Compress client-side
      const compressed = await compressImage(file);

      // Test photos are stored only in the sandbox SQLite database.
      await apiRequest("POST", `/api/service/${serviceId}/photos`, {
        dataUrl: await photoDataUrl(compressed),
        filename: file.name,
        caption: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "photos"] });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: ServicePhoto) => {
      await apiRequest("DELETE", `/api/photos/${photo.id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "photos"] }),
  });

  const saveCaptionMutation = useMutation({
    mutationFn: ({ id, caption }: { id: number; caption: string }) =>
      apiRequest("PATCH", `/api/photos/${id}/caption`, { caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service", serviceId, "photos"] });
      setEditingCaption(null);
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => {
      if (!f.type.startsWith("image/")) {
        toast({ title: "Images only", variant: "destructive" });
        return;
      }
      uploadMutation.mutate(f);
    });
  };

  // Use storage URL if available, fall back to old base64 for existing photos
  const photoSrc = (photo: ServicePhoto) =>
    (photo as any).storageUrl ?? (photo as any).dataUrl ?? "";

  // Modifier+Click (Batch 2.5 addendum): Ctrl+Click opens the full-size photo in a new
  // tab, Alt+Click deletes the photo (guarded by window.confirm inside useClickBind since
  // this binding id ends in ".delete").
  const handlePhotoNewTabClick = useClickBind("photo.newTab", (photo: ServicePhoto) => {
    const src = photoSrc(photo);
    if (src) window.open(src, "_blank");
  });
  const handlePhotoDeleteClick = useClickBind("photo.delete", (photo: ServicePhoto) => {
    deleteMutation.mutate(photo);
  });

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Camera size={12} />Photos ({photos.length})
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          data-testid={`button-add-photo-${serviceId}`}
        >
          <Plus size={12} />{uploadMutation.isPending ? "Uploading..." : "Add Photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-20 w-20 rounded-lg" />
          <Skeleton className="h-20 w-20 rounded-lg" />
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary/60 transition-colors"
          data-testid={`button-photo-empty-${serviceId}`}
        >
          <Camera size={20} className="opacity-40" />
          <span className="text-xs">Tap to add photos</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border bg-muted" data-testid={`photo-${photo.id}`}>
              <img
                src={photoSrc(photo)}
                alt={photo.caption || photo.filename}
                className="w-full aspect-square object-cover cursor-pointer"
                loading="lazy"
                title="Click to view · Ctrl+Click to open in new tab · Alt+Click to delete"
                onClick={(e) => {
                  if (handlePhotoNewTabClick(e, photo)) return;
                  if (handlePhotoDeleteClick(e, photo)) return;
                  setLightboxIndex(photos.findIndex(p => p.id === photo.id));
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button onClick={() => setLightboxIndex(photos.findIndex(p => p.id === photo.id))} className="text-white/80 hover:text-white shrink-0" title="View full size">
                  <ZoomIn size={11} />
                </button>
                <button
                  onClick={() => setEditingCaption({ id: photo.id, value: photo.caption ?? "" })}
                  className="text-white/70 hover:text-white flex-1 text-left truncate text-[10px] leading-none px-0.5"
                  title="Edit caption"
                >
                  {photo.caption || "caption"}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(photo)}
                  className="text-white/60 hover:text-red-400 shrink-0"
                  title="Delete photo"
                  data-testid={`button-delete-photo-${photo.id}`}
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-primary/60 transition-colors"
            data-testid={`button-add-more-photos-${serviceId}`}
          >
            <Plus size={16} />
            <span className="text-[10px] mt-0.5">Add</span>
          </button>
        </div>
      )}

      {/* Caption editor */}
      {editingCaption && (
        <div className="mt-2 flex gap-2 items-center">
          <Input
            value={editingCaption.value}
            onChange={e => setEditingCaption(c => c ? { ...c, value: e.target.value } : c)}
            placeholder="Photo caption..."
            className="text-xs h-8 flex-1"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") saveCaptionMutation.mutate({ id: editingCaption.id, caption: editingCaption.value });
              if (e.key === "Escape") setEditingCaption(null);
            }}
          />
          <Button size="sm" className="h-8 px-3 shrink-0" onClick={() => saveCaptionMutation.mutate({ id: editingCaption.id, caption: editingCaption.value })}>Save</Button>
          <Button size="sm" variant="outline" className="h-8 px-3 shrink-0" onClick={() => setEditingCaption(null)}>Cancel</Button>
        </div>
      )}

      {/* Lightbox (Feature D, Batch 2) */}
      <PhotoLightbox
        photos={photos.map(p => ({ id: p.id, src: photoSrc(p), caption: p.caption, filename: p.filename }))}
        startIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onUpdateCaption={(id, caption) => saveCaptionMutation.mutate({ id, caption })}
        onDelete={id => {
          const photo = photos.find(p => p.id === id);
          if (photo) deleteMutation.mutate(photo);
          setLightboxIndex(null);
        }}
      />
    </div>
  );
}
