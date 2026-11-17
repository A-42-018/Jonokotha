import { run } from "@/lib/api";
import { listKnowledgeSources, manageKnowledgeSource } from "@/lib/admin-config";

// GET: sources with licence and fetch date. POST {action: add|refresh|retire, ...}: admin. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/knowledge-sources", auth: "required", limit: { user: 30, ip: 60 } }, listKnowledgeSources); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/knowledge-sources", auth: "required", limit: { user: 20, ip: 60 } }, manageKnowledgeSource); }
