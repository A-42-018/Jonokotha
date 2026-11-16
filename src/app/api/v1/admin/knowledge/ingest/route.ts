import { run } from "@/lib/api";
import { ingestKnowledgeAdmin } from "@/lib/admin-service";

// POST {rules?: [...sourced service rules]}: (re)build the Routing Agent's index from the agency directory plus the rules. Safe to repeat.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/knowledge/ingest", auth: "required", limit: { user: 5, ip: 20 }, maxBytes: 256 * 1024 }, ingestKnowledgeAdmin); }
