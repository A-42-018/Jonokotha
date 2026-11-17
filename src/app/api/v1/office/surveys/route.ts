import { run } from "@/lib/api";
import { listOfficeSurveys, createSurvey } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/surveys", auth: "required", limit: { user: 30, ip: 60 }, feature: "surveys" }, listOfficeSurveys); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/surveys", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "surveys" }, createSurvey); }
