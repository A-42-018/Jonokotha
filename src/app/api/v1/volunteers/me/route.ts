import { run } from "@/lib/api";
import { myVolunteer } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/volunteers/me", auth: "required", limit: { user: 30, ip: 60 }, feature: "assisted_reporting" }, myVolunteer); }
