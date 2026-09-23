import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, Package, ShoppingCart,
  Users, Activity, Moon, Sun, Download, Menu, X, Search,
  ChevronRight, Wrench, FileText, Settings, Bell, Receipt, Calendar, Cog,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import GlobalSearchDialog from "@/components/GlobalSearch";
import { useKeybind } from "@/lib/keybind-provider";
import SaveStatus from "./SaveStatus";

// ─── Nav structure ────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Service",
    items: [
      { href: "/jobs", label: "Work Orders", icon: ClipboardList },
      { href: "/schedule", label: "Schedule", icon: Calendar },
      { href: "/saved-jobs", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Parts",
    items: [
      { href: "/parts-catalog", label: "Catalog", icon: Package },
      { href: "/parts-orders", label: "Orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/invoices", label: "Invoices", icon: Receipt },
      { href: "/activity", label: "Activity Log", icon: Activity },
    ],
  },
  {
    label: "Preferences",
    items: [
      { href: "/settings/keybinds", label: "Settings", icon: Cog },
    ],
  },
];

// Mobile bottom bar (5 most important)
const MOBILE_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/jobs", label: "Work Orders", icon: ClipboardList },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
];

// NOTE: "Parts" was demoted from the mobile bottom bar (5-slot limit) to make
// room for "Schedule". Parts remains reachable via the desktop sidebar and
// via global search. Reasonable choice per brief §Feature E ("Parts is a good
// candidate to demote").

// ─── Global search trigger button (opens shared CommandDialog) ─────────────────
function GlobalSearchButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      onClick={onOpen}
      className={className ?? "w-full h-8 flex items-center gap-2 pl-2.5 pr-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 text-sm text-muted-foreground hover:text-sidebar-foreground transition-colors"}
      aria-label="Open global search"
      data-testid="button-global-search"
    >
      <Search size={13} className="shrink-0" />
      <span className="truncate">Search customers, boats, WOs...</span>
      <kbd className="ml-auto hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground/70 shrink-0">
        <span className="px-1 py-0.5 rounded border border-sidebar-border bg-sidebar">⌘K</span>
      </kbd>
    </button>
  );
}

// ─── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };
  return (
    <button onClick={toggle} aria-label="Toggle theme"
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
      data-testid="button-theme-toggle">
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

// ─── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ href, label, icon: Icon, active, badge, onClick }: {
  href: string; label: string; icon: any; active: boolean; badge?: number; onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors group relative ${
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
          active ? "bg-white/20 text-white" : "bg-destructive/15 text-destructive"
        }`}>{badge > 99 ? "99+" : badge}</span>
      )}
    </Link>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ onClose, onOpenSearch }: { onClose?: () => void; onOpenSearch: () => void }) {
  const [location] = useLocation();

  // Get WO counts for badge
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    queryFn: () => apiRequest("GET", "/api/jobs").then(r => r.json()),
  });
  const openCount = jobs.filter((j: any) => j.status === "open").length;

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/" onClick={onClose} className="flex items-center gap-2.5">
          <img src="./icon-192.png" alt="logo" className="w-7 h-7 rounded-lg shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-sidebar-foreground tracking-tight">Bradley's Boat Care</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Marine DMS</p>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-sidebar-border">
        <GlobalSearchButton onOpen={onOpenSearch} />
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.href === "/" ? location === "/" : location.startsWith(item.href)}
                  badge={item.href === "/jobs" ? openCount : undefined}
                  onClick={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border flex items-center gap-1">
        <button
          onClick={async () => { const response = await apiRequest("GET", "/api/export/csv"); const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = "boats-and-notes.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          title="Export all data"
        >
          <Download size={13} />Export
        </button>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

// ─── Main Layout ───────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  // Global search — now flows through the keybind registry (Batch 2.5) so users
  // can rebind it. Replaces Batch 1's hardcoded "/" + "Cmd/Ctrl+K" listener.
  useKeybind("search.open", () => setSearchOpen(true), []);
  useKeybind("search.open.mod", () => setSearchOpen(true), []);

  // Global navigation bindings (g h / g s / g w / g c / g p / g a / g t / g ,)
  useKeybind("nav.home", () => setLocation("/"), [setLocation]);
  useKeybind("nav.schedule", () => setLocation("/schedule"), [setLocation]);
  useKeybind("nav.workOrders", () => setLocation("/jobs"), [setLocation]);
  useKeybind("nav.customers", () => setLocation("/customers"), [setLocation]);
  useKeybind("nav.parts", () => setLocation("/parts-catalog"), [setLocation]);
  useKeybind("nav.activity", () => setLocation("/activity"), [setLocation]);
  useKeybind("nav.templates", () => setLocation("/saved-jobs"), [setLocation]);
  useKeybind("nav.settings", () => setLocation("/settings/keybinds"), [setLocation]);

  // Global "new" bindings. No dedicated /new routes exist for these entities yet,
  // so we navigate to the list page with a ?new=1 query flag (read via location.hash
  // since routing is hash-based) — the target page opens its existing "Add" dialog.
  // TODO: if dedicated /customers/new or /jobs/new routes are added later, switch to those.
  useKeybind("new.workOrder", () => setLocation("/jobs?new=1"), [setLocation]);
  useKeybind("new.customer", () => setLocation("/customers?new=1"), [setLocation]);
  useKeybind("new.schedule", () => setLocation("/schedule?new=1"), [setLocation]);

  // Close global search on Escape. Other dialogs/modals (Radix Dialog, the photo
  // lightbox) already handle their own Escape internally — we only own the search
  // dialog here to avoid double-handling / stealing Esc from a focused modal.
  useKeybind("dialog.close", () => { if (searchOpen) setSearchOpen(false); }, [searchOpen]);

  // Print pages render without the sidebar shell
  if (location.includes("/print/")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* ── Desktop Sidebar (fixed left) ── */}
      <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-40">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      </aside>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
          <span className="font-semibold text-sm text-sidebar-foreground">Menu</span>
          <button onClick={() => setDrawerOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar onClose={() => setDrawerOpen(false)} onOpenSearch={() => { setDrawerOpen(false); setSearchOpen(true); }} />
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col lg:ml-52 xl:ml-56 min-w-0">
        <SaveStatus />
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-sm border-b border-border h-12 flex items-center px-3 gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <img src="./icon-192.png" alt="logo" className="w-6 h-6 rounded" />
            <span className="font-semibold text-sm">Bradley's Boat Care</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Open global search"
              data-testid="button-global-search-mobile"
            >
              <Search size={17} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
