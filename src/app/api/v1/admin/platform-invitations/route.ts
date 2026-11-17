import { run } from "@/lib/api";
import { createPlatformInvitation } from "@/lib/admin-config";

// POST {email, role: moderator|admin}: admin invites a moderator or administrator. The token is shown once. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/platform-invitations", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, createPlatformInvitation); }
