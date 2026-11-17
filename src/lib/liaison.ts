import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { redactPii } from "./pii";
import { checkRef } from "./ideas-questions";

// Phase 5 / B5.2 and B5.4: agency liaison actions, and the received / forwarded / officially-registered state of a referral.
// A liaison reads only through liaison_cases() (no reporter, no internal notes) and writes only through the liaison_* functions.
const UUID = z.uuid();
const rid = (c: Ctx) => { const r = UUID.safeParse(c.params.id); if (!r.success) throw new ApiError("not_found", "Not found."); return r.data; };

export async function liaisonCases(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.rpc("liaison_cases");
  if (error) throw fromDbError(error);
  return { data: data ?? [], page: { next_cursor: null, limit: 100 } };
}

const Update = z.strictObject({ note: z.string().trim().min(1).max(1000), public: z.boolean().default(false) });
const Reference = z.strictObject({ external_reference: z.string().trim().max(100).optional(), channel: z.string().trim().max(300).optional() });
const Close = z.strictObject({ evidence: z.string().trim().min(5, "at least 5 characters").max(500), note: z.string().trim().max(500).optional() });

export async function liaisonAction(c: Ctx): Promise<Result> {
  const referral = rid(c);
  switch (c.params.action) {
    case "acknowledge": return { data: await rpc(c.sb, "liaison_acknowledge", { p_referral: referral }) };
    case "updates": { const b = parse(Update, c.body); return { status: 201, data: await rpc(c.sb, "liaison_add_update", { p_referral: referral, p_note: redactPii(b.note).text, p_public: b.public }) }; }
    case "reference": { const b = parse(Reference, c.body); return { data: await rpc(c.sb, "liaison_record_reference", { p_referral: referral, p_external_reference: b.external_reference ?? null, p_channel: b.channel ?? null }) }; }
    case "close": { const b = parse(Close, c.body); return { data: await rpc(c.sb, "liaison_close_task", { p_referral: referral, p_evidence: b.evidence, p_note: b.note ?? null }) }; }
    default: throw new ApiError("not_found", "Unknown action.");
  }
}

/** Office manager: the agency's system registered the case. Needs proof, and an integration an administrator confirmed. */
export async function registerReferral(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ reference: z.string().trim().max(120).optional(), proof: z.string().trim().min(5, "at least 5 characters").max(500) }), c.body);
  return { data: await rpc(c.sb, "register_referral", { p_referral: rid(c), p_reference: b.reference ?? null, p_proof: b.proof }) };
}

export async function setIntegration(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const b = parse(z.strictObject({ agency_id: UUID, kind: z.enum(["api", "email_gateway", "portal"]), status: z.enum(["planned", "confirmed", "retired"]), note: z.string().trim().max(500).optional() }), c.body);
  return { data: await rpc(c.sb, "set_agency_integration", { p_agency: b.agency_id, p_kind: b.kind, p_status: b.status, p_note: b.note ?? null }) };
}

/** Public: what stage each published referral of an issue is at. Never says "registered" without an integration record. */
export async function publicReferrals(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("public_case_referrals").select("agency_name,registration_status,forwarded_at,acknowledged_at,task_status,integration_confirmed").eq("case_ref", checkRef(c.params.ref));
  if (error) throw fromDbError(error);
  return { data: data ?? [] };
}
