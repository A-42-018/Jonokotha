import { run } from "@/lib/api";
import { volunteerRules } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/volunteers/rules", auth: "optional", limit: { ip: 120 }, feature: "assisted_reporting" }, volunteerRules); }
