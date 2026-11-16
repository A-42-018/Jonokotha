import { run } from "@/lib/api";
import { listCategories } from "@/lib/admin-config";

// GET: issue categories (bn/en names, parent, default priority, Open311 service_code). Active ones for everyone; admins also see inactive.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/categories", auth: "optional", limit: { ip: 120 } }, listCategories); }
