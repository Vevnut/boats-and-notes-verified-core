import { useState, type ReactNode } from "react";
import { Anchor, Download, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadTestPreferences } from "@/lib/test-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  if (!ready) return <main className="min-h-screen bg-background flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm space-y-5" aria-labelledby="login-heading">
      <Anchor size={30} className="text-primary" aria-hidden="true" />
      <div><h1 id="login-heading" className="text-xl font-bold">Boats and Notes</h1>
        <p className="text-sm text-muted-foreground mt-2">Sign in to open your permanent records.</p></div>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const client = await authClient();
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // Validate ownership and actual database access before showing records.
          await apiRequest("GET", "/api/customers");
          await loadTestPreferences();
          setPassword(""); setReady(true);
        } catch (e: any) { setError(e.message || "Sign-in failed. Please retry."); }
        finally { setBusy(false); }
      }}>
        <div><label htmlFor="login-email" className="text-sm font-medium">Email</label>
          <Input id="login-email" data-testid="input-login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
        <div><label htmlFor="login-password" className="text-sm font-medium">Password</label>
          <Input id="login-password" data-testid="input-login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" type="submit" disabled={busy} data-testid="button-sign-in">{busy ? "Opening your records…" : "Sign in"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">Use the existing app owner's Supabase sign-in, not your Vercel password. This version asks you to sign in again after a full page reload. Saved records and backed-up drafts remain in the database.</p>
    </section>
  </main>;
  return <>
    <div className="print:hidden lg:ml-52 xl:ml-56 flex flex-wrap justify-end items-center gap-2 px-3 py-2 border-b bg-card text-xs">
      <span className="mr-auto text-muted-foreground">Permanent database</span>
      <Button size="sm" variant="ghost" data-testid="button-download-backup" disabled={backupBusy} onClick={async () => {
        setBackupBusy(true); setError("");
        try {
          const blob = await (await apiRequest("GET", "/api/backup")).blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = `boats-and-notes-backup-${new Date().toISOString().slice(0,10)}.json`;
          a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (e: any) { setError(e.message); }
        finally { setBackupBusy(false); }
      }}><Download size={14} className="mr-1" />{backupBusy ? "Preparing…" : "Download backup"}</Button>
      <Button size="sm" variant="ghost" data-testid="button-sign-out" onClick={async () => {
        if (!window.confirm("Sign out? Save or download any unfinished changes first.")) return;
        await (await authClient()).auth.signOut({ scope: "local" });
        queryClient.clear(); setReady(false);
      }}><LogOut size={14} className="mr-1" />Sign out</Button>
      {error && <p role="alert" className="w-full text-destructive">{error}</p>}
    </div>
    {children}
  </>;
}
