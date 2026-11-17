import { run } from "@/lib/api";
import { openDataset } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/open-data/[slug]">) { return run(req, await ctx.params, { name: "GET /api/v1/open-data/[slug]", auth: "optional", limit: { ip: 30 }, feature: "open_data" }, openDataset); }
