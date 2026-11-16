import { z } from "zod";
import { ApiError, fromDbError, parse, run } from "@/lib/api";
import { lookupByPoint, Lat, Lng, searchAreas } from "@/lib/geo";

const Q = z.object({
  lat: z.coerce.number().pipe(Lat).optional(), lng: z.coerce.number().pipe(Lng).optional(),
  area: z.string().trim().min(2).max(80).optional(),   // a constituency key, or free text to search
}).refine((q) => (q.lat === undefined) === (q.lng === undefined), { message: "lat and lng go together", path: ["lat"] });

// GET /api/v1/representatives/lookup?lat=&lng= | ?area=: which constituency, and who the verified representatives are.
// No match means the client should ask the citizen to choose the area by hand (never a guess).
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/representatives/lookup", auth: "optional", limit: { ip: 60 } }, async (c) => {
    const q = parse(Q, Object.fromEntries(c.url.searchParams));
    let areas = q.lat !== undefined && q.lng !== undefined ? await lookupByPoint(c.sb, q.lat, q.lng) : q.area ? await searchAreas(c.sb, q.area) : null;
    if (!areas) throw new ApiError("validation_failed", "Send lat and lng, or area.", { area: "required" });
    areas = areas.slice(0, 3);
    const out = [];
    for (const a of areas) {
      const { data, error } = await c.sb.from("representatives")
        .select("id,full_name,office_title,party_name,official_contact,source_url,verified_at,is_demo,representative_constituencies!inner(valid_from,valid_to,constituencies!inner(key))")
        .eq("representative_constituencies.constituencies.key", a.key).eq("verification_status", "verified");
      if (error) throw fromDbError(error);
      const today = new Date().toISOString().slice(0, 10);
      const reps = (data ?? []).filter((r) => (r.representative_constituencies as { valid_to: string | null }[]).some((m) => !m.valid_to || m.valid_to >= today))
        .map((r) => ({ id: r.id, full_name: r.full_name, office_title: r.office_title, party_name: r.party_name, official_contact: r.official_contact, source_url: r.source_url, verified_at: r.verified_at, is_sample: r.is_demo }));
      out.push({ constituency: a, representatives: reps });
    }
    return { data: { matches: out, needs_manual_choice: out.length === 0 } };
  });
}
