import { run } from "@/lib/api";
import { exportMine } from "@/lib/privacy";

// GET: everything the signed-in person gave or caused, as JSON. Strict limit: it reads many tables.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/export", auth: "required", limit: { user: 3, ip: 10 } }, exportMine); }
