import { run } from "@/lib/api";
import { listRtiDrafts, createRtiDraft } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/rti/drafts", auth: "required", limit: { user: 30, ip: 60 }, feature: "rti_helper" }, listRtiDrafts); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/rti/drafts", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "rti_helper" }, createRtiDraft); }
