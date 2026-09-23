import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, X, FileCheck, ChevronRight, Calendar, DollarSign,
  Anchor, User, CheckCircle, Receipt, Check, SlidersHorizontal,
  ChevronDown, ArrowUpDown,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InvoicedJob = {
  id: number;
  description: string;
  status: string;
  date: string;
  dueDate: string | null;
  laborHours: number | null;
  laborRate: number | null;
  cost: number | null;
  depositAmount: number | null;
  paid: number | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  boatMake: string;
  boatModel: string;
  boatYear: number | null;
  boatId: number;
  laborTotal: number;
  partsTotal: number;
  grandTotal: number;
};

type SortKey = "newest" | "oldest" | "total-high" | "total-low" | "customer";
type PaidFilter = "all" | "paid" | "unpaid";

function woNum(id: number) {
  return `WO-${String(id).padStart(4, "0")}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "invoiced") {
    return (
      <Badge className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-0 font-medium">
        <Receipt size={9} className="mr-0.5" />Invoiced
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-600 dark:text-green-400 border-0 font-medium">
      <CheckCircle size={9} className="mr-0.5" />Complete
    </Badge>
  );
}

function activeFilterCount(
  search: string,
  customer: string,
  paidFilter: PaidFilter,
  dateFrom: string,
  dateTo: string,
) {
  let count = 0;
  if (search.trim()) count++;
  if (customer !== "all") count++;
  if (paidFilter !== "all") count++;
  if (dateFrom) count++;
  if (dateTo) count++;
  return count;
}

export default function InvoicesPage() {
  usePageTitle("Invoices");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("all");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [, navigate] = useLocation();

  const { data: invoices = [], isLoading } = useQuery<InvoicedJob[]>({
    queryKey: ["/api/invoices"],
    queryFn: () => apiRequest("GET", "/api/invoices").then(r => r.json()),
    staleTime: Infinity,
  });

  const togglePaid = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      apiRequest("PATCH", `/api/service/${id}`, { paid }).then(r => r.json()),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ["/api/invoices"], exact: false }),
  });

  // Unique customer names for the dropdown
  const customerOptions = useMemo(() => {
    const names = Array.from(new Set(invoices.map(i => i.customerName))).sort();
    return names;
  }, [invoices]);

  // Apply all filters + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = invoices.filter(inv => {
      // Text search
      if (q && !(
        inv.customerName.toLowerCase().includes(q) ||
        woNum(inv.id).toLowerCase().includes(q) ||
        inv.description.toLowerCase().includes(q) ||
        (inv.boatMake + " " + (inv.boatModel ?? "")).toLowerCase().includes(q)
      )) return false;

      // Customer filter
      if (customer !== "all" && inv.customerName !== customer) return false;

      // Paid filter
      if (paidFilter === "paid" && !inv.paid) return false;
      if (paidFilter === "unpaid" && inv.paid) return false;

      // Date range
      if (dateFrom) {
        const invDate = new Date(inv.date);
        const from = new Date(dateFrom + "T00:00:00");
        if (isNaN(invDate.getTime()) || invDate < from) return false;
      }
      if (dateTo) {
        const invDate = new Date(inv.date);
        const to = new Date(dateTo + "T23:59:59");
        if (isNaN(invDate.getTime()) || invDate > to) return false;
      }

      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "newest": return b.id - a.id;
        case "oldest": return a.id - b.id;
        case "total-high": return (b.grandTotal ?? 0) - (a.grandTotal ?? 0);
        case "total-low": return (a.grandTotal ?? 0) - (b.grandTotal ?? 0);
        case "customer": return a.customerName.localeCompare(b.customerName);
        default: return b.id - a.id;
      }
    });

    return result;
  }, [invoices, search, customer, paidFilter, dateFrom, dateTo, sortKey]);

  // Stats based on filtered set
  const filteredRevenue = filtered.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const filteredUnpaid = filtered.filter(i => !i.paid).length;
  const filteredUnpaidAmount = filtered.filter(i => !i.paid).reduce((s, i) => s + (i.grandTotal || 0), 0);

  const filterCount = activeFilterCount(search, customer, paidFilter, dateFrom, dateTo);
  const isFiltered = filterCount > 0;

  function clearAllFilters() {
    setSearch("");
    setCustomer("all");
    setPaidFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="pb-28 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isFiltered
              ? `${filtered.length} of ${invoices.length} records`
              : `${invoices.length} completed ${invoices.length === 1 ? "record" : "records"}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 relative"
          onClick={() => setShowFilters(v => !v)}
          data-testid="button-toggle-filters"
        >
          <SlidersHorizontal size={14} />
          Filters
          {filterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          {/* Row 1: text search + customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Customer, WO#, vessel..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-invoice-search"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="h-9" data-testid="select-customer-filter">
                <User size={13} className="text-muted-foreground shrink-0" />
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customerOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-9"
                data-testid="input-date-from"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-9"
                data-testid="input-date-to"
              />
            </div>
          </div>

          {/* Row 3: paid filter + sort */}
          <div className="grid grid-cols-2 gap-3">
            {/* Paid toggle */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Payment</label>
              <div className="flex rounded-lg border border-border overflow-hidden h-9">
                {(["all", "unpaid", "paid"] as PaidFilter[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPaidFilter(opt)}
                    data-testid={`button-paid-filter-${opt}`}
                    className={`flex-1 text-xs font-medium transition-all capitalize ${
                      paidFilter === opt
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {opt === "all" ? "All" : opt === "unpaid" ? "Unpaid" : "Paid"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Sort by</label>
              <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-9" data-testid="select-sort">
                  <ArrowUpDown size={13} className="text-muted-foreground shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="total-high">Highest total</SelectItem>
                  <SelectItem value="total-low">Lowest total</SelectItem>
                  <SelectItem value="customer">Customer A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear filters */}
          {filterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-primary hover:underline font-medium"
              data-testid="button-clear-all-filters"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Quick search bar when filters panel is collapsed */}
      {!showFilters && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by customer, WO#, or vessel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-invoice-search-quick"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Summary strip — reflects active filters */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              {isFiltered ? "Filtered Revenue" : "Total Revenue"}
            </p>
            <p className="font-bold text-base text-foreground">{formatMoney(filteredRevenue)}</p>
            {isFiltered && (
              <p className="text-[10px] text-muted-foreground">{filtered.length} records</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              {isFiltered ? "Unpaid (filtered)" : "Awaiting Payment"}
            </p>
            <p className="font-bold text-base text-foreground">{filteredUnpaid}</p>
            {filteredUnpaid > 0 && (
              <p className="text-[10px] text-muted-foreground">{formatMoney(filteredUnpaidAmount)} outstanding</p>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <FileCheck size={28} className="opacity-40" />
          </div>
          <p className="font-medium">
            {isFiltered ? "No invoices match your filters" : "No completed work orders yet"}
          </p>
          <p className="text-sm mt-1">
            {isFiltered
              ? <button onClick={clearAllFilters} className="text-primary hover:underline">Clear filters</button>
              : "Work orders marked Complete or Invoiced will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="invoices-list">
          {filtered.map(inv => {
            const boat = [inv.boatYear, inv.boatMake, inv.boatModel].filter(Boolean).join(" ");
            const isPaid = Boolean(inv.paid);

            return (
              <div
                key={inv.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all"
                data-testid={`card-invoice-${inv.id}`}
              >
                {/* Main row — clickable to navigate */}
                <div
                  className="group flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-accent/30 transition-all"
                  onClick={() => navigate(`/jobs/${inv.id}`)}
                >
                  {/* WO Number bubble */}
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">WO</p>
                    <p className="font-mono font-bold text-sm text-primary leading-tight">
                      {String(inv.id).padStart(4, "0")}
                    </p>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{inv.customerName}</p>
                      <StatusBadge status={inv.status} />
                      {isPaid && (
                        <Badge className="text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-600 dark:text-green-400 border-0 font-medium">
                          <Check size={9} className="mr-0.5" />Paid
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{inv.description}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {boat && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Anchor size={10} />{boat}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={10} />{formatDate(inv.date)}
                      </span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                    <p className="font-semibold text-sm">{formatMoney(inv.grandTotal || null)}</p>
                    {inv.depositAmount ? (
                      <p className="text-[10px] text-muted-foreground">Dep: {formatMoney(inv.depositAmount)}</p>
                    ) : null}
                  </div>

                  <ChevronRight size={15} className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>

                {/* Footer bar — paid toggle + breakdown */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border/60 gap-3">
                  {/* Breakdown */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span>Labor: {formatMoney(inv.laborTotal)}</span>
                    <span>Parts: {formatMoney(inv.partsTotal)}</span>
                    <span className="sm:hidden font-semibold text-foreground">{formatMoney(inv.grandTotal || null)}</span>
                  </div>
                  {/* Paid toggle */}
                  <button
                    data-testid={`button-paid-${inv.id}`}
                    onClick={e => {
                      e.stopPropagation();
                      togglePaid.mutate({ id: inv.id, paid: !isPaid });
                    }}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
                      isPaid
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {isPaid ? <Check size={11} /> : <DollarSign size={11} />}
                    {isPaid ? "Paid" : "Mark Paid"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
