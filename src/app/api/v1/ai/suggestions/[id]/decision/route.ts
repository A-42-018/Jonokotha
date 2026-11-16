import { z } from "zod";
import { ApiError, fromDbError, parse, run } from "@/lib/api";

const Body = z.strictObject({
  decision: z.enum(["accept", "edit", "dismiss"]),
  /** Required for "edit": the value the staff member actually wants to use. */
  final_value: z.record(z.string(), z.unknown()).optional(),
});
const DB = { accept: "accepted", edit: "edited", dismiss: "dismissed" } as const;

// POST /api/v1/ai/suggestions/{id}/decision   (masterplan §17: Accept / Edit / Dismiss; nothing applies without a person)
// The database function checks office scope, records who decided and audits it.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/ai/suggestions/[id]/decision">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/ai/suggestions/{id}/decision", auth: "required", limit: { user: 60, ip: 120 }, idempotency: "optional" }, async (c) => {
    if (!z.uuid().safeParse(params.id).success) throw new ApiError("not_found", "Suggestion not found.");
    const b = parse(Body, c.body);
    const { data, error } = await c.sb.rpc("decide_ai_suggestion", { p_id: params.id, p_decision: DB[b.decision], p_final: b.final_value ?? null });
    if (error) {
      const e = fromDbError(error);
      throw e.code === "not_found" ? new ApiError("not_found", "Suggestion not found.") : e;
    }
    const s = data as { id: string; decision: string; decided_at: string; final_value: unknown };
    return { data: { id: s.id, decision: s.decision, decided_at: s.decided_at, final_value: s.final_value } };
  });
}
