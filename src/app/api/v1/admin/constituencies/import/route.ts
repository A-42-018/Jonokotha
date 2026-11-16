import { run } from "@/lib/api";
import { importConstituencies } from "@/lib/admin-service";

// POST {source: {name, url, license, fetched_at}, geojson: FeatureCollection}: import verified boundaries (e.g. HDX files). Up to 100 features, 5 MB. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/constituencies/import", auth: "required", limit: { user: 5, ip: 20 }, maxBytes: 5 * 1024 * 1024 }, importConstituencies); }
