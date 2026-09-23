import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, Phone, Mail, ChevronRight, Trash2, Edit2, X, Anchor, Users } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useClickBind } from "@/lib/keybind-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import type { Customer, InsertCustomer } from "@shared/schema";
import { usePageTitle } from "@/hooks/use-page-title";

type CustomerWithCount = Customer & { boatCount: number };

function CustomerForm({ defaultValues, onSubmit, isPending }: {
  defaultValues?: Partial<InsertCustomer>;
  onSubmit: (data: InsertCustomer) => void;
  isPending: boolean;
}) {
  const form = useForm<InsertCustomer>({
    defaultValues: { name: "", phone: "", email: "", address: "", notes: "", ...defaultValues },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" rules={{ required: "Name is required" }}
          render={({ field }) => (
            <FormItem><FormLabel>Full Name *</FormLabel>
              <FormControl><Input placeholder="e.g. John Smith" {...field} data-testid="input-name" /></FormControl>
              <FormMessage /></FormItem>
          )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel>
              <FormControl><Input placeholder="603-555-0100" {...field} value={field.value ?? ""} data-testid="input-phone" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel>
              <FormControl><Input placeholder="john@example.com" {...field} value={field.value ?? ""} data-testid="input-email" /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Address</FormLabel>
            <FormControl><Input placeholder="123 Lake Rd, Conway, NH" {...field} value={field.value ?? ""} data-testid="input-address" /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel>
            <FormControl>
              <textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-[80px]"
                placeholder="Any relevant notes..." {...field} value={field.value ?? ""} data-testid="input-notes" />
            </FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} data-testid="button-submit-customer">
            {isPending ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function CustomersPage() {
  usePageTitle("Customers");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerWithCount | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerWithCount | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Modifier+Click (Batch 2.5 addendum): Ctrl+Click opens customer in a new tab,
  // Alt+Click copies name/phone/email to clipboard.
  const handleCustNewTabClick = useClickBind("cust.card.newTab", (c: CustomerWithCount) => {
    window.open(`${window.location.pathname}#/customers/${c.id}`, "_blank");
  });
  const handleCustQuickCopyClick = useClickBind("cust.card.quickCopy", (c: CustomerWithCount) => {
    const lines = [c.name, c.phone, c.email].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n")).then(() => toast({ title: "Copied to clipboard" }));
  });

  // Batch 2.5 minimal addition: support a ?new=1 URL flag so the global "n c" keybind
  // can deep-link into the Add Customer dialog.
  useEffect(() => {
    if (window.location.hash.includes("new=1")) {
      setAddOpen(true);
      const clean = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: customers = [], isLoading } = useQuery<CustomerWithCount[]>({
    queryKey: ["/api/customers", search],
    queryFn: () => apiRequest("GET", search ? `/api/customers?q=${encodeURIComponent(search)}` : "/api/customers").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCustomer) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/customers"], exact: false }); setAddOpen(false); toast({ title: "Customer added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertCustomer> }) => apiRequest("PATCH", `/api/customers/${id}`, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/customers"], exact: false }); setEditCustomer(null); toast({ title: "Customer updated" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/customers"], exact: false }); toast({ title: "Customer removed" }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} {customers.length === 1 ? "customer" : "customers"}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-customer">
          <Plus size={16} className="mr-1.5" />Add Customer
        </Button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, phone, or email..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
            <X size={14} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Users size={28} className="opacity-40" />
          </div>
          <p className="font-medium">{search ? "No customers match your search" : "No customers yet"}</p>
          <p className="text-sm mt-1">{search ? "Try a different search term" : "Add your first customer to get started"}</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="customers-list">
          {customers.map(c => (
            <div
              key={c.id}
              className="group flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 hover:bg-accent/30 transition-all cursor-pointer"
              onDoubleClick={() => navigate(`/customers/${c.id}`)}
              onClick={(e) => { if (handleCustNewTabClick(e, c)) return; handleCustQuickCopyClick(e, c); }}
              data-testid={`card-customer-${c.id}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center shrink-0 text-sm">
                {c.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  {c.boatCount > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                      <Anchor size={10} />{c.boatCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-start sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5">
                  {c.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><Phone size={11} />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1 text-xs text-muted-foreground truncate"><Mail size={11} />{c.email}</span>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => setEditCustomer(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" data-testid={`button-edit-customer-${c.id}`}><Edit2 size={14} /></button>
                <button onClick={() => setDeleteCustomer(c)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-customer-${c.id}`}><Trash2 size={14} /></button>
              </div>
              <Link href={`/customers/${c.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" data-testid={`link-customer-detail-${c.id}`}><ChevronRight size={16} /></Link>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <CustomerForm onSubmit={data => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteCustomer} onOpenChange={o => !o && setDeleteCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteCustomer?.name}</span>? This will also remove all their boats and service records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteCustomer(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => { if (deleteCustomer) { deleteMutation.mutate(deleteCustomer.id, { onSuccess: () => setDeleteCustomer(null) }); } }}
              data-testid="button-confirm-delete">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editCustomer} onOpenChange={o => !o && setEditCustomer(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          {editCustomer && <CustomerForm defaultValues={editCustomer} onSubmit={data => updateMutation.mutate({ id: editCustomer.id, data })} isPending={updateMutation.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
