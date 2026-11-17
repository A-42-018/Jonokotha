import { run } from "@/lib/api";
import { agencyReceipt } from "@/lib/release2";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/integrations/agency/receipts", auth: "optional", limit: { ip: 30 }, feature: "official_registration" }, agencyReceipt); }
