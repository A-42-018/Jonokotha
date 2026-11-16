import { run } from "@/lib/api";
import { createInvitation, listInvitations } from "@/lib/admin-service";

// POST {email, constituency, role, representative_id?}: admins invite anyone; an office manager invites case officers and agency liaisons into their own office. GET: invitations you can see.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/invitations", auth: "required", limit: { user: 30, ip: 60 } }, listInvitations); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/invitations", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, createInvitation); }
