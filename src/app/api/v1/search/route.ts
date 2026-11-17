import { z } from "zod";
import { fromDbError, parse, run } from "@/lib/api";
import { normalizeDigits } from "@/lib/digits";

// GET ?q=&constituency=&limit=: search PUBLIC issues and ideas. Bangla and Banglish match each other ("rasta bhanga" finds "রাস্তা ভাঙা"); Bangla digits work.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/search", auth: "optional", limit: { ip: 60 } }, async (c) => {
    const q = parse(z.object({ q: z.string().trim().min(2, "at least 2 characters").max(100), constituency: z.string().max(60).regex(/^[a-z0-9-]+$/).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), Object.fromEntries(c.url.searchParams));
    const { data, error } = await c.sb.rpc("search_public", { p_q: normalizeDigits(q.q), p_constituency: q.constituency ?? null, p_limit: q.limit });
    if (error) throw fromDbError(error);
    return { data: data ?? [], page: { next_cursor: null, limit: q.limit } };
  });
}
