import { z } from "zod";
import { parse, run } from "@/lib/api";
import { searchAreas } from "@/lib/geo";

// GET /api/v1/constituencies/search?q=: manual area fallback by name, district or upazila (Bangla or English).
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/constituencies/search", auth: "optional", limit: { ip: 60 } }, async (c) => {
    const { q } = parse(z.object({ q: z.string().trim().max(80).refine((s) => s.length >= 2 || /^[0-9০-৯]$/.test(s), "at least 2 characters (or one digit)") }), Object.fromEntries(c.url.searchParams));
    return { data: await searchAreas(c.sb, q) };
  });
}
