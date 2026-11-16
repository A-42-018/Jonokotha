import { run } from "@/lib/api";
import { getProfile, patchProfile } from "@/lib/privacy";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/profile", auth: "required", limit: { user: 60, ip: 120 } }, getProfile); }
export async function PATCH(req: Request) { return run(req, {}, { name: "PATCH /api/v1/me/profile", auth: "required", limit: { user: 10, ip: 30 } }, patchProfile); }
