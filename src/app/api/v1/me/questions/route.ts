import { run } from "@/lib/api";
import { myQuestions } from "@/lib/ideas-questions";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/questions", auth: "required", limit: { user: 60, ip: 120 } }, myQuestions); }
