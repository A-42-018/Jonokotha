import { run } from "@/lib/api";
import { listConsultations } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/consultations", auth: "optional", limit: { ip: 120 }, feature: "consultations" }, listConsultations); }
