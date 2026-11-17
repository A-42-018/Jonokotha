import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { decodeCursor, PageQuery, toPage } from "./pagination";
import { redactPii } from "./pii";
import { checkRef } from "./ideas-questions";

const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const text = (min: number, max: number) => z.string().trim().min(min, `at least ${min} characters`).max(max, `at most ${max} characters`);
const day = z.iso.date();

// Representatives -------------------------------------------------------------------------------------------------------
type RepRow = { id: string; full_name: string; full_name_bn: string | null; party_name_bn: string | null; photo_path: string | null; role_note: string | null; office_title: string | null; party_name: string | null; official_contact: string | null; source_url: string | null; verified_at: string | null; is_demo: boolean;
  representative_constituencies: { valid_from: string; valid_to: string | null; constituencies: { key: string; name_bn: string; name_en: string } | null }[];
  representative_fields?: { field: string; value: string; source_url: string; source_checked_at: string }[] };
const REP_SEL = "id,full_name,full_name_bn,party_name_bn,photo_path,role_note,office_title,party_name,official_contact,source_url,verified_at,is_demo,representative_constituencies(valid_from,valid_to,constituencies(key,name_bn,name_en))";
const toRep = (r: RepRow) => ({
  id: r.id, full_name: r.full_name, full_name_bn: r.full_name_bn, party_name_bn: r.party_name_bn, photo_path: r.photo_path, role_note: r.role_note, office_title: r.office_title, party_name: r.party_name, official_contact: r.official_contact, source_url: r.source_url, verified_at: r.verified_at, is_sample: r.is_demo,
  constituencies: r.representative_constituencies.filter((m) => m.constituencies).map((m) => ({ ...m.constituencies!, valid_from: m.valid_from, valid_to: m.valid_to })),
  ...(r.representative_fields ? { fields: r.representative_fields.map((f) => ({ field: f.field, value: f.value, source_url: f.source_url, checked_at: f.source_checked_at })) } : {}),
});

/** Directory of VERIFIED representatives only (RLS hides the rest). */
export async function listRepresentatives(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), Object.fromEntries(c.url.searchParams));
  let sel = c.sb.from("representatives").select(q.constituency ? REP_SEL.replace("representative_constituencies(", "representative_constituencies!inner(").replace("constituencies(key", "constituencies!inner(key") : REP_SEL)
    .eq("verification_status", "verified").order("full_name").limit(q.limit);
  if (q.constituency) sel = sel.eq("representative_constituencies.constituencies.key", q.constituency);
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  return { data: ((data ?? []) as unknown as RepRow[]).map(toRep), page: { next_cursor: null, limit: q.limit } };
}

export async function getRepresentative(c: Ctx): Promise<Result> {
  const id = c.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError("not_found", "Representative not found.");
  const { data, error } = await c.sb.from("representatives").select(`${REP_SEL},representative_fields(field,value,source_url,source_checked_at)`).eq("id", id).eq("verification_status", "verified").maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError("not_found", "Representative not found.");
  const rep = toRep(data as unknown as RepRow);
  const keys = rep.constituencies.map((k) => k.key);
  const [ann, proj] = await Promise.all([
    c.sb.from("public_announcements").select("ref,constituency_key,title,body,published_at").in("constituency_key", keys).order("published_at", { ascending: false }).limit(10),
    c.sb.from("public_projects").select("ref,constituency_key,title,status,expected_end_date,updated_at").in("constituency_key", keys).order("updated_at", { ascending: false }).limit(10),
  ]);
  return { data: { ...rep, announcements: ann.data ?? [], projects: proj.data ?? [] } };
}

export async function responsiveness(c: Ctx): Promise<Result> {
  const key = KEY.safeParse(c.params.key);
  if (!key.success) throw new ApiError("not_found", "Area not found.");
  const q = parse(z.object({ from: day.optional(), to: day.optional() }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "constituency_responsiveness", { p_key: key.data, p_from: q.from ?? null, p_to: q.to ?? null }) };
}

// Announcements -----------------------------------------------------------------------------------------------------------
export async function listAnnouncements(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const { limit, cursor } = parse(PageQuery, q); const f = parse(z.object({ constituency: KEY.optional() }), q);
  let sel = c.sb.from("public_announcements").select("ref,constituency_key,title,body,published_at,is_demo").order("published_at", { ascending: false }).order("ref", { ascending: false }).limit(limit + 1);
  if (f.constituency) sel = sel.eq("constituency_key", f.constituency);
  if (cursor) { const k = decodeCursor(cursor); sel = sel.or(`published_at.lt.${k.createdAt},and(published_at.eq.${k.createdAt},ref.lt.${k.ref})`); }
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  const rows = (data ?? []).map((r) => ({ ...r, created_at: r.published_at as string }));
  const { items, page } = toPage(rows, limit);
  return { data: items.map((r) => { const { created_at, is_demo, ...rest } = r; void created_at; return { ...rest, is_sample: is_demo }; }), page };
}

const Announce = z.strictObject({ constituency: KEY, title: text(5, 150), body: text(10, 3000), publish: z.boolean().default(true) });
export async function saveAnnouncement(c: Ctx): Promise<Result> {
  const b = parse(Announce, c.body);
  return { status: 201, data: await rpc(c.sb, "save_announcement", { p_constituency: b.constituency, p_title: redactPii(b.title).text, p_body: redactPii(b.body).text, p_publish: b.publish }) };
}
export const withdrawAnnouncement = async (c: Ctx): Promise<Result> => ({ data: await rpc(c.sb, "set_announcement_status", { p_ref: checkRef(c.params.ref), p_status: "withdrawn" }) });
export async function publishAnnouncement(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "set_announcement_status", { p_ref: checkRef(c.params.ref), p_status: "published" }) }; }

// Projects ------------------------------------------------------------------------------------------------------------------
const PStatus = z.enum(["planned", "in_progress", "completed", "paused", "cancelled"]);
export async function listProjects(c: Ctx): Promise<Result> {
  const q = Object.fromEntries(c.url.searchParams);
  const f = parse(z.object({ constituency: KEY.optional(), status: PStatus.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }), q);
  let sel = c.sb.from("public_projects").select("ref,constituency_key,title,description,status,budget_text,start_date,expected_end_date,source_url,source_checked_at,is_demo,updated_at,budget_source,budget_verified_at,procurement_ref,contractor_name,delay_explanation").order("updated_at", { ascending: false }).limit(f.limit);
  if (f.constituency) sel = sel.eq("constituency_key", f.constituency);
  if (f.status) sel = sel.eq("status", f.status);
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo })), page: { next_cursor: null, limit: f.limit } };
}
export async function getProject(c: Ctx): Promise<Result> {
  const ref = checkRef(c.params.ref);
  const { data } = await c.sb.from("public_projects").select("ref,constituency_key,title,description,status,budget_text,start_date,expected_end_date,source_url,source_checked_at,is_demo,updated_at,budget_source,budget_verified_at,procurement_ref,contractor_name,delay_explanation").eq("ref", ref).maybeSingle();
  if (!data) throw new ApiError("not_found", "Project not found.");
  const { data: ms } = await c.sb.from("public_project_milestones").select("id,title,due_date,status,note,completed_at").eq("project_ref", ref).order("due_date", { ascending: true, nullsFirst: false });
  const { is_demo, ...rest } = data;
  return { data: { ...rest, is_sample: is_demo, milestones: ms ?? [] } };
}
const NewProject = z.strictObject({ constituency: KEY, title: text(5, 150), description: z.string().trim().max(3000).optional(), status: PStatus.default("planned"),
  budget_text: z.string().trim().max(200).optional(), start_date: day.optional(), expected_end_date: day.optional(), source_url: z.url({ protocol: /^https?$/ }).max(500).optional(), source_checked_at: day.optional() });
export async function createProject(c: Ctx): Promise<Result> {
  const b = parse(NewProject, c.body);
  return { status: 201, data: await rpc(c.sb, "create_project", { p_constituency: b.constituency, p_title: redactPii(b.title).text, p_description: b.description ? redactPii(b.description).text : null, p_status: b.status,
    p_budget: b.budget_text ?? null, p_start: b.start_date ?? null, p_end: b.expected_end_date ?? null, p_source: b.source_url ?? null, p_checked: b.source_checked_at ?? null }) };
}
export async function updateProject(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: PStatus.optional(), expected_end_date: day.optional(), delay_explanation: z.string().trim().min(10, "at least 10 characters").max(500).optional() }), c.body);
  return { data: await rpc(c.sb, "update_project", { p_ref: checkRef(c.params.ref), p_status: b.status ?? null, p_end: b.expected_end_date ?? null, p_delay: b.delay_explanation ? redactPii(b.delay_explanation).text : null }) };
}
export async function addMilestone(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ title: text(3, 150), due_date: day.optional() }), c.body);
  return { status: 201, data: await rpc(c.sb, "add_milestone", { p_ref: checkRef(c.params.ref), p_title: redactPii(b.title).text, p_due: b.due_date ?? null }) };
}
export async function updateMilestone(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ status: z.enum(["pending", "done", "delayed"]), note: z.string().trim().max(500).optional() }), c.body);
  if (!/^[0-9a-f-]{36}$/i.test(c.params.id)) throw new ApiError("not_found", "Milestone not found.");
  return { data: await rpc(c.sb, "update_milestone", { p_ref: checkRef(c.params.ref), p_milestone: c.params.id, p_status: b.status, p_note: b.note ? redactPii(b.note).text : null }) };
}
