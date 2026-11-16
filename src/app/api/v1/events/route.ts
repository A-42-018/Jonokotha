import { run } from "@/lib/api";
import { eventCounts, trackEvent } from "@/lib/ops5";

// POST {name, lang?}: count a product event. Nothing identifying is stored. Works signed out. GET ?days=30: daily counters (admin).
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/events", auth: "optional", limit: { ip: 120 }, maxBytes: 1024 }, trackEvent); }
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/events", auth: "required", limit: { user: 20, ip: 60 } }, eventCounts); }
