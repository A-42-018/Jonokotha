import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for trusted server jobs only (AI logging, embeddings). Null when the key is not configured. Never import from client code. */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
