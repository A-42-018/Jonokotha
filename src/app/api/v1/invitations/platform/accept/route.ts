import { run } from "@/lib/api";
import { acceptPlatformInvitation } from "@/lib/admin-config";

// POST {token}: the invited citizen account (same confirmed email) becomes a moderator or administrator. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/invitations/platform/accept", auth: "required", limit: { user: 10, ip: 30 } }, acceptPlatformInvitation); }
