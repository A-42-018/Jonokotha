import { run } from "@/lib/api";
import { listOfficeCommitments, createCommitment } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/commitments", auth: "required", limit: { user: 30, ip: 60 }, feature: "commitments" }, listOfficeCommitments); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/commitments", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "commitments" }, createCommitment); }
