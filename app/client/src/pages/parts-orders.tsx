import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, CheckCircle2, Clock, Package } from "lucide-react";
import type { Part } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

type PendingPart = Part & {
  serviceDescription: string;
  boatName: string;
  customerName: string;
  serviceRecordId: number;
};

const STATUS_CONFIG = {
  null: { label: "Not Ordered", color: "bg-muted text-muted-foreground", icon: Clock },
  ordered: { label: "Ordered", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: ShoppingCart },
  received: { label: "Received", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300", icon: CheckCircle2 },
} as const;

export default function PartsOrdersPage() {
  usePageTitle("Parts Orders");
  const { toast } = useToast();

  const { data: pendingParts = [], isLoading } = useQuery<PendingPart[]>({
    queryKey: ["/api/parts-orders"],
    queryFn: () => apiRequest("GET", "/api/parts-orders").then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, orderStatus }: { id: number; orderStatus: string | null }) =>
      apiRequest("PATCH", `/api/parts/${id}`, { orderStatus }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts-orders"] });
      toast({ title: "Status updated" });
    },
  });

  const notOrdered = pendingParts.filter(p => !p.orderStatus);
  const ordered = pendingParts.filter(p => p.orderStatus === "ordered");

  const PartCard = ({ part }: { part: PendingPart }) => {
    const isOrdered = part.orderStatus === "ordered";
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-testid={`card-order-part-${part.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{part.description}</p>
            {part.partNumber && <p className="text-xs text-muted-foreground">#{part.partNumber}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">
              {part.customerName} · {part.boatName}
            </p>
            <p className="text-xs text-muted-foreground italic">{part.serviceDescription}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium">Qty: {part.quantity}</p>
            <p className="text-xs text-muted-foreground">${(part.unitPrice * part.quantity).toFixed(2)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOrdered ? (
            <Button size="sm" variant="outline" className="text-xs h-7"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: part.id, orderStatus: "ordered" })}
              data-testid={`button-mark-ordered-${part.id}`}>
              <ShoppingCart size={12} className="mr-1" /> Mark Ordered
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="text-xs h-7 border-green-400 text-green-700 hover:bg-green-50 dark:text-green-400"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: part.id, orderStatus: "received" })}
              data-testid={`button-mark-received-${part.id}`}>
              <CheckCircle2 size={12} className="mr-1" /> Mark Received
            </Button>
          )}
          {isOrdered && (
            <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: part.id, orderStatus: null })}
              data-testid={`button-unorder-${part.id}`}>
              Undo
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Parts Orders</h1>
        <p className="text-sm text-muted-foreground">
          {notOrdered.length} to order · {ordered.length} waiting on
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : pendingParts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No parts to order</p>
          <p className="text-sm mt-1">Parts added to service records will show up here until they are received</p>
        </div>
      ) : (
        <>
          {notOrdered.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Clock size={13} /> Need to Order ({notOrdered.length})
              </h2>
              {notOrdered.map(p => <PartCard key={p.id} part={p} />)}
            </div>
          )}

          {ordered.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <ShoppingCart size={13} /> Ordered — Waiting on Delivery ({ordered.length})
              </h2>
              {ordered.map(p => <PartCard key={p.id} part={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
