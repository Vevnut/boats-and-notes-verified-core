import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Check } from "lucide-react";

// ─── Full-screen photo lightbox (Feature D, Batch 2) ───────────────────────────
// No third-party library. Keyboard + touch navigation, inline caption editing,
// adjacent-image preloading for smooth swiping.

export type LightboxPhoto = {
  id: number;
  src: string;
  caption?: string | null;
  filename?: string | null;
  createdAt?: string | null;
};

export function PhotoLightbox({
  photos,
  startIndex,
  open,
  onClose,
  onUpdateCaption,
  onDelete,
}: {
  photos: LightboxPhoto[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  onUpdateCaption?: (id: number, caption: string) => void;
  onDelete?: (id: number) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(startIndex);
      setEditing(false);
    }
  }, [open, startIndex]);

  const photo = photos[index];

  const goPrev = useCallback(() => {
    setEditing(false);
    setIndex(i => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setEditing(false);
    setIndex(i => (i + 1) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (editing) {
        if (e.key === "Enter") commitCaption();
        if (e.key === "Escape") setEditing(false);
        return;
      }
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, goPrev, goNext, onClose]);

  // Preload adjacent images for smoother swiping
  useEffect(() => {
    if (!open || photos.length < 2) return;
    const preload = (src: string) => { const img = new Image(); img.src = src; };
    preload(photos[(index + 1) % photos.length].src);
    preload(photos[(index - 1 + photos.length) % photos.length].src);
  }, [open, index, photos]);

  const startEdit = () => {
    setDraft(photo?.caption ?? "");
    setEditing(true);
  };

  const commitCaption = () => {
    if (photo && onUpdateCaption) onUpdateCaption(photo.id, draft);
    setEditing(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current;
    if (Math.abs(delta) > 50) {
      if (delta > 0) goPrev(); else goNext();
    }
    touchStart.current = null;
  };

  if (!open || !photo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="photo-lightbox"
    >
      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/70 text-sm font-medium tabular-nums">
        {index + 1} of {photos.length}
      </div>

      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        onClick={e => { e.stopPropagation(); onClose(); }}
        data-testid="button-lightbox-close"
      >
        <X size={26} />
      </button>

      {/* Prev / Next arrows */}
      {photos.length > 1 && (
        <>
          <button
            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-2"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-2"
            onClick={e => { e.stopPropagation(); goNext(); }}
            data-testid="button-lightbox-next"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      <img
        src={photo.src}
        alt={photo.caption || photo.filename || "Photo"}
        className="max-w-full max-h-[72vh] rounded-lg object-contain select-none"
        onClick={e => e.stopPropagation()}
        data-testid="lightbox-image"
      />

      <div className="mt-4 text-center max-w-sm px-4" onClick={e => e.stopPropagation()}>
        {editing ? (
          <div className="flex items-center gap-2 justify-center">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Add caption..."
              className="text-sm bg-white/10 text-white rounded px-2 py-1 border border-white/20 outline-none min-w-0 flex-1 max-w-[220px]"
              data-testid="input-lightbox-caption"
            />
            <button onClick={commitCaption} className="text-green-400 hover:text-green-300" data-testid="button-lightbox-caption-save">
              <Check size={16} />
            </button>
            <button onClick={() => setEditing(false)} className="text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            className="text-white/85 text-sm hover:text-white transition-colors disabled:cursor-default"
            onClick={onUpdateCaption ? startEdit : undefined}
            disabled={!onUpdateCaption}
            data-testid="button-lightbox-caption-edit"
          >
            {photo.caption || (onUpdateCaption ? <span className="text-white/40 italic text-xs">tap to add caption</span> : null)}
          </button>
        )}

        {photo.createdAt && (
          <p className="text-white/40 text-xs mt-1.5">{new Date(photo.createdAt).toLocaleString()}</p>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(photo.id)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-400 transition-colors"
            data-testid="button-lightbox-delete"
          >
            <Trash2 size={12} />Delete photo
          </button>
        )}
      </div>
    </div>
  );
}
