import { cn } from "@/lib/utils";

// ─── Shared loading skeleton primitives (Feature E, Batch 2) ───────────────────
// Thin wrapper around the base animate-pulse block, plus a couple of common
// composed shapes (list rows, cards) so page sweeps stay one-liners.

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted dark:bg-muted/60", className)} />;
}

export function SkeletonList({ rows = 3, rowClassName }: { rows?: number; rowClassName?: string }) {
  return (
    <div className="space-y-3" data-testid="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowClassName ?? "h-16 rounded-xl"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn("h-40 rounded-xl", className)} />;
}
