import { run } from "@/lib/api";
import { listIngestionSources, registerIngestionSource } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/ingestion/sources", auth: "required", limit: { user: 30, ip: 60 } }, listIngestionSources); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/ingestion/sources", auth: "required", limit: { user: 10, ip: 30 } }, registerIngestionSource); }
