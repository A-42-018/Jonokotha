import { z } from "zod";
import { ApiError, parse, run } from "@/lib/api";
import { assertConstituency, listPublic, PublicFilters, submitIssue } from "@/lib/issues-service";
import { Lat, Lng, lookupByPoint } from "@/lib/geo";
import { PageQuery } from "@/lib/pagination";
import { CaseInput } from "@/lib/types";

// GET /api/v1/issues: public list, newest first, cursor pagination. No sign-in needed.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/issues", auth: "optional", limit: { ip: 120 } }, async (c) => {
    const q = Object.fromEntries(c.url.searchParams);
    const { limit, cursor } = parse(PageQuery, q);
    return listPublic(c.sb, parse(PublicFilters, q), limit, cursor);
  });
}

// POST /api/v1/issues: submit a report as the signed-in citizen. Idempotency-Key is required.
const CreateIssue = CaseInput.extend({
  constituencyId: z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid").optional(),
  lat: Lat.optional(), lng: Lng.optional(),
  locationSource: z.enum(["device", "map", "manual_area"]).optional(), locationAccuracyM: z.number().int().min(0).max(100_000).optional(),
}).strict().refine((b) => (b.lat === undefined) === (b.lng === undefined), { message: "lat and lng go together", path: ["lat"] });
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/issues", auth: "required", limit: { user: 5, ip: 20 }, idempotency: "required" }, async (c) => {
    const parsed = parse(CreateIssue, c.body);
    // The area comes from the citizen's choice, else from the coordinates; with neither it is the sample constituency (demo period).
    let constituencyId = parsed.constituencyId;
    if (!constituencyId && parsed.lat !== undefined && parsed.lng !== undefined) {
      const m = await lookupByPoint(c.sb, parsed.lat, parsed.lng);
      if (!m.length) throw new ApiError("validation_failed", "No constituency contains this location. Choose the area by hand.", { constituencyId: "required" });
      constituencyId = m[0].key;
    }
    const input = { ...parsed, constituencyId: constituencyId ?? "demo-1" };
    await assertConstituency(c.sb, input.constituencyId);
    try {
      const ref = await submitIssue(c.sb, c.user!.id, input);
      return { status: 201, data: { ref, status: "submitted" } };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("internal_error", "The report could not be saved.");
    }
  });
}
