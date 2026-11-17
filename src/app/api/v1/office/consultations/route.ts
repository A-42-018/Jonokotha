import { run } from "@/lib/api";
import { listOfficeConsultations, createConsultation } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/consultations", auth: "required", limit: { user: 30, ip: 60 }, feature: "consultations" }, listOfficeConsultations); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/consultations", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "consultations" }, createConsultation); }
