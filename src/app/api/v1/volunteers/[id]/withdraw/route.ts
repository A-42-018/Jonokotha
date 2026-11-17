import { run } from "@/lib/api";
import { withdrawVolunteer } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/volunteers/[id]/withdraw">) { return run(req, await ctx.params, { name: "POST /api/v1/volunteers/[id]/withdraw", auth: "required", limit: { user: 10, ip: 30 }, feature: "assisted_reporting" }, withdrawVolunteer); }
