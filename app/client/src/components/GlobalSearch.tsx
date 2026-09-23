import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Users, Anchor, ClipboardList, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { testPreferences } from "@/lib/test-preferences";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";

const RECENTS_KEY = "boatsandnotes:recentSearches";
const MAX_RECENTS = 5;

type RecentEntry = { type: "customer" | "boat" | "workOrder"; id: number; label: string; subtitle?: string };

function readRecents(): RecentEntry[] {
  try {
    const raw = testPreferences.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry: RecentEntry) {
  try {
    const existing = readRecents().filter(r => !(r.type === entry.type && r.id === entry.id));
    const next = [entry, ...existing].slice(0, MAX_RECENTS);
    testPreferences.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — ignore silently
  }
}

interface SearchResults {
  customers: any[];
  boats: any[];
  workOrders: any[];
}

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [, navigate] = useLocation();
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  // Debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setRawQuery("");
      setDebouncedQuery("");
      setRecents(readRecents());
    }
  }, [open]);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: () => apiRequest("GET", `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`).then(r => r.json()),
    enabled: open && debouncedQuery.length > 0,
  });

  const results: SearchResults = data ?? { customers: [], boats: [], workOrders: [] };
  const hasQuery = debouncedQuery.length > 0;
  const hasResults = results.customers.length > 0 || results.boats.length > 0 || results.workOrders.length > 0;

  const go = useCallback((entry: RecentEntry) => {
    pushRecent(entry);
    onOpenChange(false);
    if (entry.type === "customer") navigate(`/customers/${entry.id}`);
    else if (entry.type === "boat") navigate(`/boats/${entry.id}`);
    else navigate(`/jobs/${entry.id}`);
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, boats, work orders..."
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      <CommandList>
        {!hasQuery && (
          recents.length > 0 ? (
            <CommandGroup heading="Recent">
              {recents.map(r => (
                <CommandItem
                  key={`recent-${r.type}-${r.id}`}
                  value={`recent-${r.type}-${r.id}-${r.label}`}
                  onSelect={() => go(r)}
                >
                  {r.type === "customer" && <Users size={14} className="text-muted-foreground shrink-0" />}
                  {r.type === "boat" && <Anchor size={14} className="text-muted-foreground shrink-0" />}
                  {r.type === "workOrder" && <ClipboardList size={14} className="text-muted-foreground shrink-0" />}
                  <span className="truncate">{r.label}</span>
                  {r.subtitle && <span className="ml-auto text-xs text-muted-foreground shrink-0">{r.subtitle}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-1 py-2 text-muted-foreground">
                <Clock size={18} className="opacity-50" />
                <span className="text-xs">Type to search customers, boats, or work orders</span>
              </div>
            </CommandEmpty>
          )
        )}

        {hasQuery && !isFetching && !hasResults && (
          <CommandEmpty>No results for "{debouncedQuery}"</CommandEmpty>
        )}

        {hasQuery && results.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {results.customers.map((c: any) => (
              <CommandItem
                key={`customer-${c.id}`}
                value={`customer-${c.id}-${c.name}`}
                onSelect={() => go({ type: "customer", id: c.id, label: c.name, subtitle: c.phone ?? undefined })}
              >
                <Users size={14} className="text-muted-foreground shrink-0" />
                <span className="truncate">{c.name}</span>
                {c.phone && <span className="ml-auto text-xs text-muted-foreground shrink-0">{c.phone}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && results.boats.length > 0 && (
          <CommandGroup heading="Boats">
            {results.boats.map((b: any) => {
              const label = [b.year, b.make, b.model].filter(Boolean).join(" ") || b.make;
              return (
                <CommandItem
                  key={`boat-${b.id}`}
                  value={`boat-${b.id}-${label}`}
                  onSelect={() => go({ type: "boat", id: b.id, label, subtitle: b.customerName ?? undefined })}
                >
                  <Anchor size={14} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{label}</span>
                  {b.customerName && <span className="ml-auto text-xs text-muted-foreground shrink-0">{b.customerName}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {hasQuery && results.workOrders.length > 0 && (
          <CommandGroup heading="Work Orders">
            {results.workOrders.map((w: any) => {
              const woNum = `WO-${String(w.id).padStart(4, "0")}`;
              return (
                <CommandItem
                  key={`wo-${w.id}`}
                  value={`wo-${w.id}-${woNum}-${w.customerName ?? ""}`}
                  onSelect={() => go({ type: "workOrder", id: w.id, label: woNum, subtitle: w.customerName ?? undefined })}
                >
                  <ClipboardList size={14} className="text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{woNum}</span>
                  <span className="truncate">{w.customerName ?? w.description}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{w.status}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
