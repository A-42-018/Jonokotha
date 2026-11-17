import { run } from "@/lib/api";
import { setCountryGate } from "@/lib/release2";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/admin/countries/[code]/gates/[gate]">) { return run(req, await ctx.params, { name: "PUT /api/v1/admin/countries/[code]/gates/[gate]", auth: "required", limit: { user: 10, ip: 30 } }, setCountryGate); }
