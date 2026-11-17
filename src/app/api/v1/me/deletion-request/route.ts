import { run } from "@/lib/api";
import { cancelDeletion, requestDeletion } from "@/lib/privacy";

// POST asks for account erasure (carried out after a 14-day grace period); DELETE cancels the request during the grace period.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/deletion-request", auth: "required", limit: { user: 3, ip: 10 } }, requestDeletion); }
export async function DELETE(req: Request) { return run(req, {}, { name: "DELETE /api/v1/me/deletion-request", auth: "required", limit: { user: 5, ip: 10 } }, cancelDeletion); }
