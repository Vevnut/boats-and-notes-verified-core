import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, User, Anchor, Wrench, Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  customer: <User size={14} />,
  boat: <Anchor size={14} />,
  service: <Wrench size={14} />,
  part: <Wrench size={14} />,
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <Plus size={12} className="text-green-500" />,
  updated: <Pencil size={12} className="text-blue-500" />,
  deleted: <Trash2 size={12} className="text-red-500" />,
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function ActivityPage() {
  usePageTitle("Activity");
  const { data: activity = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activity"],
    queryFn: () => apiRequest("GET", "/api/activity").then(r => r.json()),
    refetchInterval: 30000,
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Recent Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Last {activity.length} actions</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : activity.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ActivityIcon size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No activity yet</p>
          <p className="text-sm mt-1">Actions you take will appear here</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activity.map(item => (
            <div key={item.id} className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3" data-testid={`activity-${item.id}`}>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
                {ENTITY_ICONS[item.entityType] ?? <ActivityIcon size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {ACTION_ICONS[item.action]}
                  <p className="text-sm">{item.description}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
