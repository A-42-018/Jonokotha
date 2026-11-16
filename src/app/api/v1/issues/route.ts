import { z } from "zod";
import { ApiError, parse, run } from "@/lib/api";
import { assertConstituency, listPublic, PublicFilters, submitIssue } from "@/lib/issues-service";
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
const CreateIssue = CaseInput.extend({ constituencyId: z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid").default("demo-1") }).strict();
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/issues", auth: "required", limit: { user: 5, ip: 20 }, idempotency: "required" }, async (c) => {
    const input = parse(CreateIssue, c.body);
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
