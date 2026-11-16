import { run } from "@/lib/api";
import { officeQuestions } from "@/lib/ideas-questions";

// GET: questions of the caller's offices (case officers: assigned ones only; RLS decides). ?status=
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/questions", auth: "required", limit: { user: 60, ip: 120 } }, officeQuestions); }
