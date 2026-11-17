import { run } from "@/lib/api";
import { retireKiosk } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/kiosks/[id]/retire">) { return run(req, await ctx.params, { name: "POST /api/v1/office/kiosks/[id]/retire", auth: "required", limit: { user: 10, ip: 30 }, feature: "assisted_reporting" }, retireKiosk); }
