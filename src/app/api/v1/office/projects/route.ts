import { run } from "@/lib/api";
import { createProject } from "@/lib/reps-projects";

// POST: create a project (MP or office manager). A source needs the date it was checked. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/projects", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, createProject); }
