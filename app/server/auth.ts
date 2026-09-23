import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { RequestHandler } from "express";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OWNER_ID } from "./config.js";
const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { transport: WebSocket as any },
});
export const authenticate: RequestHandler = async (req, res, next) => {
  const header = req.get("Authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in to open your records." });
  try {
    const { data, error } = await auth.auth.getUser(header.slice(7));
    if (error || !data.user) return res.status(401).json({ error: "Your sign-in expired. Sign in again; your saved records are unchanged." });
    if (data.user.id !== OWNER_ID) return res.status(403).json({ error: "This account does not own this app." });
    res.locals.owner = data.user.id;
    next();
  } catch {
    res.status(503).json({ error: "Sign-in service is temporarily unavailable. Please try again." });
  }
};
