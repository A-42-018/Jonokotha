import { run } from "@/lib/api";
import { acceptInvitation } from "@/lib/admin-service";

// POST {token}: join an office. The signed-in account's confirmed email must match the invited address.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/invitations/accept", auth: "required", limit: { user: 10, ip: 30 } }, acceptInvitation); }
