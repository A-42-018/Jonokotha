import { run } from "@/lib/api";
import { countryReadiness } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/admin/countries/[code]/readiness">) { return run(req, await ctx.params, { name: "GET /api/v1/admin/countries/[code]/readiness", auth: "required", limit: { user: 30, ip: 60 } }, countryReadiness); }
