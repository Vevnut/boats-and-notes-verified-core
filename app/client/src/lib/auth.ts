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
