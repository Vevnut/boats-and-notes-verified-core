import { useState, useCallback } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import BoatDetailPage from "@/pages/boat-detail";
import WorkOrdersPage from "@/pages/work-orders";
import WorkOrderDetailPage from "@/pages/work-order-detail";
import SavedJobsPage from "@/pages/saved-jobs";
import ActivityPage from "@/pages/activity";
import PartsCatalogPage from "@/pages/parts-catalog";
import PartsOrdersPage from "@/pages/parts-orders";
import InvoicesPage from "@/pages/invoices";
import WorkOrderPrintPage from "@/pages/work-order-print";
import SchedulePage from "@/pages/schedule";
import SettingsKeybindsPage from "@/pages/settings-keybinds";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import SplashScreen from "@/components/SplashScreen";
import PageTransition from "@/components/PageTransition";
import { KeybindProvider } from "@/lib/keybind-provider";
import KeybindCheatSheet from "@/components/KeybindCheatSheet";
import KeybindHint from "@/components/KeybindHint";

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
      <KeybindProvider>
        <Router hook={useHashLocation}>
          <Layout>
            <PageTransition>
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/customers" component={CustomersPage} />
                <Route path="/customers/:id" component={CustomerDetailPage} />
                <Route path="/boats/:id" component={BoatDetailPage} />
                <Route path="/jobs" component={WorkOrdersPage} />
                <Route path="/jobs/:id" component={WorkOrderDetailPage} />
                <Route path="/jobs/:id/print/:mode" component={WorkOrderPrintPage} />
                <Route path="/saved-jobs" component={SavedJobsPage} />
                <Route path="/activity" component={ActivityPage} />
                <Route path="/parts-catalog" component={PartsCatalogPage} />
                <Route path="/parts-orders" component={PartsOrdersPage} />
                <Route path="/invoices" component={InvoicesPage} />
                <Route path="/schedule" component={SchedulePage} />
                <Route path="/settings/keybinds" component={SettingsKeybindsPage} />
                <Route component={NotFound} />
              </Switch>
            </PageTransition>
          </Layout>
        </Router>
        <KeybindCheatSheet />
        <KeybindHint />
      </KeybindProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
