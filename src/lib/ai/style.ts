import type { SupabaseClient } from "@supabase/supabase-js";

/** The person's language preferences for agent output (B5.11). A read failure means defaults: never block an agent on a preference lookup. */
export async function styleFor(sb: SupabaseClient, userId: string): Promise<{ simpleLanguage: boolean; voiceFirst: boolean }> {
  const { data } = await sb.from("user_preferences").select("simple_language_mode,voice_first").eq("user_id", userId).maybeSingle();
  return { simpleLanguage: data?.simple_language_mode ?? false, voiceFirst: data?.voice_first ?? false };
}
