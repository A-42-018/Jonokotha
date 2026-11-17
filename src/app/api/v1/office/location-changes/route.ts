import { run } from "@/lib/api";
import { listLocationChanges } from "@/lib/hierarchy";

// GET: location changes waiting for or past review for issues you can see.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/location-changes", auth: "required", limit: { user: 30, ip: 60 } }, listLocationChanges); }
