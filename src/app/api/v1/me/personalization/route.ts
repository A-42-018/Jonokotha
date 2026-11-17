import { z } from "zod";
import { fromDbError, parse, rpc, run } from "@/lib/api";

// GET: everything personalization uses (switches and follows), so the person can see it. PATCH {simple_language_mode?, voice_first?, numeral_style?, personalization_enabled?, announcement_opt_in?}.
// DELETE: reset (removes all follows and returns every switch to its default). Switching personalization off gives plain newest-first feeds.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/me/personalization", auth: "required", limit: { user: 30, ip: 60 } }, async (c) => {
    const { data: p, error } = await c.sb.from("user_preferences").select("simple_language_mode,voice_first,numeral_style,personalization_enabled,announcement_opt_in").eq("user_id", c.user!.id).maybeSingle();
    if (error) throw fromDbError(error);
    const { data: f } = await c.sb.from("follows").select("target_type").eq("user_id", c.user!.id);
    const follows: Record<string, number> = {}; for (const r of f ?? []) follows[r.target_type] = (follows[r.target_type] ?? 0) + 1;
    return { data: { simple_language_mode: p?.simple_language_mode ?? false, voice_first: p?.voice_first ?? false, numeral_style: p?.numeral_style ?? "bn", personalization_enabled: p?.personalization_enabled ?? true, announcement_opt_in: p?.announcement_opt_in ?? false,
      uses: { follows, note: "Only what you follow and these switches. Nothing is inferred about you." } } };
  });
}
export async function PATCH(req: Request) {
  return run(req, {}, { name: "PATCH /api/v1/me/personalization", auth: "required", limit: { user: 20, ip: 60 } }, async (c) => {
    const b = parse(z.strictObject({ simple_language_mode: z.boolean().optional(), voice_first: z.boolean().optional(), numeral_style: z.enum(["bn", "en"]).optional(), personalization_enabled: z.boolean().optional(), announcement_opt_in: z.boolean().optional() }), c.body);
    return { data: await rpc(c.sb, "update_my_personalization", { p_simple: b.simple_language_mode ?? null, p_voice: b.voice_first ?? null, p_numeral: b.numeral_style ?? null, p_enabled: b.personalization_enabled ?? null, p_announcements: b.announcement_opt_in ?? null }) };
  });
}
export async function DELETE(req: Request) {
  return run(req, {}, { name: "DELETE /api/v1/me/personalization", auth: "required", limit: { user: 5, ip: 20 } }, async (c) => ({ data: await rpc(c.sb, "reset_my_personalization") }));
}
