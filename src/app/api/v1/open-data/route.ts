import { run } from "@/lib/api";
import { openDataCatalogue } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/open-data", auth: "optional", limit: { ip: 60 }, feature: "open_data" }, openDataCatalogue); }
