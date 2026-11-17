import { run } from "@/lib/api";
import { listSurveys } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/surveys", auth: "optional", limit: { ip: 120 }, feature: "surveys" }, listSurveys); }
