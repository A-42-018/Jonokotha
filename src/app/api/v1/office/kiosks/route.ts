import { run } from "@/lib/api";
import { createKiosk } from "@/lib/release2";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/kiosks", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "assisted_reporting" }, createKiosk); }
