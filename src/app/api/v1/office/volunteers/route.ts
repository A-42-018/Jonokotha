import { run } from "@/lib/api";
import { officeVolunteers } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/volunteers", auth: "required", limit: { user: 30, ip: 60 }, feature: "assisted_reporting" }, officeVolunteers); }
