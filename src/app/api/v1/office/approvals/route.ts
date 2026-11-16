import { run } from "@/lib/api";
import { listApprovals } from "@/lib/mp-office";

// GET ?status=: approval requests the caller may see (the MP and admin: the area's; a requester: their own).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/approvals", auth: "required", limit: { user: 30, ip: 60 } }, listApprovals); }
