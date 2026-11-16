import { ApiError, parse, run } from "@/lib/api";
import { listOffice, OfficeFilters } from "@/lib/issues-service";
import { PageQuery } from "@/lib/pagination";

// GET /api/v1/office/issues: the working queue. Row-level security limits it to the caller's offices.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/office/issues", auth: "required", limit: { user: 120, ip: 240 } }, async (c) => {
    if (!c.actor || (c.actor.role !== "admin" && c.actor.offices.length === 0)) throw new ApiError("forbidden", "Office access is required.");
    const q = Object.fromEntries(c.url.searchParams);
    const { limit, cursor } = parse(PageQuery, q);
    return listOffice(c.sb, c.user!.id, parse(OfficeFilters, q), limit, cursor);
  });
}
