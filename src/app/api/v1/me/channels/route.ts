import { run } from "@/lib/api";
import { listMyChannels, startChannelLink } from "@/lib/channels-service";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/channels", auth: "required", limit: { user: 60, ip: 120 } }, listMyChannels); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/channels", auth: "required", limit: { user: 5, ip: 20 } }, startChannelLink); }
