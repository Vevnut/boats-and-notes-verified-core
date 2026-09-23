import { useEffect, useState, type ReactNode } from "react";
import { Anchor, Download, LogOut } from "lucide-react";
import { authClient, recoverSessionFromUrl } from "@/lib/auth";
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
  const [mode, setMode] = useState<"signin" | "request" | "reset">("signin");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return params.get("type") === "recovery" || params.has("error");
  });
  useEffect(() => {
    let active = true;
    recoverSessionFromUrl().then(session => {
      if (active && session) { setEmail(session.email); setMode("reset"); }
    }).catch(e => {
      if (active) { setError(e.message); setMode("request"); }
    }).finally(() => { if (active) setRecoveryLoading(false); });
    return () => { active = false; };
  }, []);
  if (!ready) return <main className="min-h-screen bg-background flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm space-y-5" aria-labelledby="login-heading">
      <Anchor size={30} className="text-primary" aria-hidden="true" />
      <div><h1 id="login-heading" className="text-xl font-bold">Boats and Notes</h1>
        <p className="text-sm text-muted-foreground mt-2">{recoveryLoading ? "Checking your recovery link…" :
          mode === "request" ? "Reset your Boats and Notes app password by email." :
          mode === "reset" ? "Choose a new Boats and Notes app password." :
          "Sign in to open your permanent records."}</p></div>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {!recoveryLoading && <>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError(""); setMessage("");
        try {
          const client = await authClient();
          if (mode === "request") {
            const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/`,
            });
            if (error) throw error;
            setMessage("If this address has an app account, a recovery email has been requested. Check your inbox and spam folder, then open the newest link. Your database password is unchanged.");
            return;
          }
          if (mode === "reset") {
            if (password !== confirmPassword) throw new Error("The two passwords do not match.");
            const { error } = await client.auth.updateUser({ password });
            if (error) throw error;
            await client.auth.signOut({ scope: "local" });
            queryClient.clear();
            setPassword(""); setConfirmPassword(""); setMode("signin");
            setMessage("Your app password was changed. Sign in below with the new password. Your database password is unchanged.");
            return;
          }
          const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw error;
          // Validate ownership and actual database access before showing records.
          try { await apiRequest("GET", "/api/customers"); }
          catch (e: any) { throw new Error(`Your app sign-in was accepted, but records could not be opened: ${e.message}`); }
          await loadTestPreferences();
          setPassword(""); setReady(true);
        } catch (e: any) { setError(e.message || "Sign-in failed. Please retry."); }
        finally { setBusy(false); }
      }}>
        {mode !== "reset" && <div><label htmlFor="login-email" className="text-sm font-medium">Email</label>
          <Input id="login-email" data-testid="input-login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
        }
        {mode === "reset" && <p className="text-sm text-muted-foreground">Updating the app password for {email}. Use at least 12 characters.</p>}
        {mode !== "request" && <div><label htmlFor="login-password" className="text-sm font-medium">{mode === "reset" ? "New app password" : "Password"}</label>
          <Input id="login-password" data-testid="input-login-password" type="password" autoComplete={mode === "reset" ? "new-password" : "current-password"} minLength={mode === "reset" ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>}
        {mode === "reset" && <div><label htmlFor="confirm-password" className="text-sm font-medium">Confirm new app password</label>
          <Input id="confirm-password" data-testid="input-confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={busy} /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" type="submit" disabled={busy} data-testid={mode === "request" ? "button-send-recovery" : mode === "reset" ? "button-set-password" : "button-sign-in"}>
          {busy ? "Please wait…" : mode === "request" ? "Send recovery email" : mode === "reset" ? "Save new app password" : "Sign in"}
        </Button>
      </form>
      {mode === "signin" && <Button type="button" variant="ghost" className="w-full" disabled={busy} data-testid="button-forgot-password" onClick={() => {
        setMode("request"); setError(""); setMessage(""); setPassword("");
      }}>Forgot app password?</Button>}
      {mode === "request" && <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={() => {
        setMode("signin"); setError(""); setMessage("");
      }}>Back to sign in</Button>}
      </>}
      <p className="text-xs text-muted-foreground">Use your Boats and Notes app password, not your database, Supabase website, or Vercel password. Full page reloads require sign-in again; saved records and backed-up drafts remain in the database.</p>
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
