import { run } from "@/lib/api";
import { importRepresentatives } from "@/lib/admin-service";

// POST {source: {name, url, license, fetched_at}, items: [...]}: import MPs and seats (up to 100 seats per call). Admin with MFA; audited; safe to repeat.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/representatives/import", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 1024 * 1024 }, importRepresentatives); }
