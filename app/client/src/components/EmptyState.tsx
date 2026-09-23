import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ─── Shared empty state (Feature E, Batch 2) ───────────────────────────────────
// Centered, muted, generous padding. Used across list pages when a fetch
// resolves with zero results.

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 text-muted-foreground" data-testid="empty-state">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 dark:bg-muted/60">
        <Icon size={26} className="opacity-40" />
      </div>
      <p className="font-medium text-foreground/90">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
