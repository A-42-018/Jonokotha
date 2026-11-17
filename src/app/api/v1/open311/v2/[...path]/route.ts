import { run } from "@/lib/api";
import { open311 } from "@/lib/open311";

// Open311 GeoReport v2 (read side): discovery, services, service definition, requests, one request; .json or .xml. POST answers 403 in Open311's error format.
const opts = (method: string) => ({ name: `${method} /api/v1/open311/v2`, auth: "optional" as const, limit: { ip: 120 }, feature: "open311_api" });
export async function GET(req: Request, ctx: RouteContext<"/api/v1/open311/v2/[...path]">) { const { path } = await ctx.params; return run(req, { path: path.join("/") }, opts("GET"), open311); }
export async function POST(req: Request, ctx: RouteContext<"/api/v1/open311/v2/[...path]">) { const { path } = await ctx.params; return run(req, { path: path.join("/") }, { ...opts("POST"), limit: { ip: 20 } }, open311); }
