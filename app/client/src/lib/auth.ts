import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
let accessToken = "";
export const token = () => accessToken;
export async function authClient() {
  if (client) return client;
  const response = await fetch(`${import.meta.env.VITE_API_BASE || ""}/api/config`);
  if (!response.ok) throw new Error("App setup could not be loaded. Please retry.");
  const config = await response.json();
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });
  client.auth.onAuthStateChange((_event, session) => { accessToken = session?.access_token ?? ""; });
  return client;
}

let recoveryAttempt: Promise<{ email: string } | null> | undefined;
export function recoverSessionFromUrl() {
  if (recoveryAttempt) return recoveryAttempt;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("type") !== "recovery" && !params.has("error")) return Promise.resolve(null);
  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  // Remove recovery credentials from the address bar before any further work.
  // They are never persisted to browser storage or sent to the app backend.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  recoveryAttempt = (async () => {
    if (params.has("error") || !access || !refresh)
      throw new Error("This recovery link is invalid or expired. Request a new email below.");
    const client = await authClient();
    const { error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error("This recovery link could not be verified. Request a new email below.");
    const result = await client.auth.getUser();
    if (result.error || !result.data.user)
      throw new Error("This recovery link could not be verified. Request a new email below.");
    return { email: result.data.user.email || "" };
  })();
  return recoveryAttempt;
}
