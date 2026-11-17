import { run } from "@/lib/api";
import { applyVolunteer } from "@/lib/release2";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/volunteers/apply", auth: "required", limit: { user: 5, ip: 20 }, feature: "assisted_reporting" }, applyVolunteer); }
