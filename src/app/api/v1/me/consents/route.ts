import { run } from "@/lib/api";
import { listConsents, setConsent } from "@/lib/privacy";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/consents", auth: "required", limit: { user: 60, ip: 120 } }, listConsents); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/consents", auth: "required", limit: { user: 20, ip: 60 } }, setConsent); }
