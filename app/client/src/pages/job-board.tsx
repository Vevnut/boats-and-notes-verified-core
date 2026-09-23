import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ClipboardList, Clock, DollarSign, ChevronRight, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { NewWOSheet } from "./work-orders";
import type { ServiceRecord } from "@shared/schema";

type OpenJob = ServiceRecord & { boatMake: string; boatModel: string; boatYear: number | null; customerName: string; boatId: number };

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_ORDER = ["open", "complete", "invoiced"];

export default function JobBoardPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showNewWO, setShowNewWO] = useState(false);
  const { data: jobs = [], isLoading } = useQuery<OpenJob[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/service/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status updated" });
    },
  });

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s);
    return acc;
  }, {} as Record<string, OpenJob[]>);

  const NEXT_STATUS: Record<string, string> = { open: "complete", complete: "invoiced" };
  const STATUS_LABELS: Record<string, string> = { open: "Open", complete: "Complete", invoiced: "Invoiced" };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );

  return (
    <div>
      {showNewWO && (
        <NewWOSheet
          onClose={() => setShowNewWO(false)}
          onCreated={(id?: number) => {
            setShowNewWO(false);
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            if (id) navigate(`/boats/${id}`);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Job Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs.length} active {jobs.length === 1 ? "job" : "jobs"}</p>
        </div>
        <Button size="sm" onClick={() => setShowNewWO(true)} data-testid="button-new-wo">
          <Plus size={14} className="mr-1" />New WO
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No open jobs</p>
          <p className="text-sm mt-1">Service records will appear here once added</p>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map(status => {
            const group = grouped[status];
            if (group.length === 0) return null;
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{group.length}</span>
                </div>
                <div className="space-y-2">
                  {group.map(job => (
                    <div key={job.id} className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-start gap-3 hover:border-primary/30 transition-all" data-testid={`job-card-${job.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{job.customerName}</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <p className="text-xs text-muted-foreground">{[job.boatYear, job.boatMake, job.boatModel].filter(Boolean).join(" ")}</p>
                        </div>
                        <p className="text-sm mt-0.5 text-foreground/80">{job.description}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-muted-foreground">{job.date}</span>
                          {job.laborHours != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={10} />{job.laborHours} hrs</span>
                          )}
                          {job.cost != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign size={10} />{job.cost.toFixed(2)}</span>
                          )}
                          {job.paid && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Paid</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {NEXT_STATUS[status] && (
                          <button
                            onClick={() => updateMutation.mutate({ id: job.id, status: NEXT_STATUS[status] })}
                            className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-accent transition-colors"
                            data-testid={`button-advance-job-${job.id}`}
                          >
                            → {STATUS_LABELS[NEXT_STATUS[status]]}
                          </button>
                        )}
                        <Link href={`/boats/${job.boatId}`} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
